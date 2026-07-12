# -*- coding: utf-8 -*-
"""Shared-resource bookings.

Only assets flagged ``bookable`` can be booked. Two bookings for the same asset
may never overlap; the canonical half-open-interval predicate is::

    new.start_time < existing.end_time  AND  new.end_time > existing.start_time

Back-to-back bookings (``10:00–11:00`` then ``11:00–12:00``) are therefore
legal, which is what users expect from a room calendar.

The check is enforced with a raw SQL query rather than an ORM ``search`` so that
it reads the *flushed* database state — this closes the window where two
concurrent transactions each believe the slot is free.
"""

from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError

# Calendar colour index per booking state.
STATE_COLORS = {
    'upcoming': 4,    # blue
    'ongoing': 10,    # green
    'completed': 8,   # grey
    'cancelled': 1,   # red
}


class AssetflowResourceBooking(models.Model):
    _name = 'assetflow.resource.booking'
    _description = 'Resource Booking'
    _inherit = ['mail.thread']
    _order = 'start_time desc'

    name = fields.Char(
        string='Reference', required=True, copy=False, readonly=True,
        default=lambda self: _('New'))
    asset_id = fields.Many2one(
        'assetflow.asset', string='Resource', required=True,
        ondelete='cascade', tracking=True,
        domain="[('bookable', '=', True), "
               "('state', 'not in', ('lost', 'retired', 'disposed'))]",
        help="Only assets flagged as Shared / Bookable can be booked.")
    user_id = fields.Many2one(
        'res.users', string='Booked By', required=True, tracking=True,
        default=lambda self: self.env.user,
        domain="[('share', '=', False)]")
    department_id = fields.Many2one(
        'assetflow.department', related='user_id.department_id', store=True)

    start_time = fields.Datetime(required=True, tracking=True)
    end_time = fields.Datetime(required=True, tracking=True)
    duration = fields.Float(
        string='Duration (Hours)', compute='_compute_duration', store=True)
    purpose = fields.Char(tracking=True)
    notes = fields.Text()

    state = fields.Selection(
        [('upcoming', 'Upcoming'),
         ('ongoing', 'Ongoing'),
         ('completed', 'Completed'),
         ('cancelled', 'Cancelled')],
        default='upcoming', required=True, tracking=True, index=True,
        group_expand='_group_expand_state')
    color = fields.Integer(compute='_compute_color', store=True)
    company_id = fields.Many2one(
        'res.company', related='asset_id.company_id', store=True)

    _sql_constraints = [
        ('end_after_start', 'CHECK(end_time > start_time)',
         'The end time must be strictly after the start time.'),
    ]

    # ------------------------------------------------------------------
    # Compute
    # ------------------------------------------------------------------
    @api.model
    def _group_expand_state(self, states, domain, order=None):
        return [key for key, _label in self._fields['state'].selection]

    @api.depends('start_time', 'end_time')
    def _compute_duration(self):
        for booking in self:
            if booking.start_time and booking.end_time:
                delta = booking.end_time - booking.start_time
                booking.duration = delta.total_seconds() / 3600.0
            else:
                booking.duration = 0.0

    @api.depends('state')
    def _compute_color(self):
        for booking in self:
            booking.color = STATE_COLORS.get(booking.state, 0)

    @api.depends('name', 'asset_id', 'user_id')
    def _compute_display_name(self):
        for booking in self:
            booking.display_name = '%s — %s' % (
                booking.asset_id.name or _('Resource'),
                booking.user_id.name or '')

    # ------------------------------------------------------------------
    # Constraints
    # ------------------------------------------------------------------
    @api.constrains('asset_id')
    def _check_asset_bookable(self):
        for booking in self:
            if not booking.asset_id.bookable:
                raise ValidationError(_(
                    "'%s' is not a shared resource and cannot be booked.",
                    booking.asset_id.display_name))
            if booking.asset_id.state in ('lost', 'retired', 'disposed'):
                raise ValidationError(_(
                    "'%s' is out of circulation and cannot be booked.",
                    booking.asset_id.display_name))

    @api.constrains('start_time', 'end_time')
    def _check_time_window(self):
        for booking in self:
            if booking.end_time <= booking.start_time:
                raise ValidationError(_(
                    "The end time must be strictly after the start time."))

    @api.constrains('asset_id', 'start_time', 'end_time', 'state')
    def _check_no_overlap(self):
        """Strict slot-overlap prevention, evaluated in SQL."""
        active = self.filtered(lambda b: b.state != 'cancelled')
        if not active:
            return
        # Make sure our own pending values are visible to the raw query.
        self.flush_model(['asset_id', 'start_time', 'end_time', 'state'])

        for booking in active:
            self.env.cr.execute(
                """
                  SELECT b.id, u.login, b.start_time, b.end_time
                    FROM assetflow_resource_booking b
                    JOIN res_users u ON u.id = b.user_id
                   WHERE b.asset_id  =  %(asset_id)s
                     AND b.id       <> %(booking_id)s
                     AND b.state    <> 'cancelled'
                     AND b.start_time <  %(end_time)s
                     AND b.end_time   >  %(start_time)s
                   LIMIT 1
                """,
                {
                    'asset_id': booking.asset_id.id,
                    'booking_id': booking.id,
                    'start_time': booking.start_time,
                    'end_time': booking.end_time,
                },
            )
            conflict = self.env.cr.dictfetchone()
            if conflict:
                clashing = self.browse(conflict['id'])
                raise ValidationError(_(
                    "'%(asset)s' is already booked by %(user)s from "
                    "%(start)s to %(end)s.\n\n"
                    "Bookings for the same resource may not overlap — pick "
                    "another slot or another resource.",
                    asset=booking.asset_id.display_name,
                    user=clashing.user_id.name,
                    start=fields.Datetime.to_string(clashing.start_time),
                    end=fields.Datetime.to_string(clashing.end_time)))

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------
    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', _('New')) == _('New'):
                vals['name'] = self.env['ir.sequence'].next_by_code(
                    'assetflow.resource.booking') or _('New')
        bookings = super().create(vals_list)
        bookings._sync_state_from_clock()
        return bookings

    def write(self, vals):
        if any(b.state in ('completed', 'cancelled') for b in self) and (
                'start_time' in vals or 'end_time' in vals
                or 'asset_id' in vals):
            raise UserError(_(
                "A completed or cancelled booking cannot be rescheduled. "
                "Create a new booking instead."))
        res = super().write(vals)
        if 'start_time' in vals or 'end_time' in vals:
            self._sync_state_from_clock()
        return res

    # ------------------------------------------------------------------
    # Workflow
    # ------------------------------------------------------------------
    def action_start(self):
        for booking in self:
            if booking.state != 'upcoming':
                raise UserError(_("Only an upcoming booking can be started."))
            booking.state = 'ongoing'
            if booking.asset_id.state == 'available':
                booking.asset_id._set_state('reserved', _(
                    "booked by %s", booking.user_id.name))
        return True

    def action_complete(self):
        for booking in self:
            if booking.state not in ('upcoming', 'ongoing'):
                raise UserError(_(
                    "Only an upcoming or ongoing booking can be completed."))
            booking.state = 'completed'
            booking._release_asset()
        return True

    def action_cancel(self):
        for booking in self:
            if booking.state == 'completed':
                raise UserError(_("A completed booking cannot be cancelled."))
            booking.state = 'cancelled'
            booking._release_asset()
        return True

    def action_reset_to_upcoming(self):
        for booking in self:
            if booking.state != 'cancelled':
                raise UserError(_(
                    "Only a cancelled booking can be reopened."))
            booking.state = 'upcoming'
        # Re-run the overlap check: the slot may have been taken meanwhile.
        self._check_no_overlap()
        return True

    def _release_asset(self):
        """Hand the resource back, unless something else already claimed it."""
        for booking in self:
            asset = booking.asset_id
            if asset.state != 'reserved':
                continue
            still_busy = self.search_count([
                ('asset_id', '=', asset.id),
                ('id', '!=', booking.id),
                ('state', '=', 'ongoing'),
            ])
            if not still_busy:
                asset._set_state('available', _("booking closed"))

    # ------------------------------------------------------------------
    # Automation
    # ------------------------------------------------------------------
    def _sync_state_from_clock(self):
        """Align a booking's state with the wall clock (used on create and by
        the cron)."""
        now = fields.Datetime.now()
        for booking in self:
            if booking.state == 'cancelled':
                continue
            if booking.end_time <= now:
                if booking.state != 'completed':
                    booking.state = 'completed'
                    booking._release_asset()
            elif booking.start_time <= now:
                if booking.state != 'ongoing':
                    booking.state = 'ongoing'
                    if booking.asset_id.state == 'available':
                        booking.asset_id._set_state('reserved', _(
                            "booked by %s", booking.user_id.name))
            elif booking.state != 'upcoming':
                booking.state = 'upcoming'
        return True

    @api.model
    def _cron_update_booking_states(self):
        """Roll bookings through upcoming → ongoing → completed."""
        now = fields.Datetime.now()
        pending = self.search([
            ('state', 'in', ('upcoming', 'ongoing')),
            ('start_time', '<=', now),
        ])
        pending._sync_state_from_clock()
        return True

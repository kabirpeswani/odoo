# -*- coding: utf-8 -*-
"""Asset master record.

The asset is the single source of truth for *where a thing is right now*.
Every other model in AssetFlow (allocation, booking, maintenance, audit) drives
``state`` through the helper ``_set_state`` rather than writing it directly, so
that the lifecycle stays auditable in the chatter.

Lifecycle
---------
    available ──allocate──▶ allocated ──return──▶ available
        │                        │
        ├──book──▶ reserved ─────┘
        ├──maintenance approved──▶ maintenance ──resolved──▶ available
        └──audit / manual──▶ lost | retired | disposed   (terminal-ish)
"""

from dateutil.relativedelta import relativedelta

from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError

# States in which the asset is physically unavailable for a new allocation.
BLOCKING_STATES = ('allocated', 'maintenance')
# States in which the asset is out of circulation for good.
DEAD_STATES = ('lost', 'retired', 'disposed')

# Kanban colour index per lifecycle state (Odoo colour palette).
STATE_COLORS = {
    'available': 10,    # green
    'allocated': 4,     # blue
    'reserved': 3,      # yellow
    'maintenance': 2,   # orange
    'lost': 1,          # red
    'retired': 8,       # grey-purple
    'disposed': 9,      # dark red
}


class AssetflowAsset(models.Model):
    _name = 'assetflow.asset'
    _description = 'Asset'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'asset_tag desc'

    # ------------------------------------------------------------------
    # Identification
    # ------------------------------------------------------------------
    name = fields.Char(required=True, tracking=True)
    asset_tag = fields.Char(
        string='Asset Tag', required=True, copy=False, readonly=True,
        index=True, default=lambda self: _('New'),
        help="Unique, auto-generated identifier, e.g. AF-0001.")
    serial_number = fields.Char(copy=False, tracking=True, index=True)
    category_id = fields.Many2one(
        'assetflow.asset.category', string='Category',
        required=True, ondelete='restrict', tracking=True)
    description = fields.Text()
    image = fields.Image(max_width=1024, max_height=1024)
    active = fields.Boolean(default=True)

    # ------------------------------------------------------------------
    # Acquisition & warranty
    # ------------------------------------------------------------------
    acquisition_date = fields.Date(
        default=fields.Date.context_today, tracking=True)
    acquisition_cost = fields.Monetary(
        currency_field='currency_id', tracking=True)
    currency_id = fields.Many2one(
        'res.currency', default=lambda self: self.env.company.currency_id,
        required=True)
    warranty_required = fields.Boolean(
        related='category_id.warranty_required', store=True, readonly=True)
    warranty_period = fields.Integer(
        related='category_id.warranty_period', readonly=True)
    warranty_expiry_date = fields.Date(
        compute='_compute_warranty_expiry_date', store=True,
        help="Acquisition date shifted by the category's warranty period.")
    warranty_active = fields.Boolean(
        compute='_compute_warranty_active', search='_search_warranty_active')

    # ------------------------------------------------------------------
    # Physical situation
    # ------------------------------------------------------------------
    condition = fields.Selection(
        [('new', 'New'), ('good', 'Good'),
         ('fair', 'Fair'), ('damaged', 'Damaged')],
        default='new', required=True, tracking=True)
    location = fields.Char(
        tracking=True, help="Physical location, e.g. 'HQ / Floor 2 / Lab A'.")
    state = fields.Selection(
        [('available', 'Available'),
         ('allocated', 'Allocated'),
         ('reserved', 'Reserved'),
         ('maintenance', 'Under Maintenance'),
         ('lost', 'Lost'),
         ('retired', 'Retired'),
         ('disposed', 'Disposed')],
        default='available', required=True, tracking=True, index=True,
        group_expand='_group_expand_state')
    bookable = fields.Boolean(
        string='Shared / Bookable',
        help="Shared resources (meeting rooms, vehicles, lab gear) can be "
             "booked on the calendar instead of being allocated long-term.")
    color = fields.Integer(compute='_compute_color', store=True)

    # ------------------------------------------------------------------
    # History
    # ------------------------------------------------------------------
    allocation_ids = fields.One2many(
        'assetflow.asset.allocation', 'asset_id', string='Allocation History')
    maintenance_ids = fields.One2many(
        'assetflow.maintenance', 'asset_id', string='Maintenance History')
    booking_ids = fields.One2many(
        'assetflow.resource.booking', 'asset_id', string='Bookings')
    audit_line_ids = fields.One2many(
        'assetflow.audit.line', 'asset_id', string='Audit History')

    current_allocation_id = fields.Many2one(
        'assetflow.asset.allocation', string='Current Allocation',
        compute='_compute_current_allocation', store=True)
    current_holder_id = fields.Many2one(
        'res.users', string='Currently Held By',
        related='current_allocation_id.employee_id', store=True)
    current_department_id = fields.Many2one(
        'assetflow.department', string='Holding Department',
        related='current_allocation_id.department_id', store=True)

    allocation_count = fields.Integer(compute='_compute_counts')
    maintenance_count = fields.Integer(compute='_compute_counts')
    booking_count = fields.Integer(compute='_compute_counts')

    company_id = fields.Many2one(
        'res.company', default=lambda self: self.env.company, required=True)

    _sql_constraints = [
        ('asset_tag_uniq', 'unique(asset_tag, company_id)',
         'The asset tag must be unique.'),
        ('serial_number_uniq', 'unique(serial_number, company_id)',
         'This serial number is already registered on another asset.'),
        ('acquisition_cost_positive', 'CHECK(acquisition_cost >= 0)',
         'The acquisition cost cannot be negative.'),
    ]

    # ------------------------------------------------------------------
    # Compute / defaults
    # ------------------------------------------------------------------
    @api.model
    def _group_expand_state(self, states, domain, order=None):
        """Always show every lifecycle column in the kanban, even when empty."""
        return [key for key, _label in self._fields['state'].selection]

    @api.depends('state')
    def _compute_color(self):
        for asset in self:
            asset.color = STATE_COLORS.get(asset.state, 0)

    @api.depends('acquisition_date', 'category_id.warranty_required',
                 'category_id.warranty_period')
    def _compute_warranty_expiry_date(self):
        for asset in self:
            category = asset.category_id
            if (category.warranty_required and category.warranty_period
                    and asset.acquisition_date):
                asset.warranty_expiry_date = (
                    asset.acquisition_date
                    + relativedelta(months=category.warranty_period))
            else:
                asset.warranty_expiry_date = False

    @api.depends('warranty_expiry_date')
    def _compute_warranty_active(self):
        today = fields.Date.context_today(self)
        for asset in self:
            asset.warranty_active = bool(
                asset.warranty_expiry_date
                and asset.warranty_expiry_date >= today)

    def _search_warranty_active(self, operator, value):
        today = fields.Date.context_today(self)
        if operator not in ('=', '!='):
            raise UserError(_("Unsupported operator on 'Under Warranty'."))
        under_warranty = (operator == '=') == bool(value)
        if under_warranty:
            return [('warranty_expiry_date', '>=', today)]
        return ['|', ('warranty_expiry_date', '=', False),
                ('warranty_expiry_date', '<', today)]

    @api.depends('allocation_ids.state', 'allocation_ids.return_date')
    def _compute_current_allocation(self):
        allocations = self.env['assetflow.asset.allocation'].search([
            ('asset_id', 'in', self.ids),
            ('state', 'in', ('approved', 'overdue')),
            ('return_date', '=', False),
        ], order='allocation_date desc, id desc')
        by_asset = {}
        for allocation in allocations:
            by_asset.setdefault(allocation.asset_id.id, allocation)
        for asset in self:
            asset.current_allocation_id = by_asset.get(asset.id, False)

    def _compute_counts(self):
        for asset in self:
            asset.allocation_count = len(asset.allocation_ids)
            asset.maintenance_count = len(asset.maintenance_ids)
            asset.booking_count = len(asset.booking_ids)

    @api.onchange('category_id')
    def _onchange_category_id(self):
        if self.category_id and not self.bookable:
            self.bookable = self.category_id.bookable_by_default

    # ------------------------------------------------------------------
    # Constraints
    # ------------------------------------------------------------------
    @api.constrains('acquisition_date')
    def _check_acquisition_date(self):
        today = fields.Date.context_today(self)
        for asset in self:
            if asset.acquisition_date and asset.acquisition_date > today:
                raise ValidationError(_(
                    "The acquisition date of '%s' cannot be in the future.",
                    asset.name))

    @api.constrains('warranty_required', 'acquisition_date')
    def _check_warranty_data(self):
        for asset in self:
            if asset.warranty_required and not asset.acquisition_date:
                raise ValidationError(_(
                    "Category '%s' requires a warranty: please set the "
                    "acquisition date of '%s'.",
                    asset.category_id.name, asset.name))

    @api.constrains('bookable', 'state')
    def _check_bookable(self):
        for asset in self:
            if asset.bookable and asset.state == 'allocated':
                raise ValidationError(_(
                    "'%s' is allocated long-term and therefore cannot be a "
                    "shared bookable resource at the same time.", asset.name))

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------
    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('asset_tag', _('New')) == _('New'):
                vals['asset_tag'] = self.env['ir.sequence'].next_by_code(
                    'assetflow.asset') or _('New')
        return super().create(vals_list)

    def copy(self, default=None):
        default = dict(default or {})
        default.setdefault('asset_tag', _('New'))
        default.setdefault('serial_number', False)
        default.setdefault('state', 'available')
        return super().copy(default)

    def unlink(self):
        for asset in self:
            if asset.allocation_ids or asset.maintenance_ids:
                raise UserError(_(
                    "'%s' has allocation or maintenance history and cannot be "
                    "deleted. Retire or dispose of it instead — the history "
                    "must remain auditable.", asset.display_name))
        return super().unlink()

    @api.depends('asset_tag', 'name')
    def _compute_display_name(self):
        for asset in self:
            asset.display_name = '[%s] %s' % (asset.asset_tag, asset.name)

    # ------------------------------------------------------------------
    # Lifecycle helpers
    # ------------------------------------------------------------------
    def _set_state(self, new_state, reason=None):
        """Single funnel for lifecycle transitions, so the chatter always
        explains *why* an asset changed hands."""
        labels = dict(self._fields['state'].selection)
        for asset in self:
            if asset.state == new_state:
                continue
            body = _("Lifecycle: %(from)s → %(to)s", **{
                'from': labels.get(asset.state, asset.state),
                'to': labels.get(new_state, new_state),
            })
            if reason:
                body += _(" — %s", reason)
            asset.sudo().write({'state': new_state})
            asset.message_post(body=body)

    def _ensure_operable(self):
        """Raise if the asset is out of circulation."""
        labels = dict(self._fields['state'].selection)
        for asset in self:
            if asset.state in DEAD_STATES:
                raise UserError(_(
                    "'%(asset)s' is marked as %(state)s and can no longer be "
                    "allocated, booked or serviced.",
                    asset=asset.display_name,
                    state=labels[asset.state]))

    # ------------------------------------------------------------------
    # Buttons
    # ------------------------------------------------------------------
    def action_set_available(self):
        for asset in self:
            if asset.current_allocation_id:
                raise UserError(_(
                    "'%s' is still allocated to %s. Register the return on the "
                    "allocation first.",
                    asset.display_name,
                    asset.current_holder_id.name))
        self._set_state('available', _("manually released"))

    def action_mark_lost(self):
        self._set_state('lost', _("reported lost"))

    def action_retire(self):
        for asset in self:
            if asset.current_allocation_id:
                raise UserError(_(
                    "Return '%s' from %s before retiring it.",
                    asset.display_name, asset.current_holder_id.name))
        self._set_state('retired', _("retired from service"))

    def action_dispose(self):
        self._set_state('disposed', _("disposed of"))
        self.write({'active': False})

    def action_allocate(self):
        """Open a pre-filled allocation request for this asset."""
        self.ensure_one()
        self._ensure_operable()
        if self.state in BLOCKING_STATES:
            # Delegate the "already held" story (and the transfer redirect) to
            # the allocation model so the message stays in one place.
            self.env['assetflow.asset.allocation']._raise_conflict(self)
        return {
            'type': 'ir.actions.act_window',
            'name': _('New Allocation'),
            'res_model': 'assetflow.asset.allocation',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'default_asset_id': self.id,
                'default_department_id': self.current_department_id.id,
            },
        }

    def action_request_transfer(self):
        """Start a transfer request for an asset somebody else is holding."""
        self.ensure_one()
        self._ensure_operable()
        allocation = self.current_allocation_id
        if not allocation:
            raise UserError(_(
                "'%s' is not currently held by anyone — allocate it directly "
                "instead of requesting a transfer.", self.display_name))
        return {
            'type': 'ir.actions.act_window',
            'name': _('Transfer Request'),
            'res_model': 'assetflow.asset.allocation',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'default_asset_id': self.id,
                'default_is_transfer': True,
                'default_previous_allocation_id': allocation.id,
            },
        }

    def action_book(self):
        self.ensure_one()
        self._ensure_operable()
        if not self.bookable:
            raise UserError(_(
                "'%s' is not a shared resource. Ask an Asset Manager to flag "
                "it as bookable, or request a standard allocation.",
                self.display_name))
        return {
            'type': 'ir.actions.act_window',
            'name': _('Book %s', self.display_name),
            'res_model': 'assetflow.resource.booking',
            'view_mode': 'calendar,tree,form',
            'domain': [('asset_id', '=', self.id)],
            'context': {'default_asset_id': self.id},
        }

    def action_report_issue(self):
        self.ensure_one()
        self._ensure_operable()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Maintenance Request'),
            'res_model': 'assetflow.maintenance',
            'view_mode': 'form',
            'target': 'new',
            'context': {'default_asset_id': self.id},
        }

    # -- smart buttons --------------------------------------------------
    def action_view_allocations(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Allocations'),
            'res_model': 'assetflow.asset.allocation',
            'view_mode': 'tree,form',
            'domain': [('asset_id', '=', self.id)],
            'context': {'default_asset_id': self.id},
        }

    def action_view_maintenance(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Maintenance'),
            'res_model': 'assetflow.maintenance',
            'view_mode': 'tree,form',
            'domain': [('asset_id', '=', self.id)],
            'context': {'default_asset_id': self.id},
        }

    def action_view_bookings(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Bookings'),
            'res_model': 'assetflow.resource.booking',
            'view_mode': 'calendar,tree,form',
            'domain': [('asset_id', '=', self.id)],
            'context': {'default_asset_id': self.id},
        }

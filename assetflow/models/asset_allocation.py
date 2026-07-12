# -*- coding: utf-8 -*-
"""Allocation & transfer workflow.

Two record shapes share this model:

* a plain **allocation** — the asset must be free at approval time;
* a **transfer** (``is_transfer=True``) — the asset is knowingly taken from the
  current holder, whose allocation is closed automatically upon approval.

The conflict rule lives in two layers:

* ``_check_no_double_allocation`` is the hard database-level guarantee. It can
  never be bypassed, including by imports or RPC.
* ``_raise_conflict`` is the *user-facing* layer: instead of a dead-end error it
  raises a :class:`RedirectWarning` that drops the user straight into a
  pre-filled Transfer Request.
"""

from odoo import _, api, fields, models
from odoo.exceptions import RedirectWarning, UserError, ValidationError

from .asset import BLOCKING_STATES

# An allocation still holding the asset.
ACTIVE_STATES = ('approved', 'overdue')


class AssetflowAssetAllocation(models.Model):
    _name = 'assetflow.asset.allocation'
    _description = 'Asset Allocation / Transfer'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'allocation_date desc, id desc'

    name = fields.Char(
        string='Reference', required=True, copy=False, readonly=True,
        default=lambda self: _('New'))
    asset_id = fields.Many2one(
        'assetflow.asset', string='Asset', required=True,
        ondelete='restrict', tracking=True,
        domain="[('state', 'not in', ('lost', 'retired', 'disposed')),"
               " ('bookable', '=', False)]")
    employee_id = fields.Many2one(
        'res.users', string='Assigned To', required=True, tracking=True,
        default=lambda self: self.env.user,
        domain="[('share', '=', False)]")
    department_id = fields.Many2one(
        'assetflow.department', string='Department',
        compute='_compute_department_id', store=True, readonly=False,
        tracking=True,
        help="Defaults to the assignee's department; the department head "
             "approves transfers within it.")

    allocation_date = fields.Date(
        required=True, default=fields.Date.context_today, tracking=True)
    expected_return_date = fields.Date(
        tracking=True,
        help="Leave empty for a permanent allocation.")
    return_date = fields.Date(readonly=True, copy=False, tracking=True)

    state = fields.Selection(
        [('draft', 'Draft'),
         ('requested', 'Requested'),
         ('approved', 'Approved'),
         ('overdue', 'Overdue'),
         ('returned', 'Returned')],
        default='draft', required=True, tracking=True, index=True,
        group_expand='_group_expand_state')

    # -- transfer specifics ---------------------------------------------
    is_transfer = fields.Boolean(
        string='Is a Transfer', copy=False, tracking=True,
        help="A transfer takes the asset away from its current holder.")
    previous_allocation_id = fields.Many2one(
        'assetflow.asset.allocation', string='Transferred From',
        copy=False, ondelete='restrict', readonly=True)
    previous_holder_id = fields.Many2one(
        'res.users', related='previous_allocation_id.employee_id',
        string='Previous Holder', store=True)
    transfer_reason = fields.Text()

    # -- convenience -----------------------------------------------------
    asset_state = fields.Selection(
        related='asset_id.state', string='Asset State', readonly=True)
    current_holder_id = fields.Many2one(
        'res.users', related='asset_id.current_holder_id',
        string='Currently Held By', readonly=True)
    notes = fields.Text()
    approved_by_id = fields.Many2one(
        'res.users', string='Approved By', readonly=True, copy=False)
    approval_date = fields.Datetime(readonly=True, copy=False)
    # Deliberately not stored: it is derived from today(), which moves on its
    # own. A stored value would only ever be refreshed when one of the fields
    # below changes, so it would freeze on the day the allocation went overdue
    # and under-report from then on.
    days_overdue = fields.Integer(compute='_compute_days_overdue')
    company_id = fields.Many2one(
        'res.company', related='asset_id.company_id', store=True)

    _sql_constraints = [
        ('return_after_allocation',
         'CHECK(return_date IS NULL OR allocation_date IS NULL '
         'OR return_date >= allocation_date)',
         'The return date cannot precede the allocation date.'),
        ('expected_after_allocation',
         'CHECK(expected_return_date IS NULL OR allocation_date IS NULL '
         'OR expected_return_date >= allocation_date)',
         'The expected return date cannot precede the allocation date.'),
    ]

    # ------------------------------------------------------------------
    # Compute
    # ------------------------------------------------------------------
    @api.model
    def _group_expand_state(self, states, domain, order=None):
        return [key for key, _label in self._fields['state'].selection]

    @api.depends('employee_id')
    def _compute_department_id(self):
        for allocation in self:
            if allocation.employee_id.department_id:
                allocation.department_id = allocation.employee_id.department_id
            elif not allocation.department_id:
                allocation.department_id = False

    @api.depends('expected_return_date', 'return_date', 'state')
    def _compute_days_overdue(self):
        today = fields.Date.context_today(self)
        for allocation in self:
            if (allocation.state in ACTIVE_STATES
                    and allocation.expected_return_date
                    and not allocation.return_date
                    and allocation.expected_return_date < today):
                allocation.days_overdue = (
                    today - allocation.expected_return_date).days
            else:
                allocation.days_overdue = 0

    @api.depends('name', 'asset_id', 'employee_id')
    def _compute_display_name(self):
        for allocation in self:
            allocation.display_name = '%s — %s' % (
                allocation.name, allocation.asset_id.name or '')

    # ------------------------------------------------------------------
    # Conflict detection
    # ------------------------------------------------------------------
    def _find_blocking_allocation(self, asset):
        """Return the allocation currently holding ``asset``, if any."""
        return self.sudo().search([
            ('id', 'not in', self.ids),
            ('asset_id', '=', asset.id),
            ('state', 'in', ACTIVE_STATES),
            ('return_date', '=', False),
        ], limit=1)

    @api.model
    def _raise_conflict(self, asset, blocking=None):
        """Explain the conflict *and* offer the way out (transfer request)."""
        blocking = blocking or self._find_blocking_allocation(asset)
        if asset.state == 'maintenance':
            raise UserError(_(
                "'%(asset)s' is currently under maintenance and cannot be "
                "allocated. Wait for the maintenance request to be resolved.",
                asset=asset.display_name))

        holder = blocking.employee_id if blocking else asset.current_holder_id
        message = _(
            "'%(asset)s' is currently held by %(holder)s"
            "%(department)s since %(since)s.\n\n"
            "It cannot be allocated twice. Raise a Transfer Request instead: "
            "the asset will be taken back from %(holder)s and handed over as "
            "soon as the transfer is approved.",
            asset=asset.display_name,
            holder=holder.name or _('another user'),
            department=(' (%s)' % blocking.department_id.name)
                       if blocking.department_id else '',
            since=blocking.allocation_date or _('an earlier date'),
        )
        action = self.env.ref(
            'assetflow.action_asset_allocation_transfer',
            raise_if_not_found=False)
        if not action:
            raise UserError(message)
        raise RedirectWarning(
            message, action.id, _('Request a Transfer'),
            {
                'default_asset_id': asset.id,
                'default_is_transfer': True,
                'default_previous_allocation_id': blocking.id if blocking else False,
            },
        )

    @api.constrains('asset_id', 'state', 'is_transfer', 'return_date')
    def _check_no_double_allocation(self):
        """Hard guarantee: one live allocation per asset."""
        for allocation in self:
            if allocation.state not in ACTIVE_STATES or allocation.return_date:
                continue
            asset = allocation.asset_id
            blocking = allocation._find_blocking_allocation(asset)
            if blocking:
                raise ValidationError(_(
                    "'%(asset)s' is already allocated to %(holder)s "
                    "(%(ref)s). An asset can only have one active holder — "
                    "close that allocation or use a Transfer Request.",
                    asset=asset.display_name,
                    holder=blocking.employee_id.name,
                    ref=blocking.name))
            if asset.state == 'maintenance':
                raise ValidationError(_(
                    "'%s' is under maintenance and cannot be allocated.",
                    asset.display_name))
            if asset.state in ('lost', 'retired', 'disposed'):
                raise ValidationError(_(
                    "'%s' is out of circulation and cannot be allocated.",
                    asset.display_name))

    @api.constrains('asset_id')
    def _check_asset_not_bookable(self):
        """A shared resource is booked, never allocated.

        The asset model refuses to be 'allocated' and 'bookable' at once, but
        that constraint only fired when the allocation was *approved* — long
        after the requester and the approver had both done their part. Catch it
        the moment the allocation is written instead, and say what to do about
        it.
        """
        for allocation in self:
            if allocation.asset_id.bookable:
                raise ValidationError(_(
                    "'%s' is a shared resource, so it is booked rather than "
                    "allocated. Reserve it on the booking calendar, or ask an "
                    "Asset Manager to clear its Shared / Bookable flag first.",
                    allocation.asset_id.display_name))

    @api.constrains('is_transfer', 'previous_allocation_id', 'employee_id')
    def _check_transfer_consistency(self):
        for allocation in self.filtered('is_transfer'):
            previous = allocation.previous_allocation_id
            if not previous:
                raise ValidationError(_(
                    "A transfer must reference the allocation it takes the "
                    "asset from."))
            if previous.asset_id != allocation.asset_id:
                raise ValidationError(_(
                    "The transfer and the source allocation must concern the "
                    "same asset."))
            if previous.employee_id == allocation.employee_id:
                raise ValidationError(_(
                    "'%s' already holds this asset — a transfer to the same "
                    "person is pointless.", allocation.employee_id.name))

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------
    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', _('New')) == _('New'):
                code = ('assetflow.asset.transfer' if vals.get('is_transfer')
                        else 'assetflow.asset.allocation')
                vals['name'] = self.env['ir.sequence'].next_by_code(code) \
                    or _('New')
        allocations = super().create(vals_list)
        allocations.asset_id._ensure_operable()
        return allocations

    def unlink(self):
        if any(a.state in ('approved', 'overdue', 'returned') for a in self):
            raise UserError(_(
                "Approved or returned allocations are part of the asset "
                "history and cannot be deleted."))
        return super().unlink()

    # ------------------------------------------------------------------
    # Workflow
    # ------------------------------------------------------------------
    def action_submit(self):
        for allocation in self:
            if allocation.state != 'draft':
                continue
            allocation.asset_id._ensure_operable()
            blocking = allocation._find_blocking_allocation(allocation.asset_id)
            if blocking and not allocation.is_transfer:
                # Offer the transfer path rather than a dead end.
                allocation._raise_conflict(allocation.asset_id, blocking)
            allocation.state = 'requested'
            allocation.message_post(
                body=_("Allocation requested by %s.", self.env.user.name))
        return True

    def _check_approver_rights(self):
        """Asset Managers approve anything; Department Heads only approve
        movements inside the department they run."""
        user = self.env.user
        if user.has_group('assetflow.group_assetflow_manager'):
            return
        if user.has_group('assetflow.group_assetflow_dept_head'):
            for allocation in self:
                if allocation.department_id.manager_id != user:
                    raise UserError(_(
                        "You may only approve allocations for the department "
                        "you manage. '%s' belongs to %s.",
                        allocation.name,
                        allocation.department_id.name or _('no department')))
            return
        raise UserError(_(
            "Only a Department Head or an Asset Manager can approve an "
            "allocation."))

    def action_approve(self):
        self._check_approver_rights()
        for allocation in self:
            if allocation.state not in ('draft', 'requested'):
                raise UserError(_(
                    "Only a draft or requested allocation can be approved."))
            asset = allocation.asset_id
            asset._ensure_operable()

            blocking = allocation._find_blocking_allocation(asset)
            if blocking and not allocation.is_transfer:
                allocation._raise_conflict(asset, blocking)
            if asset.state in BLOCKING_STATES and not allocation.is_transfer:
                allocation._raise_conflict(asset, blocking)

            if allocation.is_transfer:
                allocation._close_previous_allocation()

            allocation.write({
                'state': 'approved',
                'approved_by_id': self.env.user.id,
                'approval_date': fields.Datetime.now(),
            })
            asset._set_state('allocated', _(
                "allocated to %s (%s)",
                allocation.employee_id.name, allocation.name))
            allocation.message_post(body=_(
                "Approved by %(approver)s — asset handed over to %(holder)s.",
                approver=self.env.user.name,
                holder=allocation.employee_id.name))
        return True

    def _close_previous_allocation(self):
        """Take the asset back from the previous holder as part of a transfer."""
        self.ensure_one()
        previous = self.previous_allocation_id
        if not previous or previous.state == 'returned':
            return
        previous.sudo().write({
            'state': 'returned',
            'return_date': fields.Date.context_today(self),
        })
        previous.message_post(body=_(
            "Closed automatically: asset transferred to %s (%s).",
            self.employee_id.name, self.name))

    def action_return(self):
        for allocation in self:
            if allocation.state not in ACTIVE_STATES:
                raise UserError(_(
                    "Only an active allocation can be returned."))
            allocation.write({
                'state': 'returned',
                'return_date': fields.Date.context_today(allocation),
            })
            asset = allocation.asset_id
            # A return does not resurrect a lost/retired asset.
            if asset.state == 'allocated':
                asset._set_state('available', _(
                    "returned by %s", allocation.employee_id.name))
            allocation.message_post(body=_(
                "Returned by %s.", allocation.employee_id.name))
        return True

    def action_reset_to_draft(self):
        for allocation in self:
            if allocation.state != 'requested':
                raise UserError(_(
                    "Only a requested allocation can be sent back to draft."))
            allocation.write({'state': 'draft'})
            allocation.message_post(
                body=_("Request refused by %s.", self.env.user.name))
        return True

    def action_open_asset(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'assetflow.asset',
            'res_id': self.asset_id.id,
            'view_mode': 'form',
        }

    # ------------------------------------------------------------------
    # Automation
    # ------------------------------------------------------------------
    @api.model
    def _cron_flag_overdue(self):
        """Flip active allocations past their expected return date to
        'overdue' and ping the holder."""
        today = fields.Date.context_today(self)
        overdue = self.search([
            ('state', '=', 'approved'),
            ('return_date', '=', False),
            ('expected_return_date', '<', today),
        ])
        for allocation in overdue:
            allocation.state = 'overdue'
            allocation.message_post(
                body=_("This allocation is overdue since %s.",
                       allocation.expected_return_date),
                partner_ids=allocation.employee_id.partner_id.ids)
        return True

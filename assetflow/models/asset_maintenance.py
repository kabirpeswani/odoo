# -*- coding: utf-8 -*-
"""Maintenance requests and technician logs.

State machine (and its side-effects on the asset)::

    pending ──approve──▶ approved ──start──▶ in_progress ──resolve──▶ resolved
       │                    │  asset → maintenance          asset → available
       └──reject──▶ rejected   (the asset's previous state is remembered so a
                                resolved asset that was allocated goes back to
                                'allocated', not 'available')
"""

from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError

PRIORITY_COLORS = {'0': 4, '1': 3, '2': 1}


class AssetflowMaintenance(models.Model):
    _name = 'assetflow.maintenance'
    _description = 'Maintenance Request'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'priority desc, request_date desc, id desc'

    name = fields.Char(
        string='Reference', required=True, copy=False, readonly=True,
        default=lambda self: _('New'))
    asset_id = fields.Many2one(
        'assetflow.asset', string='Asset', required=True,
        ondelete='restrict', tracking=True,
        domain="[('state', 'not in', ('retired', 'disposed'))]")
    category_id = fields.Many2one(
        related='asset_id.category_id', store=True, string='Category')
    requester_id = fields.Many2one(
        'res.users', string='Reported By', required=True, tracking=True,
        default=lambda self: self.env.user, domain="[('share', '=', False)]")
    department_id = fields.Many2one(
        'assetflow.department', related='requester_id.department_id',
        store=True)
    technician_id = fields.Many2one(
        'res.users', string='Technician', tracking=True,
        domain="[('share', '=', False)]",
        help="Person carrying out the work once the request is approved.")

    description = fields.Text(required=True, tracking=True)
    priority = fields.Selection(
        [('0', 'Low'), ('1', 'Medium'), ('2', 'High')],
        default='1', required=True, tracking=True, index=True)
    attachment_ids = fields.Many2many(
        'ir.attachment', 'assetflow_maintenance_attachment_rel',
        'maintenance_id', 'attachment_id', string='Attachments',
        help="Photos, invoices or diagnostic reports backing the request.")

    request_date = fields.Datetime(
        default=fields.Datetime.now, required=True, readonly=True)
    approval_date = fields.Datetime(readonly=True, copy=False)
    start_date = fields.Datetime(readonly=True, copy=False)
    resolution_date = fields.Datetime(readonly=True, copy=False)
    approved_by_id = fields.Many2one(
        'res.users', string='Approved By', readonly=True, copy=False)
    rejection_reason = fields.Text(copy=False)
    resolution_notes = fields.Text(copy=False)
    repair_cost = fields.Monetary(currency_field='currency_id', tracking=True)
    currency_id = fields.Many2one(
        'res.currency', default=lambda self: self.env.company.currency_id,
        required=True)

    state = fields.Selection(
        [('pending', 'Pending Approval'),
         ('approved', 'Approved'),
         ('rejected', 'Rejected'),
         ('in_progress', 'In Progress'),
         ('resolved', 'Resolved')],
        default='pending', required=True, tracking=True, index=True,
        group_expand='_group_expand_state')
    color = fields.Integer(compute='_compute_color', store=True)

    # State the asset was in before it went into maintenance — restored on
    # resolution so we do not silently free an allocated asset.
    asset_previous_state = fields.Char(readonly=True, copy=False)

    log_ids = fields.One2many(
        'assetflow.maintenance.log', 'maintenance_id',
        string='Technician Logs')
    total_hours = fields.Float(
        compute='_compute_total_hours', store=True, string='Hours Spent')
    company_id = fields.Many2one(
        'res.company', related='asset_id.company_id', store=True)

    _sql_constraints = [
        ('repair_cost_positive', 'CHECK(repair_cost >= 0)',
         'The repair cost cannot be negative.'),
    ]

    # ------------------------------------------------------------------
    # Compute
    # ------------------------------------------------------------------
    @api.model
    def _group_expand_state(self, states, domain, order=None):
        return [key for key, _label in self._fields['state'].selection]

    @api.depends('priority')
    def _compute_color(self):
        for request in self:
            request.color = PRIORITY_COLORS.get(request.priority, 0)

    @api.depends('log_ids.hours_spent')
    def _compute_total_hours(self):
        for request in self:
            request.total_hours = sum(request.log_ids.mapped('hours_spent'))

    @api.depends('name', 'asset_id')
    def _compute_display_name(self):
        for request in self:
            request.display_name = '%s — %s' % (
                request.name, request.asset_id.name or '')

    # ------------------------------------------------------------------
    # Constraints
    # ------------------------------------------------------------------
    @api.constrains('asset_id')
    def _check_asset_serviceable(self):
        for request in self:
            if request.asset_id.state in ('retired', 'disposed'):
                raise ValidationError(_(
                    "'%s' is out of service — no maintenance can be requested "
                    "for it.", request.asset_id.display_name))

    @api.constrains('state', 'technician_id')
    def _check_technician_assigned(self):
        for request in self:
            if request.state == 'in_progress' and not request.technician_id:
                raise ValidationError(_(
                    "Assign a technician before starting the work on '%s'.",
                    request.name))

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------
    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', _('New')) == _('New'):
                vals['name'] = self.env['ir.sequence'].next_by_code(
                    'assetflow.maintenance') or _('New')
        requests = super().create(vals_list)
        for request in requests:
            request.message_post(body=_(
                "Maintenance requested for %s by %s.",
                request.asset_id.display_name, request.requester_id.name))
        return requests

    def unlink(self):
        if any(r.state not in ('pending', 'rejected') for r in self):
            raise UserError(_(
                "Only pending or rejected requests can be deleted — the rest "
                "belong to the asset's maintenance history."))
        return super().unlink()

    # ------------------------------------------------------------------
    # Workflow
    # ------------------------------------------------------------------
    def _check_manager_rights(self):
        if not self.env.user.has_group('assetflow.group_assetflow_manager'):
            raise UserError(_(
                "Only an Asset Manager can approve or reject a maintenance "
                "request."))

    def action_approve(self):
        self._check_manager_rights()
        for request in self:
            if request.state != 'pending':
                raise UserError(_(
                    "Only a pending request can be approved."))
            asset = request.asset_id
            asset._ensure_operable()
            request.write({
                'state': 'approved',
                'approved_by_id': self.env.user.id,
                'approval_date': fields.Datetime.now(),
                'asset_previous_state': asset.state,
            })
            # The headline automation: approving takes the asset off the floor.
            asset._set_state('maintenance', _(
                "maintenance request %s approved", request.name))
        return True

    def action_reject(self):
        self._check_manager_rights()
        for request in self:
            if request.state != 'pending':
                raise UserError(_("Only a pending request can be rejected."))
            if not request.rejection_reason:
                raise UserError(_(
                    "Please state a rejection reason for %s.", request.name))
            request.write({'state': 'rejected'})
            request.message_post(body=_(
                "Rejected by %(user)s: %(reason)s",
                user=self.env.user.name, reason=request.rejection_reason))
        return True

    def action_start(self):
        for request in self:
            if request.state != 'approved':
                raise UserError(_(
                    "The request must be approved before work can start."))
            if not request.technician_id:
                request.technician_id = self.env.user
            request.write({
                'state': 'in_progress',
                'start_date': fields.Datetime.now(),
            })
        return True

    def action_resolve(self):
        for request in self:
            if request.state not in ('approved', 'in_progress'):
                raise UserError(_(
                    "Only an approved or in-progress request can be resolved."))
            request.write({
                'state': 'resolved',
                'resolution_date': fields.Datetime.now(),
            })
            request._restore_asset_state()
            request.message_post(body=_(
                "Resolved by %(user)s after %(hours).1f h of work.",
                user=self.env.user.name, hours=request.total_hours))
        return True

    def _restore_asset_state(self):
        """Put the asset back into circulation.

        Default target is 'available'; if the asset was still allocated when it
        went into maintenance and that allocation is live, it goes back to
        'allocated' instead.
        """
        for request in self:
            asset = request.asset_id
            if asset.state != 'maintenance':
                continue
            if asset.current_allocation_id:
                asset._set_state('allocated', _(
                    "maintenance %s resolved — returned to %s",
                    request.name, asset.current_holder_id.name))
            else:
                asset._set_state('available', _(
                    "maintenance %s resolved", request.name))

    def action_reset_to_pending(self):
        for request in self:
            if request.state != 'rejected':
                raise UserError(_(
                    "Only a rejected request can be reopened."))
            request.write({'state': 'pending', 'rejection_reason': False})
        return True

    def action_log_work(self):
        """Quick technician log from the request form."""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Log Work'),
            'res_model': 'assetflow.maintenance.log',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'default_maintenance_id': self.id,
                'default_technician_id': (self.technician_id.id
                                          or self.env.user.id),
            },
        }


class AssetflowMaintenanceLog(models.Model):
    _name = 'assetflow.maintenance.log'
    _description = 'Maintenance Work Log'
    _order = 'log_date desc, id desc'

    maintenance_id = fields.Many2one(
        'assetflow.maintenance', string='Maintenance Request',
        required=True, ondelete='cascade', index=True)
    asset_id = fields.Many2one(
        related='maintenance_id.asset_id', store=True, string='Asset')
    technician_id = fields.Many2one(
        'res.users', string='Technician', required=True,
        default=lambda self: self.env.user, domain="[('share', '=', False)]")
    log_date = fields.Datetime(
        string='Date', required=True, default=fields.Datetime.now)
    description = fields.Text(string='Work Done', required=True)
    parts_used = fields.Char()
    hours_spent = fields.Float(digits=(6, 2))

    _sql_constraints = [
        ('hours_positive', 'CHECK(hours_spent >= 0)',
         'Hours spent cannot be negative.'),
    ]

    @api.constrains('maintenance_id')
    def _check_request_open(self):
        for log in self:
            if log.maintenance_id.state in ('pending', 'rejected'):
                raise ValidationError(_(
                    "Work can only be logged on an approved request. '%s' is "
                    "not approved yet.", log.maintenance_id.name))

    @api.depends('maintenance_id', 'log_date')
    def _compute_display_name(self):
        for log in self:
            log.display_name = '%s — %s' % (
                log.maintenance_id.name or '',
                fields.Datetime.to_string(log.log_date) or '')

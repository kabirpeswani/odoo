from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class AssetFlowTransfer(models.Model):
    _name = 'assetflow.transfer'
    _description = 'AssetFlow Transfer Request'
    _order = 'request_date desc'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    asset_id = fields.Many2one('assetflow.asset', string='Asset', required=True, tracking=True)
    requested_by_id = fields.Many2one('assetflow.employee', string='Requested By', required=True, tracking=True)
    target_employee_id = fields.Many2one('assetflow.employee', string='Transfer To', required=True, tracking=True)
    request_date = fields.Datetime(string='Request Date', default=fields.Datetime.now, required=True)
    state = fields.Selection([
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ], string='Status', default='pending', required=True, tracking=True)
    notes = fields.Text(string='Notes')
    approved_by_id = fields.Many2one('assetflow.employee', string='Approved By')

    def action_approve(self):
        self.ensure_one()
        asset = self.asset_id
        old_holder = asset.current_holder_id

        self.env['assetflow.allocation'].create({
            'asset_id': asset.id,
            'employee_id': self.target_employee_id.id,
            'department_id': self.target_employee_id.department_id.id,
            'notes': _('Transferred from %s', old_holder.name if old_holder else 'Pool'),
        })
        if old_holder:
            old_allocation = self.env['assetflow.allocation'].search([
                ('asset_id', '=', asset.id),
                ('employee_id', '=', old_holder.id),
                ('state', '=', 'active'),
            ], limit=1)
            if old_allocation:
                old_allocation.write({
                    'state': 'returned',
                    'actual_return_date': fields.Datetime.now(),
                })

        self.write({
            'state': 'approved',
            'approved_by_id': self.env.user.employee_id.id if self.env.user.employee_id else False,
        })

        self.env['assetflow.notification'].create({
            'user_id': self.target_employee_id.id,
            'title': _('Transfer Approved'),
            'message': _('Asset %s (%s) has been transferred to you.', asset.name, asset.asset_tag),
            'type': 'success',
        })
        self.env['assetflow.activity.log'].create({
            'user_id': self.env.user.employee_id.id if self.env.user.employee_id else False,
            'user_name': self.env.user.name,
            'action': 'APPROVE_TRANSFER',
            'details': _('Transfer of %s from %s to %s approved', asset.asset_tag, old_holder.name if old_holder else 'Pool', self.target_employee_id.name),
        })

    def action_reject(self):
        self.ensure_one()
        self.write({
            'state': 'rejected',
            'approved_by_id': self.env.user.employee_id.id if self.env.user.employee_id else False,
        })
        self.env['assetflow.notification'].create({
            'user_id': self.requested_by_id.id,
            'title': _('Transfer Rejected'),
            'message': _('Transfer request for %s (%s) has been rejected.', self.asset_id.name, self.asset_id.asset_tag),
            'type': 'warning',
        })
        self.env['assetflow.activity.log'].create({
            'user_id': self.env.user.employee_id.id if self.env.user.employee_id else False,
            'user_name': self.env.user.name,
            'action': 'REJECT_TRANSFER',
            'details': _('Transfer of %s to %s rejected', self.asset_id.asset_tag, self.target_employee_id.name),
        })

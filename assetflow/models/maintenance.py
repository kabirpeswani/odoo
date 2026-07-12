from odoo import api, fields, models, _


class AssetFlowMaintenance(models.Model):
    _name = 'assetflow.maintenance'
    _description = 'AssetFlow Maintenance Request'
    _order = 'request_date desc'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    asset_id = fields.Many2one('assetflow.asset', string='Asset', required=True, tracking=True)
    issue_description = fields.Text(string='Issue Description', required=True)
    priority = fields.Selection([
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ], string='Priority', default='medium', required=True)
    status = fields.Selection([
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('technician_assigned', 'Technician Assigned'),
        ('in_progress', 'In Progress'),
        ('resolved', 'Resolved'),
    ], string='Status', default='pending', required=True, tracking=True)
    requested_by_id = fields.Many2one('assetflow.employee', string='Requested By', required=True, tracking=True)
    request_date = fields.Datetime(string='Request Date', default=fields.Datetime.now, required=True)
    notes = fields.Text(string='Notes')
    photo = fields.Binary(string='Photo', attachment=True)

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        for record in records:
            self.env['assetflow.activity.log'].create({
                'user_id': self.env.user.employee_id.id if self.env.user.employee_id else False,
                'user_name': self.env.user.name,
                'action': 'RAISE_MAINTENANCE',
                'details': _('Maintenance request raised for %s - %s', record.asset_id.asset_tag, record.issue_description[:50]),
            })
        return records

    def action_approve(self):
        self.ensure_one()
        self.write({'status': 'approved'})
        self.asset_id.write({'status': 'under_maintenance'})
        self.env['assetflow.notification'].create({
            'user_id': self.requested_by_id.id,
            'title': _('Maintenance Approved'),
            'message': _('Maintenance request for %s (%s) has been approved.', self.asset_id.name, self.asset_id.asset_tag),
            'type': 'success',
        })
        self.env['assetflow.activity.log'].create({
            'user_id': self.env.user.employee_id.id if self.env.user.employee_id else False,
            'user_name': self.env.user.name,
            'action': 'UPDATE_MAINTENANCE',
            'details': _('Maintenance request for %s approved', self.asset_id.asset_tag),
        })

    def action_reject(self):
        self.ensure_one()
        self.write({'status': 'rejected'})
        self.env['assetflow.notification'].create({
            'user_id': self.requested_by_id.id,
            'title': _('Maintenance Rejected'),
            'message': _('Maintenance request for %s (%s) has been rejected.', self.asset_id.name, self.asset_id.asset_tag),
            'type': 'warning',
        })
        self.env['assetflow.activity.log'].create({
            'user_id': self.env.user.employee_id.id if self.env.user.employee_id else False,
            'user_name': self.env.user.name,
            'action': 'UPDATE_MAINTENANCE',
            'details': _('Maintenance request for %s rejected', self.asset_id.asset_tag),
        })

    def action_assign_technician(self):
        self.ensure_one()
        self.write({'status': 'technician_assigned'})

    def action_start(self):
        self.ensure_one()
        self.write({'status': 'in_progress'})

    def action_resolve(self):
        self.ensure_one()
        self.write({'status': 'resolved'})
        self.asset_id.write({'status': 'available'})
        self.env['assetflow.notification'].create({
            'user_id': self.requested_by_id.id,
            'title': _('Maintenance Resolved'),
            'message': _('Maintenance for %s (%s) has been resolved.', self.asset_id.name, self.asset_id.asset_tag),
            'type': 'success',
        })
        self.env['assetflow.activity.log'].create({
            'user_id': self.env.user.employee_id.id if self.env.user.employee_id else False,
            'user_name': self.env.user.name,
            'action': 'UPDATE_MAINTENANCE',
            'details': _('Maintenance request for %s resolved', self.asset_id.asset_tag),
        })

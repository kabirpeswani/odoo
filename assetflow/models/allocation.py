from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class AssetFlowAllocation(models.Model):
    _name = 'assetflow.allocation'
    _description = 'AssetFlow Asset Allocation'
    _order = 'allocation_date desc'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    asset_id = fields.Many2one('assetflow.asset', string='Asset', required=True, tracking=True)
    employee_id = fields.Many2one('assetflow.employee', string='Allocated To', required=True, tracking=True)
    department_id = fields.Many2one('assetflow.department', string='Department', tracking=True)
    allocation_date = fields.Datetime(string='Allocation Date', default=fields.Datetime.now, required=True)
    expected_return_date = fields.Date(string='Expected Return Date')
    actual_return_date = fields.Datetime(string='Actual Return Date')
    return_condition = fields.Text(string='Return Condition Notes')
    notes = fields.Text(string='Notes')
    state = fields.Selection([
        ('active', 'Active'),
        ('returned', 'Returned'),
    ], string='Status', default='active', required=True, tracking=True)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            asset = self.env['assetflow.asset'].browse(vals['asset_id'])
            if asset.status != 'available':
                raise ValidationError(_(
                    "Asset %s is currently %s and cannot be allocated.",
                    asset.asset_tag, asset.status
                ))
        records = super().create(vals_list)
        for record in records:
            asset = record.asset_id
            asset.write({
                'status': 'allocated',
                'current_holder_id': record.employee_id.id,
                'current_department_id': record.department_id.id or record.employee_id.department_id.id,
                'expected_return_date': record.expected_return_date,
            })
            self._create_notification(record)
            self._create_log(record)
        return records

    def action_return(self):
        self.ensure_one()
        asset = self.asset_id
        asset.write({
            'status': 'available',
            'current_holder_id': False,
            'current_department_id': False,
            'expected_return_date': False,
        })
        self.write({
            'state': 'returned',
            'actual_return_date': fields.Datetime.now(),
        })

    def _create_notification(self, allocation):
        self.env['assetflow.notification'].create({
            'user_id': allocation.employee_id.id,
            'title': _('Asset Allocated'),
            'message': _('Asset %s (%s) has been allocated to you.', allocation.asset_id.name, allocation.asset_id.asset_tag),
            'type': 'info',
        })

    def _create_log(self, allocation):
        self.env['assetflow.activity.log'].create({
            'user_id': self.env.user.employee_id.id if self.env.user.employee_id else False,
            'user_name': self.env.user.name,
            'action': 'ALLOCATE',
            'details': _('Asset %s allocated to %s', allocation.asset_id.asset_tag, allocation.employee_id.name),
        })

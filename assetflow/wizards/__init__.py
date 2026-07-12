from odoo import models, fields


class AssetFlowAllocateWizard(models.TransientModel):
    _name = 'assetflow.allocate.wizard'
    _description = 'Asset Allocation Wizard'

    asset_id = fields.Many2one('assetflow.asset', string='Asset', required=True)
    employee_id = fields.Many2one('assetflow.employee', string='Allocate To', required=True)
    department_id = fields.Many2one('assetflow.department', string='Department')
    expected_return_date = fields.Date(string='Expected Return Date')
    notes = fields.Text(string='Notes')

    def action_allocate(self):
        self.asset_id.write({
            'status': 'allocated',
            'current_holder_id': self.employee_id.id,
            'current_department_id': self.department_id.id or self.employee_id.department_id.id,
            'expected_return_date': self.expected_return_date,
        })
        self.env['assetflow.allocation'].create({
            'asset_id': self.asset_id.id,
            'employee_id': self.employee_id.id,
            'department_id': self.department_id.id or self.employee_id.department_id.id,
            'expected_return_date': self.expected_return_date,
            'notes': self.notes,
        })
        return {'type': 'ir.actions.act_window_close'}

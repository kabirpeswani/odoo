from odoo import api, fields, models


class AssetFlowDepartment(models.Model):
    _name = 'assetflow.department'
    _description = 'AssetFlow Department'
    _order = 'name'

    name = fields.Char(string='Department Name', required=True)
    head_id = fields.Many2one('assetflow.employee', string='Department Head')
    parent_department_id = fields.Many2one('assetflow.department', string='Parent Department')
    child_department_ids = fields.One2many('assetflow.department', 'parent_department_id', string='Child Departments')
    status = fields.Selection([
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    ], string='Status', default='active', required=True)
    employee_ids = fields.One2many('assetflow.employee', 'department_id', string='Employees')
    asset_ids = fields.One2many('assetflow.asset', 'current_department_id', string='Department Assets')

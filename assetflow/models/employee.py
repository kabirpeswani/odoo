from odoo import api, fields, models


class AssetFlowEmployee(models.Model):
    _name = 'assetflow.employee'
    _description = 'AssetFlow Employee'
    _order = 'name'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    name = fields.Char(string='Employee Name', required=True)
    email = fields.Char(string='Email', required=True)
    phone = fields.Char(string='Phone')
    department_id = fields.Many2one('assetflow.department', string='Department')
    role = fields.Selection([
        ('admin', 'Admin'),
        ('asset_manager', 'Asset Manager'),
        ('department_head', 'Department Head'),
        ('employee', 'Employee'),
    ], string='Role', default='employee', required=True)
    status = fields.Selection([
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    ], string='Status', default='active', required=True)
    user_id = fields.Many2one('res.users', string='Related User')
    allocated_asset_ids = fields.One2many('assetflow.asset', 'current_holder_id', string='Allocated Assets')
    booking_ids = fields.One2many('assetflow.booking', 'employee_id', string='Bookings')
    maintenance_request_ids = fields.One2many('assetflow.maintenance', 'requested_by_id', string='Maintenance Requests')
    notification_ids = fields.One2many('assetflow.notification', 'user_id', string='Notifications')

    @api.model
    def create(self, vals):
        employee = super().create(vals)
        if vals.get('email') and not vals.get('user_id'):
            user = self.env['res.users'].sudo().search([('login', '=', vals['email'])], limit=1)
            if not user:
                user_vals = {
                    'name': vals.get('name'),
                    'login': vals.get('email'),
                    'email': vals.get('email'),
                    'groups_id': [(4, self.env.ref('assetflow.group_assetflow_employee').id)],
                }
                employee_role_map = {
                    'admin': 'assetflow.group_assetflow_admin',
                    'asset_manager': 'assetflow.group_assetflow_asset_manager',
                    'department_head': 'assetflow.group_assetflow_department_head',
                    'employee': 'assetflow.group_assetflow_employee',
                }
                if vals.get('role') in employee_role_map:
                    group = self.env.ref(employee_role_map[vals['role']])
                    user_vals['groups_id'].append((4, group.id))
                user = self.env['res.users'].sudo().create(user_vals)
                employee.write({'user_id': user.id})
        return employee

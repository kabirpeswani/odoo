from odoo import api, fields, models, _


class AssetFlowActivityLog(models.Model):
    _name = 'assetflow.activity.log'
    _description = 'AssetFlow Activity Log'
    _order = 'timestamp desc'

    user_id = fields.Many2one('assetflow.employee', string='User')
    user_name = fields.Char(string='User Name')
    action = fields.Selection([
        ('ALLOCATE', 'Allocate Asset'),
        ('RETURN', 'Return Asset'),
        ('SUBMIT_TRANSFER', 'Submit Transfer'),
        ('APPROVE_TRANSFER', 'Approve Transfer'),
        ('REJECT_TRANSFER', 'Reject Transfer'),
        ('CONFIRM_BOOKING', 'Confirm Booking'),
        ('CANCEL_BOOKING', 'Cancel Booking'),
        ('REGISTER_ASSET', 'Register Asset'),
        ('RAISE_MAINTENANCE', 'Raise Maintenance'),
        ('UPDATE_MAINTENANCE', 'Update Maintenance'),
        ('CLOSE_AUDIT', 'Close Audit'),
        ('CREATE_DEPARTMENT', 'Create Department'),
        ('UPDATE_DEPARTMENT', 'Update Department'),
        ('CREATE_CATEGORY', 'Create Category'),
        ('PROMOTE_EMPLOYEE', 'Promote Employee'),
        ('UPDATE_EMPLOYEE', 'Update Employee Role'),
    ], string='Action', required=True)
    details = fields.Text(string='Details')
    timestamp = fields.Datetime(string='Timestamp', default=fields.Datetime.now, required=True)

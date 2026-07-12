from odoo import api, fields, models, _


class AssetFlowNotification(models.Model):
    _name = 'assetflow.notification'
    _description = 'AssetFlow Notification'
    _order = 'timestamp desc'

    user_id = fields.Many2one('assetflow.employee', string='User', required=True)
    title = fields.Char(string='Title', required=True)
    message = fields.Text(string='Message', required=True)
    type = fields.Selection([
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('success', 'Success'),
        ('error', 'Error'),
    ], string='Type', default='info', required=True)
    is_read = fields.Boolean(string='Is Read', default=False)
    timestamp = fields.Datetime(string='Timestamp', default=fields.Datetime.now, required=True)

    def action_mark_read(self):
        self.ensure_one()
        self.write({'is_read': True})

    def action_mark_all_read(self):
        self.search([('is_read', '=', False)]).write({'is_read': True})

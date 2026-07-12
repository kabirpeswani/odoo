from odoo import _, api, fields, models


class AssetflowLog(models.Model):
    _name = 'assetflow.log'
    _description = 'AssetFlow Activity Log'
    _order = 'create_date desc, id desc'

    res_model = fields.Char(required=True, index=True)
    res_id = fields.Integer(required=True, index=True)
    res_name = fields.Char(string='Resource')
    body = fields.Text(required=True)
    author_id = fields.Many2one('res.users', string='Author', default=lambda self: self.env.user, required=True)
    log_type = fields.Selection([
        ('lifecycle', 'Lifecycle'),
        ('allocation', 'Allocation'),
        ('maintenance', 'Maintenance'),
        ('audit', 'Audit'),
        ('booking', 'Booking'),
        ('system', 'System'),
    ], default='system', required=True, index=True)


class AssetflowLogMixin(models.AbstractModel):
    _name = 'assetflow.log.mixin'
    _description = 'AssetFlow Log Mixin'

    def _log(self, body, log_type='system'):
        for record in self:
            self.env['assetflow.log'].sudo().create({
                'res_model': record._name,
                'res_id': record.id,
                'res_name': record.display_name or record.name or str(record.id),
                'body': body,
                'author_id': self.env.user.id,
                'log_type': log_type,
            })

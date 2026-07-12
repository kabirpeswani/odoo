from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class AssetFlowAsset(models.Model):
    _name = 'assetflow.asset'
    _description = 'AssetFlow Asset'
    _order = 'asset_tag'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    name = fields.Char(string='Asset Name', required=True)
    asset_tag = fields.Char(string='Asset Tag', readonly=True, copy=False, index=True)
    category_id = fields.Many2one('assetflow.category', string='Category', required=True)
    serial_number = fields.Char(string='Serial Number', copy=False)
    acquisition_date = fields.Date(string='Acquisition Date')
    acquisition_cost = fields.Float(string='Acquisition Cost')
    condition = fields.Selection([
        ('new', 'New'),
        ('good', 'Good'),
        ('fair', 'Fair'),
        ('poor', 'Poor'),
    ], string='Condition', default='good')
    location = fields.Char(string='Location')
    photo = fields.Binary(string='Photo', attachment=True)
    document_ids = fields.Many2many('ir.attachment', string='Documents')
    status = fields.Selection([
        ('available', 'Available'),
        ('allocated', 'Allocated'),
        ('reserved', 'Reserved'),
        ('under_maintenance', 'Under Maintenance'),
        ('lost', 'Lost'),
        ('retired', 'Retired'),
        ('disposed', 'Disposed'),
    ], string='Status', default='available', required=True, tracking=True)
    is_bookable = fields.Boolean(string='Shared/Bookable Resource', default=False)
    current_holder_id = fields.Many2one('assetflow.employee', string='Current Holder', tracking=True)
    current_department_id = fields.Many2one('assetflow.department', string='Current Department', tracking=True)
    expected_return_date = fields.Date(string='Expected Return Date')
    active = fields.Boolean(string='Active', default=True)

    allocation_ids = fields.One2many('assetflow.allocation', 'asset_id', string='Allocation History')
    booking_ids = fields.One2many('assetflow.booking', 'asset_id', string='Bookings')
    maintenance_ids = fields.One2many('assetflow.maintenance', 'asset_id', string='Maintenance History')

    _sql_constraints = [
        ('unique_asset_tag', 'UNIQUE(asset_tag)', 'Asset Tag must be unique!'),
        ('unique_serial_number', 'UNIQUE(serial_number)', 'Serial Number must be unique!'),
    ]

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if not vals.get('asset_tag'):
                vals['asset_tag'] = self._generate_asset_tag()
        return super().create(vals_list)

    def _generate_asset_tag(self):
        last = self.search([], order='asset_tag desc', limit=1)
        if last and last.asset_tag:
            last_num = int(last.asset_tag.split('-')[1])
            return f'AF-{last_num + 1:04d}'
        return 'AF-0001'

    def action_allocate(self):
        self.ensure_one()
        if self.status != 'available':
            raise ValidationError(_("Asset is not available for allocation."))
        return {
            'type': 'ir.actions.act_window',
            'name': _('Allocate Asset'),
            'res_model': 'assetflow.allocation',
            'view_mode': 'form',
            'context': {'default_asset_id': self.id},
        }

    def action_set_lost(self):
        self.status = 'lost'

    def action_set_retired(self):
        self.status = 'retired'

    def action_set_disposed(self):
        self.status = 'disposed'

from odoo import api, fields, models


class AssetFlowCategory(models.Model):
    _name = 'assetflow.category'
    _description = 'AssetFlow Asset Category'
    _order = 'name'

    name = fields.Char(string='Category Name', required=True)
    description = fields.Text(string='Description')
    asset_ids = fields.One2many('assetflow.asset', 'category_id', string='Assets')

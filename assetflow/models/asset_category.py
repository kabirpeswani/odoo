# -*- coding: utf-8 -*-
"""Asset categories.

A category carries the *policy* an asset inherits: whether a warranty is
mandatory and, if so, for how many months. The warranty period field is only
meaningful when ``warranty_required`` is set — the form view hides it and the
constraint below keeps the data honest.
"""

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class AssetflowAssetCategory(models.Model):
    _name = 'assetflow.asset.category'
    _description = 'Asset Category'
    _order = 'name'

    name = fields.Char(required=True)
    code = fields.Char(help="Prefix used inside the asset tag, e.g. ELEC.")
    description = fields.Text()
    active = fields.Boolean(default=True)
    color = fields.Integer(string='Colour Index')

    warranty_required = fields.Boolean(
        string='Warranty Required',
        help="When enabled, assets of this category must record an "
             "acquisition date so their warranty expiry can be derived.")
    warranty_period = fields.Integer(
        string='Warranty Period (Months)', default=12,
        help="Number of months of warranty coverage from the acquisition date.")

    bookable_by_default = fields.Boolean(
        string='Shared By Default',
        help="New assets in this category are flagged as bookable resources.")
    depreciation_years = fields.Integer(
        string='Expected Lifetime (Years)', default=5,
        help="Informative only — used by the audit team to spot ageing assets.")

    # Inverse of assetflow.org.setup.category_ids — see the department field of
    # the same name.
    setup_id = fields.Many2one(
        'assetflow.org.setup', string='Organization Setup',
        ondelete='set null', index=True,
        default=lambda self: self.env.ref(
            'assetflow.org_setup_main', raise_if_not_found=False))

    asset_ids = fields.One2many(
        'assetflow.asset', 'category_id', string='Assets')
    asset_count = fields.Integer(compute='_compute_asset_count')
    company_id = fields.Many2one(
        'res.company', default=lambda self: self.env.company, required=True)

    _sql_constraints = [
        ('name_company_uniq', 'unique(name, company_id)',
         'An asset category with this name already exists.'),
        ('warranty_period_positive', 'CHECK(warranty_period >= 0)',
         'The warranty period cannot be negative.'),
    ]

    def _compute_asset_count(self):
        data = self.env['assetflow.asset']._read_group(
            [('category_id', 'in', self.ids)],
            groupby=['category_id'], aggregates=['__count'])
        counts = {category.id: count for category, count in data}
        for category in self:
            category.asset_count = counts.get(category.id, 0)

    @api.constrains('warranty_required', 'warranty_period')
    def _check_warranty_period(self):
        for category in self:
            if category.warranty_required and category.warranty_period <= 0:
                raise ValidationError(_(
                    "Category '%s' requires a warranty, so its warranty period "
                    "must be at least one month.", category.name))

    @api.onchange('warranty_required')
    def _onchange_warranty_required(self):
        if not self.warranty_required:
            self.warranty_period = 0
        elif not self.warranty_period:
            self.warranty_period = 12

    def action_view_assets(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Assets — %s', self.name),
            'res_model': 'assetflow.asset',
            'view_mode': 'kanban,tree,form',
            'domain': [('category_id', '=', self.id)],
            'context': {'default_category_id': self.id},
        }

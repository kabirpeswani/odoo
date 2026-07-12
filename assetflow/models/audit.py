from odoo import api, fields, models, _


class AssetFlowAuditCycle(models.Model):
    _name = 'assetflow.audit.cycle'
    _description = 'AssetFlow Audit Cycle'
    _order = 'start_date desc'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    name = fields.Char(string='Audit Name', required=True)
    department_id = fields.Many2one('assetflow.department', string='Scope Department')
    location = fields.Char(string='Scope Location')
    start_date = fields.Date(string='Start Date', required=True)
    end_date = fields.Date(string='End Date', required=True)
    status = fields.Selection([
        ('active', 'Active'),
        ('closed', 'Closed'),
    ], string='Status', default='active', required=True, tracking=True)
    auditor_ids = fields.Many2many('assetflow.employee', string='Auditors')
    check_ids = fields.One2many('assetflow.audit.check', 'audit_id', string='Asset Checks')
    total_assets = fields.Integer(string='Total Assets', compute='_compute_counts')
    verified_count = fields.Integer(string='Verified', compute='_compute_counts')
    missing_count = fields.Integer(string='Missing', compute='_compute_counts')
    damaged_count = fields.Integer(string='Damaged', compute='_compute_counts')
    discrepancy_count = fields.Integer(string='Discrepancies', compute='_compute_counts')

    @api.depends('check_ids', 'check_ids.check_status')
    def _compute_counts(self):
        for cycle in self:
            cycle.total_assets = len(cycle.check_ids)
            cycle.verified_count = len(cycle.check_ids.filtered(lambda c: c.check_status == 'verified'))
            cycle.missing_count = len(cycle.check_ids.filtered(lambda c: c.check_status == 'missing'))
            cycle.damaged_count = len(cycle.check_ids.filtered(lambda c: c.check_status == 'damaged'))
            cycle.discrepancy_count = cycle.missing_count + cycle.damaged_count

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        for record in records:
            domain = [('status', '=', 'available')]
            if record.department_id:
                domain += [('current_department_id', '=', record.department_id.id)]
            if record.location:
                domain += [('location', 'ilike', record.location)]
            assets = self.env['assetflow.asset'].search(domain)
            for asset in assets:
                self.env['assetflow.audit.check'].create({
                    'audit_id': record.id,
                    'asset_id': asset.id,
                    'check_status': 'pending',
                })
        return records

    def action_close(self):
        self.ensure_one()
        for check in self.check_ids:
            if check.check_status == 'missing':
                check.asset_id.write({'status': 'lost'})
            elif check.check_status == 'damaged':
                check.asset_id.write({'status': 'under_maintenance'})
        self.write({'status': 'closed'})
        self.env['assetflow.activity.log'].create({
            'user_id': self.env.user.employee_id.id if self.env.user.employee_id else False,
            'user_name': self.env.user.name,
            'action': 'CLOSE_AUDIT',
            'details': _('Audit cycle "%s" closed. %d discrepancies found.', self.name, self.discrepancy_count),
        })


class AssetFlowAuditCheck(models.Model):
    _name = 'assetflow.audit.check'
    _description = 'AssetFlow Audit Check'
    _order = 'asset_id'

    audit_id = fields.Many2one('assetflow.audit.cycle', string='Audit Cycle', required=True, ondelete='cascade')
    asset_id = fields.Many2one('assetflow.asset', string='Asset', required=True)
    check_status = fields.Selection([
        ('pending', 'Pending'),
        ('verified', 'Verified'),
        ('missing', 'Missing'),
        ('damaged', 'Damaged'),
    ], string='Check Status', default='pending', required=True)
    checked_at = fields.Datetime(string='Checked At')
    notes = fields.Text(string='Notes')
    checked_by_id = fields.Many2one('assetflow.employee', string='Checked By')

    def action_verify(self):
        self.ensure_one()
        self.write({
            'check_status': 'verified',
            'checked_at': fields.Datetime.now(),
            'checked_by_id': self.env.user.employee_id.id if self.env.user.employee_id else False,
        })

    def action_mark_missing(self):
        self.ensure_one()
        self.write({
            'check_status': 'missing',
            'checked_at': fields.Datetime.now(),
            'checked_by_id': self.env.user.employee_id.id if self.env.user.employee_id else False,
        })

    def action_mark_damaged(self):
        self.ensure_one()
        self.write({
            'check_status': 'damaged',
            'checked_at': fields.Datetime.now(),
            'checked_by_id': self.env.user.employee_id.id if self.env.user.employee_id else False,
        })

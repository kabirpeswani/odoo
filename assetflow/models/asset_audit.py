# -*- coding: utf-8 -*-
"""Physical audit cycles.

An audit cycle snapshots a scope (a department or a physical location) into one
audit line per asset. Auditors tick each line off as verified / missing /
damaged. Closing the cycle is the moment the *paper* findings are pushed back
onto the *physical* asset records:

    missing  → asset.state     = 'lost'
    damaged  → asset.condition = 'damaged' and a maintenance request is opened
    verified → asset untouched

A cycle cannot be closed while lines are still unchecked — an audit with holes
in it is worse than no audit.
"""

from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError


class AssetflowAuditCycle(models.Model):
    _name = 'assetflow.audit.cycle'
    _description = 'Asset Audit Cycle'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'date_start desc, id desc'

    name = fields.Char(required=True, tracking=True)
    reference = fields.Char(
        readonly=True, copy=False, default=lambda self: _('New'))
    scope = fields.Selection(
        [('department', 'Department'), ('location', 'Location')],
        default='department', required=True, tracking=True)
    department_id = fields.Many2one(
        'assetflow.department', string='Target Department', tracking=True)
    location = fields.Char(string='Target Location', tracking=True)
    include_sub_departments = fields.Boolean(
        default=True,
        help="Also audit the assets held by sub-departments of the target.")

    date_start = fields.Date(
        required=True, default=fields.Date.context_today, tracking=True)
    date_end = fields.Date(required=True, tracking=True)
    auditor_ids = fields.Many2many(
        'res.users', 'assetflow_audit_auditor_rel', 'cycle_id', 'user_id',
        string='Auditors', required=True, domain="[('share', '=', False)]",
        default=lambda self: self.env.user)

    state = fields.Selection(
        [('draft', 'Draft'),
         ('open', 'In Progress'),
         ('discrepancy_found', 'Discrepancies Found'),
         ('closed', 'Closed')],
        default='draft', required=True, tracking=True, index=True,
        group_expand='_group_expand_state')

    line_ids = fields.One2many(
        'assetflow.audit.line', 'cycle_id', string='Audit Lines')
    total_count = fields.Integer(compute='_compute_progress', store=True)
    pending_count = fields.Integer(compute='_compute_progress', store=True)
    verified_count = fields.Integer(compute='_compute_progress', store=True)
    missing_count = fields.Integer(compute='_compute_progress', store=True)
    damaged_count = fields.Integer(compute='_compute_progress', store=True)
    progress = fields.Float(
        compute='_compute_progress', store=True, group_operator='avg',
        help="Share of the scope that has been checked.")
    notes = fields.Text(string='Closing Report')
    company_id = fields.Many2one(
        'res.company', default=lambda self: self.env.company, required=True)

    _sql_constraints = [
        ('date_end_after_start', 'CHECK(date_end >= date_start)',
         'The audit end date must be on or after the start date.'),
    ]

    # ------------------------------------------------------------------
    # Compute
    # ------------------------------------------------------------------
    @api.model
    def _group_expand_state(self, states, domain, order=None):
        return [key for key, _label in self._fields['state'].selection]

    @api.depends('line_ids.result')
    def _compute_progress(self):
        for cycle in self:
            lines = cycle.line_ids
            cycle.total_count = len(lines)
            cycle.pending_count = len(
                lines.filtered(lambda l: l.result == 'pending'))
            cycle.verified_count = len(
                lines.filtered(lambda l: l.result == 'verified'))
            cycle.missing_count = len(
                lines.filtered(lambda l: l.result == 'missing'))
            cycle.damaged_count = len(
                lines.filtered(lambda l: l.result == 'damaged'))
            checked = cycle.total_count - cycle.pending_count
            cycle.progress = (
                100.0 * checked / cycle.total_count) if cycle.total_count else 0.0

    @api.depends('name', 'reference')
    def _compute_display_name(self):
        for cycle in self:
            cycle.display_name = (
                '%s — %s' % (cycle.reference, cycle.name)
                if cycle.reference and cycle.reference != _('New')
                else cycle.name)

    # ------------------------------------------------------------------
    # Constraints
    # ------------------------------------------------------------------
    @api.constrains('scope', 'department_id', 'location')
    def _check_scope_target(self):
        for cycle in self:
            if cycle.scope == 'department' and not cycle.department_id:
                raise ValidationError(_(
                    "A department-scoped audit needs a target department."))
            if cycle.scope == 'location' and not cycle.location:
                raise ValidationError(_(
                    "A location-scoped audit needs a target location."))

    @api.constrains('date_start', 'date_end')
    def _check_dates(self):
        for cycle in self:
            if cycle.date_end < cycle.date_start:
                raise ValidationError(_(
                    "The audit end date cannot precede its start date."))

    @api.onchange('scope')
    def _onchange_scope(self):
        if self.scope == 'department':
            self.location = False
        else:
            self.department_id = False

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------
    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('reference', _('New')) == _('New'):
                vals['reference'] = self.env['ir.sequence'].next_by_code(
                    'assetflow.audit.cycle') or _('New')
        return super().create(vals_list)

    def unlink(self):
        if any(cycle.state == 'closed' for cycle in self):
            raise UserError(_(
                "A closed audit cycle is a legal record and cannot be deleted."))
        return super().unlink()

    # ------------------------------------------------------------------
    # Scope resolution
    # ------------------------------------------------------------------
    def _get_scope_domain(self):
        """Domain selecting the assets that fall inside this cycle's scope."""
        self.ensure_one()
        domain = [
            ('company_id', '=', self.company_id.id),
            ('state', 'not in', ('disposed', 'retired')),
        ]
        if self.scope == 'department':
            operator = 'child_of' if self.include_sub_departments else '='
            domain.append(
                ('current_department_id', operator, self.department_id.id))
        else:
            domain.append(('location', '=ilike', self.location))
        return domain

    def action_generate_lines(self):
        """(Re)build the audit lines from the current scope, keeping the
        results already entered by the auditors."""
        for cycle in self:
            if cycle.state == 'closed':
                raise UserError(_(
                    "A closed audit cycle cannot be re-scoped."))
            assets = self.env['assetflow.asset'].search(
                cycle._get_scope_domain())
            existing = cycle.line_ids.mapped('asset_id')
            # Drop untouched lines for assets that left the scope.
            stale = cycle.line_ids.filtered(
                lambda l: l.asset_id not in assets and l.result == 'pending')
            stale.unlink()
            new_assets = assets - existing
            self.env['assetflow.audit.line'].create([
                {'cycle_id': cycle.id, 'asset_id': asset.id}
                for asset in new_assets
            ])
            cycle.message_post(body=_(
                "Scope refreshed: %(total)s asset(s) in scope, %(new)s newly "
                "added.", total=len(assets), new=len(new_assets)))
        return True

    # ------------------------------------------------------------------
    # Workflow
    # ------------------------------------------------------------------
    def action_open(self):
        for cycle in self:
            if cycle.state != 'draft':
                raise UserError(_("Only a draft cycle can be started."))
            cycle.action_generate_lines()
            if not cycle.line_ids:
                raise UserError(_(
                    "No asset matches the scope of '%s'. Widen the scope "
                    "before starting the audit.", cycle.name))
            cycle.state = 'open'
            cycle.message_post(
                body=_("Audit started — %s asset(s) to check.",
                       len(cycle.line_ids)),
                partner_ids=cycle.auditor_ids.partner_id.ids)
            # Give each auditor a to-do on the cycle itself.
            for auditor in cycle.auditor_ids:
                cycle.activity_schedule(
                    'mail.mail_activity_data_todo',
                    date_deadline=cycle.date_end,
                    summary=_('Audit assets — %s', cycle.name),
                    user_id=auditor.id)
        return True

    def _refresh_discrepancy_state(self):
        """Bubble discrepancies up to the cycle state while it is running.

        Auditors are usually plain employees with read-only access to the cycle,
        so this rollup is written with sudo: it is derived from the lines rather
        than entered by the user, and the record rules already decide which
        cycles an auditor may touch at all.
        """
        for cycle in self.filtered(
                lambda c: c.state in ('open', 'discrepancy_found')):
            has_discrepancy = bool(cycle.missing_count or cycle.damaged_count)
            target = 'discrepancy_found' if has_discrepancy else 'open'
            if cycle.state != target:
                cycle.sudo().state = target

    def action_close(self):
        """Push the audit findings onto the physical asset records."""
        for cycle in self:
            if cycle.state not in ('open', 'discrepancy_found'):
                raise UserError(_(
                    "Only a running audit cycle can be closed."))
            if cycle.pending_count:
                raise UserError(_(
                    "%(count)s asset(s) of '%(cycle)s' have not been checked "
                    "yet. Every line must be verified, reported missing or "
                    "reported damaged before the cycle can be closed.",
                    count=cycle.pending_count, cycle=cycle.name))

            lost = cycle.line_ids.filtered(lambda l: l.result == 'missing')
            damaged = cycle.line_ids.filtered(lambda l: l.result == 'damaged')

            for line in lost:
                line.asset_id._set_state('lost', _(
                    "reported missing during audit %s", cycle.reference))
            for line in damaged:
                asset = line.asset_id
                asset.sudo().write({'condition': 'damaged'})
                if asset.state not in ('lost', 'retired', 'disposed'):
                    self.env['assetflow.maintenance'].sudo().create({
                        'asset_id': asset.id,
                        'requester_id': (line.auditor_id.id
                                         or self.env.user.id),
                        'description': _(
                            "Damage reported during audit %(ref)s.\n%(notes)s",
                            ref=cycle.reference, notes=line.notes or ''),
                        'priority': '2',
                    })

            cycle.write({'state': 'closed'})
            cycle.activity_unlink(['mail.mail_activity_data_todo'])
            cycle.message_post(body=_(
                "Audit closed — %(verified)s verified, %(missing)s missing "
                "(flagged as lost), %(damaged)s damaged (maintenance opened).",
                verified=cycle.verified_count,
                missing=cycle.missing_count,
                damaged=cycle.damaged_count))
        return True

    def action_reset_to_draft(self):
        for cycle in self:
            if cycle.state == 'closed':
                raise UserError(_(
                    "A closed audit cycle cannot be reopened — run a new one."))
            cycle.state = 'draft'
        return True

    def action_view_lines(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Audit Lines — %s', self.name),
            'res_model': 'assetflow.audit.line',
            'view_mode': 'tree,form',
            'domain': [('cycle_id', '=', self.id)],
            'context': {'default_cycle_id': self.id},
        }


class AssetflowAuditLine(models.Model):
    _name = 'assetflow.audit.line'
    _description = 'Asset Audit Line'
    _order = 'cycle_id, asset_id'

    cycle_id = fields.Many2one(
        'assetflow.audit.cycle', string='Audit Cycle',
        required=True, ondelete='cascade', index=True)
    asset_id = fields.Many2one(
        'assetflow.asset', string='Asset', required=True,
        ondelete='cascade', index=True)
    asset_tag = fields.Char(related='asset_id.asset_tag', store=True)
    serial_number = fields.Char(related='asset_id.serial_number', store=True)
    expected_holder_id = fields.Many2one(
        'res.users', related='asset_id.current_holder_id', store=True,
        string='Expected Holder')
    expected_location = fields.Char(
        related='asset_id.location', string='Expected Location')

    result = fields.Selection(
        [('pending', 'To Check'),
         ('verified', 'Verified'),
         ('missing', 'Missing'),
         ('damaged', 'Damaged')],
        default='pending', required=True, index=True)
    auditor_id = fields.Many2one('res.users', string='Checked By', readonly=True)
    check_date = fields.Datetime(readonly=True)
    actual_location = fields.Char(
        help="Where the asset was actually found, if it moved.")
    notes = fields.Text()
    cycle_state = fields.Selection(
        related='cycle_id.state', string='Cycle State', store=True)
    company_id = fields.Many2one(
        'res.company', related='cycle_id.company_id', store=True)

    _sql_constraints = [
        ('asset_cycle_uniq', 'unique(cycle_id, asset_id)',
         'This asset is already listed in that audit cycle.'),
    ]

    # ------------------------------------------------------------------
    # Checks
    # ------------------------------------------------------------------
    def _check_auditor_rights(self):
        user = self.env.user
        if user.has_group('assetflow.group_assetflow_manager'):
            return
        for line in self:
            if user not in line.cycle_id.auditor_ids:
                raise UserError(_(
                    "You are not an auditor on '%s'.", line.cycle_id.name))

    def _record_result(self, result):
        self._check_auditor_rights()
        for line in self:
            if line.cycle_id.state not in ('open', 'discrepancy_found'):
                raise UserError(_(
                    "'%s' is not running — its lines cannot be edited.",
                    line.cycle_id.name))
            line.write({
                'result': result,
                'auditor_id': self.env.user.id,
                'check_date': fields.Datetime.now(),
            })
        self.mapped('cycle_id')._refresh_discrepancy_state()
        return True

    def action_mark_verified(self):
        return self._record_result('verified')

    def action_mark_missing(self):
        return self._record_result('missing')

    def action_mark_damaged(self):
        return self._record_result('damaged')

    def write(self, vals):
        # Keep inline (list-view) edits honest: stamp the auditor, block edits
        # on closed cycles, and refresh the parent's discrepancy state.
        if 'result' in vals and not self.env.context.get('audit_line_workflow'):
            for line in self:
                if line.cycle_id.state == 'closed':
                    raise UserError(_(
                        "'%s' is closed — its findings are frozen.",
                        line.cycle_id.name))
            vals.setdefault('auditor_id', self.env.user.id)
            vals.setdefault('check_date', fields.Datetime.now())
        res = super().write(vals)
        if 'result' in vals:
            self.mapped('cycle_id')._refresh_discrepancy_state()
        return res

    @api.depends('asset_id', 'cycle_id')
    def _compute_display_name(self):
        for line in self:
            line.display_name = line.asset_id.display_name or ''

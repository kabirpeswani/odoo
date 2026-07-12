# -*- coding: utf-8 -*-
"""The AssetFlow audit trail.

``mail`` is deliberately not a dependency, so there is no chatter to lean on.
Every model that records something worth explaining inherits
``assetflow.log.mixin`` and calls ``_log()`` on each meaningful transition —
the same discipline the lifecycle funnel in ``asset._set_state`` already
follows.

Entries are append-only. They are written with ``sudo`` (the actor is rarely
allowed to write the record they are acting on) and the access rules grant
nobody write or unlink, so a trail can be read but never rewritten. That
one-way property is the entire point: a log you can edit proves nothing.
"""

from odoo import _, api, fields, models

# Every model that inherits the mixin, and can therefore appear in the trail.
LOGGED_MODELS = [
    ('assetflow.asset', 'Asset'),
    ('assetflow.asset.allocation', 'Allocation / Transfer'),
    ('assetflow.resource.booking', 'Resource Booking'),
    ('assetflow.maintenance', 'Maintenance Request'),
    ('assetflow.audit.cycle', 'Audit Cycle'),
    ('assetflow.department', 'Department'),
]

TYPE_COLORS = {
    'lifecycle': 4,     # blue
    'allocation': 10,   # green
    'maintenance': 2,   # orange
    'audit': 9,         # dark red
    'booking': 3,       # yellow
    'system': 8,        # grey
}


class AssetflowLog(models.Model):
    _name = 'assetflow.log'
    _description = 'AssetFlow Activity Log'
    _order = 'create_date desc, id desc'
    _rec_name = 'body'

    res_model = fields.Selection(
        LOGGED_MODELS, string='Record Type', required=True, index=True)
    res_id = fields.Integer(required=True, index=True)
    res_name = fields.Char(string='Record')
    record_ref = fields.Reference(
        LOGGED_MODELS, string='Open Record', compute='_compute_record_ref',
        help="Jump to the record this entry was written against.")

    body = fields.Text(string='Entry', required=True)
    author_id = fields.Many2one(
        'res.users', string='Author', required=True,
        default=lambda self: self.env.user)
    log_type = fields.Selection(
        [('lifecycle', 'Lifecycle'),
         ('allocation', 'Allocation'),
         ('maintenance', 'Maintenance'),
         ('audit', 'Audit'),
         ('booking', 'Booking'),
         ('system', 'System')],
        default='system', required=True, index=True)
    color = fields.Integer(compute='_compute_color')

    # -- notification framing (Screen 10) --------------------------------
    notif_category = fields.Selection(
        [('alert', 'Alert'),
         ('approval', 'Approval'),
         ('booking', 'Booking'),
         ('other', 'Other')],
        string='Category', compute='_compute_notif_category',
        store=True, index=True,
        help="Which notification tab this entry belongs under.")
    icon = fields.Char(compute='_compute_notif_category', store=True)
    time_ago = fields.Char(
        string='When', compute='_compute_time_ago',
        help="Relative age, e.g. '2m ago'. Never stored: it is derived from "
             "now(), which moves on its own.")

    # Words that mean "something needs a human to look at it".
    _ALERT_WORDS = ('overdue', 'missing', 'damaged', 'lost', 'discrepanc',
                    'conflict', 'rejected')
    _APPROVAL_WORDS = ('approved', 'requested', 'transferred', 'handed over',
                       'submitted')

    @api.depends('log_type', 'body')
    def _compute_notif_category(self):
        for entry in self:
            body = (entry.body or '').lower()
            if entry.log_type == 'booking':
                category, icon = 'booking', 'fa-calendar'
            elif any(word in body for word in self._ALERT_WORDS):
                category, icon = 'alert', 'fa-exclamation-triangle'
            elif any(word in body for word in self._APPROVAL_WORDS):
                category, icon = 'approval', 'fa-check-circle'
            elif entry.log_type == 'audit':
                category, icon = 'alert', 'fa-clipboard'
            elif entry.log_type == 'maintenance':
                category, icon = 'approval', 'fa-wrench'
            else:
                category, icon = 'other', 'fa-circle-o'
            entry.notif_category = category
            entry.icon = icon

    def _compute_time_ago(self):
        now = fields.Datetime.now()
        for entry in self:
            if not entry.create_date:
                entry.time_ago = ''
                continue
            seconds = (now - entry.create_date).total_seconds()
            minutes, hours = seconds / 60, seconds / 3600
            days = seconds / 86400
            if minutes < 1:
                entry.time_ago = _("just now")
            elif minutes < 60:
                entry.time_ago = _("%sm ago", int(minutes))
            elif hours < 24:
                entry.time_ago = _("%sh ago", int(hours))
            elif days < 7:
                entry.time_ago = _("%sd ago", int(days))
            else:
                entry.time_ago = _("%sw ago", int(days / 7))

    @api.depends('res_model', 'res_id')
    def _compute_record_ref(self):
        for entry in self:
            entry.record_ref = (
                '%s,%s' % (entry.res_model, entry.res_id)
                if entry.res_model and entry.res_id else False)

    @api.depends('log_type')
    def _compute_color(self):
        for entry in self:
            entry.color = TYPE_COLORS.get(entry.log_type, 0)

    @api.model
    def _group_expand_type(self, types, domain, order=None):
        return [key for key, _label in self._fields['log_type'].selection]


class AssetflowLogMixin(models.AbstractModel):
    _name = 'assetflow.log.mixin'
    _description = 'AssetFlow Log Mixin'

    # Named 'activity_log_ids' rather than the obvious 'log_ids':
    # assetflow.maintenance already owns a 'log_ids' (its technician work
    # logs), and a mixin field of the same name is silently shadowed by it.
    activity_log_ids = fields.One2many(
        'assetflow.log', string='History', compute='_compute_activity_log_ids')
    activity_log_count = fields.Integer(compute='_compute_activity_log_ids')

    def _compute_activity_log_ids(self):
        Log = self.env['assetflow.log']
        for record in self:
            # Searched *without* sudo on purpose: the record rules then filter
            # the trail down to what this user is allowed to see, instead of
            # handing the form ids it will raise an AccessError trying to read.
            logs = Log.search([
                ('res_model', '=', record._name),
                ('res_id', '=', record.id),
            ])
            record.activity_log_ids = logs
            record.activity_log_count = len(logs)

    def _log(self, body, log_type='system'):
        """Append one entry to the trail for each record in ``self``."""
        entries = self.env['assetflow.log'].sudo()
        for record in self:
            entries.create({
                'res_model': record._name,
                'res_id': record.id,
                'res_name': record.display_name or str(record.id),
                'body': body,
                'author_id': self.env.user.id,
                'log_type': log_type,
            })
        return True

    def action_view_log(self):
        """Open this record's slice of the trail."""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('History — %s', self.display_name),
            'res_model': 'assetflow.log',
            'view_mode': 'tree,form',
            'domain': [('res_model', '=', self._name), ('res_id', '=', self.id)],
        }

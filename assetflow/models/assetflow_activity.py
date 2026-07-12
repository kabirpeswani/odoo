# -*- coding: utf-8 -*-
"""Screen 10 — Activity Logs & Notifications.

The activity feed is built on ``assetflow.log``, which every model already
writes to through ``assetflow.log.mixin._log()``. Nothing here changes how
those records are produced; this module only makes them *addressable*.

A log line says who did something. A notification also needs to know *who it
concerns* — "Laptop AF-0014 assigned to Priya" is a notification for Priya,
not for the manager who clicked Approve. That recipient is never stored on the
log, but it can always be resolved from the record the log points at, so
``user_id`` below derives it once, at write time, and stores it. That is what
lets "My Notifications" exist without touching a single existing ``_log()``
call site.
"""

from odoo import api, fields, models

# Where to find the "person this concerns" on each source record.
CONCERNS_FIELD = {
    'assetflow.asset.allocation': 'employee_id',
    'assetflow.resource.booking': 'user_id',
    'assetflow.maintenance': 'requester_id',
    'assetflow.asset': 'current_holder_id',
}


class AssetflowLog(models.Model):
    _inherit = 'assetflow.log'

    user_id = fields.Many2one(
        'res.users', string='Concerns', compute='_compute_user_id',
        store=True, index=True,
        help="The user this activity is about — the assignee of an "
             "allocation, the person who booked a resource, the requester of "
             "a maintenance job. Drives 'My Notifications'.")

    @api.depends('res_model', 'res_id')
    def _compute_user_id(self):
        # Group by model so each source table is read once instead of once
        # per log line.
        by_model = {}
        for log in self:
            log.user_id = False
            if log.res_model in CONCERNS_FIELD and log.res_id:
                by_model.setdefault(log.res_model, []).append(log)

        for model, logs in by_model.items():
            field = CONCERNS_FIELD[model]
            records = self.env[model].sudo().browse(
                [log.res_id for log in logs]).exists()
            owner = {record.id: record[field] for record in records}
            for log in logs:
                log.user_id = owner.get(log.res_id, False)

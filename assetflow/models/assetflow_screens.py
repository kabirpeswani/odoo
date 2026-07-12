# -*- coding: utf-8 -*-
"""The three composed screens: Dashboard, Organization Setup and Reports.

Odoo has no native "put a KPI row, a banner and a feed on one page" view, so
each of these is a transient model whose fields are computed on open. Nothing
here is persisted: the records exist for the lifetime of the page.

The two charts on the Reports screen are rendered server-side as SVG rather
than through a JavaScript charting widget. An SVG cannot fail to load, cannot
depend on an asset bundle, and shows up identically in a screenshot — which is
what a report is for. The pivot/graph views on the underlying models are still
there for anyone who wants to slice the data interactively.
"""

import base64
import csv
import io
from datetime import timedelta

from odoo import _, api, fields, models

# ---------------------------------------------------------------------------
# Tiny SVG chart helpers. Deliberately dependency-free.
# ---------------------------------------------------------------------------
CHART_W, CHART_H, PAD = 460, 190, 28


def _esc(text):
    return (str(text).replace('&', '&amp;').replace('<', '&lt;')
            .replace('>', '&gt;'))


def _bar_chart(pairs, color='#714b67'):
    """pairs: [(label, value), ...] -> vertical bar chart."""
    if not pairs:
        return '<p class="text-muted">No data yet.</p>'
    top = max(v for _l, v in pairs) or 1
    inner_w = CHART_W - 2 * PAD
    inner_h = CHART_H - 2 * PAD
    slot = inner_w / len(pairs)
    bar_w = min(46.0, slot * 0.6)
    parts = [
        '<svg viewBox="0 0 %s %s" width="100%%" height="%s" '
        'xmlns="http://www.w3.org/2000/svg" role="img">' % (CHART_W, CHART_H, CHART_H),
        '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#d8cfda"/>'
        % (PAD, CHART_H - PAD, CHART_W - PAD, CHART_H - PAD),
    ]
    for i, (label, value) in enumerate(pairs):
        h = (value / top) * inner_h if top else 0
        x = PAD + slot * i + (slot - bar_w) / 2
        y = CHART_H - PAD - h
        parts.append(
            '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="3" fill="%s"/>'
            % (x, y, bar_w, h, color))
        parts.append(
            '<text x="%.1f" y="%.1f" font-size="10" text-anchor="middle" '
            'fill="#5c5062">%s</text>'
            % (x + bar_w / 2, y - 4, value))
        parts.append(
            '<text x="%.1f" y="%s" font-size="9" text-anchor="middle" '
            'fill="#8a7f90">%s</text>'
            % (x + bar_w / 2, CHART_H - PAD + 13, _esc(label)[:11]))
    parts.append('</svg>')
    return ''.join(parts)


def _line_chart(pairs, color='#714b67'):
    """pairs: [(label, value), ...] -> line chart with marked points."""
    if not pairs:
        return '<p class="text-muted">No data yet.</p>'
    top = max(v for _l, v in pairs) or 1
    inner_w = CHART_W - 2 * PAD
    inner_h = CHART_H - 2 * PAD
    step = inner_w / max(len(pairs) - 1, 1)
    points = []
    for i, (_label, value) in enumerate(pairs):
        x = PAD + step * i
        y = CHART_H - PAD - (value / top) * inner_h
        points.append((x, y))

    parts = [
        '<svg viewBox="0 0 %s %s" width="100%%" height="%s" '
        'xmlns="http://www.w3.org/2000/svg" role="img">' % (CHART_W, CHART_H, CHART_H),
        '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#d8cfda"/>'
        % (PAD, CHART_H - PAD, CHART_W - PAD, CHART_H - PAD),
        '<polyline fill="none" stroke="%s" stroke-width="2" points="%s"/>'
        % (color, ' '.join('%.1f,%.1f' % p for p in points)),
    ]
    for i, (x, y) in enumerate(points):
        parts.append('<circle cx="%.1f" cy="%.1f" r="3" fill="%s"/>' % (x, y, color))
        parts.append(
            '<text x="%.1f" y="%.1f" font-size="10" text-anchor="middle" '
            'fill="#5c5062">%s</text>' % (x, y - 7, pairs[i][1]))
        parts.append(
            '<text x="%.1f" y="%s" font-size="9" text-anchor="middle" '
            'fill="#8a7f90">%s</text>'
            % (x, CHART_H - PAD + 13, _esc(pairs[i][0])))
    parts.append('</svg>')
    return ''.join(parts)


# ===========================================================================
#  SCREEN 2 — Dashboard
# ===========================================================================
class AssetflowDashboard(models.TransientModel):
    _name = 'assetflow.dashboard'
    _description = "AssetFlow Dashboard"

    # These are filled by default_get, not by a compute.
    #
    # The dashboard is always opened as a *new* transient record, and a
    # non-stored compute with no @api.depends is never evaluated on a new
    # record — the form would render a wall of zeroes. default_get is the hook
    # that is guaranteed to run when the form opens, so the figures are
    # gathered there.
    available_count = fields.Integer(readonly=True)
    allocated_count = fields.Integer(readonly=True)
    maintenance_count = fields.Integer(readonly=True)
    active_booking_count = fields.Integer(readonly=True)
    pending_transfer_count = fields.Integer(readonly=True)
    upcoming_return_count = fields.Integer(readonly=True)

    overdue_count = fields.Integer(readonly=True)
    overdue_message = fields.Char(readonly=True)
    activity_html = fields.Html(readonly=True, sanitize=False)

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        for key, value in self._board_values().items():
            if key in fields_list:
                res[key] = value
        return res

    @api.model
    def _board_values(self):
        Asset = self.env['assetflow.asset']
        Alloc = self.env['assetflow.asset.allocation']
        Booking = self.env['assetflow.resource.booking']
        today = fields.Date.context_today(self)
        horizon = today + timedelta(days=7)

        overdue = Alloc.search_count([
            ('state', 'in', ('approved', 'overdue')),
            ('return_date', '=', False),
            ('expected_return_date', '<', today),
        ])
        return {
            'available_count': Asset.search_count([('state', '=', 'available')]),
            'allocated_count': Asset.search_count([('state', '=', 'allocated')]),
            'maintenance_count': Asset.search_count(
                [('state', '=', 'maintenance')]),
            'active_booking_count': Booking.search_count(
                [('state', 'in', ('upcoming', 'ongoing'))]),
            'pending_transfer_count': Alloc.search_count([
                ('is_transfer', '=', True),
                ('state', 'in', ('draft', 'requested'))]),
            # "Upcoming returns" = live allocations due back inside the week.
            'upcoming_return_count': Alloc.search_count([
                ('state', 'in', ('approved', 'overdue')),
                ('return_date', '=', False),
                ('expected_return_date', '!=', False),
                ('expected_return_date', '<=', horizon),
            ]),
            'overdue_count': overdue,
            'overdue_message': _(
                "%s asset(s) overdue for return — flagged for follow-up.",
                overdue) if overdue else '',
            'activity_html': self._activity_html(),
        }

    @api.model
    def _activity_html(self):
        entries = self.env['assetflow.log'].search([], limit=8)
        if not entries:
            return '<p class="text-muted">Nothing has happened yet.</p>'
        # <i> is not a void element: "<i .../>" is parsed as an *unclosed*
        # opening tag, so every following row would nest inside the previous
        # row's icon and the icons would pile up down the feed. Close it.
        rows = ''.join(
            '<li class="list-group-item d-flex justify-content-between '
            'align-items-center px-0">'
            '<span><i class="fa %s me-2 text-muted" title="%s"></i>%s</span>'
            '<small class="text-muted ms-3 text-nowrap">%s</small></li>'
            % (_esc(e.icon or 'fa-circle-o'), _esc(e.log_type or ''),
               _esc(e.body), _esc(e.time_ago))
            for e in entries)
        return '<ul class="list-group list-group-flush">%s</ul>' % rows

    # -- quick actions ---------------------------------------------------
    def _open(self, xmlid, name, extra=None):
        action = self.env['ir.actions.act_window']._for_xml_id(xmlid)
        action.update(extra or {})
        action['name'] = name
        return action

    def action_register_asset(self):
        return self._open('assetflow.action_asset', _('Register Asset'),
                          {'view_mode': 'form', 'views': [(False, 'form')]})

    def action_book_resource(self):
        return self._open('assetflow.action_resource_booking', _('Book Resource'),
                          {'view_mode': 'form', 'views': [(False, 'form')]})

    def action_raise_request(self):
        return self._open('assetflow.action_maintenance', _('Raise Request'),
                          {'view_mode': 'form', 'views': [(False, 'form')]})

    def action_view_overdue(self):
        action = self.env['ir.actions.act_window']._for_xml_id(
            'assetflow.action_asset_allocation')
        action['name'] = _('Overdue Returns')
        action['domain'] = [
            ('state', 'in', ('approved', 'overdue')),
            ('return_date', '=', False),
            ('expected_return_date', '<', fields.Date.context_today(self)),
        ]
        return action


# ===========================================================================
#  SCREEN 3 — Organization Setup (admin only)
# ===========================================================================
class AssetflowOrgSetup(models.Model):
    """The Organization Setup page.

    A regular model with exactly one record, not a TransientModel, and the two
    editable tabs are One2many rather than Many2many. That is the whole point:
    on a Many2many, "Add a line" opens a dialog to *pick an existing* record —
    it offers "No records found!" and buries the New button in the dialog
    footer, which reads as broken when what you wanted was to create the
    department you do not have yet. A One2many creates inline, which is what
    the screen is for.

    That in turn is why this is not transient: One2many needs a real record on
    the other end of the foreign key to point at.
    """
    _name = 'assetflow.org.setup'
    _description = "AssetFlow Organization Setup"

    name = fields.Char(default='Organization Setup', readonly=True)

    department_ids = fields.One2many(
        'assetflow.department', 'setup_id', string='Departments')
    category_ids = fields.One2many(
        'assetflow.asset.category', 'setup_id', string='Categories')

    # Employees are never *created* here — an administrator only raises an
    # existing user's role — so this stays a computed list of every internal
    # user. A compute is safe now that the record is real: on a new transient
    # record it would never have run.
    employee_ids = fields.Many2many(
        'res.users', compute='_compute_employee_ids', string='Employees')

    def _compute_employee_ids(self):
        users = self.env['res.users'].search([('share', '=', False)])
        for setup in self:
            setup.employee_ids = users


# ===========================================================================
#  SCREEN 9 — Reports & Analytics
# ===========================================================================
class AssetflowAnalytics(models.TransientModel):
    _name = 'assetflow.analytics'
    _description = "AssetFlow Reports & Analytics"

    # Filled by default_get, for the same reason as the dashboard above: a
    # non-stored compute never runs on the new transient record the form opens.
    utilization_chart = fields.Html(readonly=True, sanitize=False)
    maintenance_chart = fields.Html(readonly=True, sanitize=False)
    most_used_html = fields.Html(readonly=True, sanitize=False)
    due_maintenance_html = fields.Html(readonly=True, sanitize=False)
    idle_html = fields.Html(readonly=True, sanitize=False)

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        values = dict(self._chart_values(), **self._insight_values())
        for key, value in values.items():
            if key in fields_list:
                res[key] = value
        return res

    # -- charts ----------------------------------------------------------
    @api.model
    def _chart_values(self):
        # Card A: utilization = live allocations per department.
        alloc_data = self.env['assetflow.asset.allocation']._read_group(
            [('state', 'in', ('approved', 'overdue')),
             ('department_id', '!=', False)],
            groupby=['department_id'], aggregates=['__count'])
        utilization = [(dept.name, count) for dept, count in alloc_data][:6]

        # Card B: maintenance frequency over the last six months.
        today = fields.Date.context_today(self)
        Maintenance = self.env['assetflow.maintenance']
        months = []
        for offset in range(5, -1, -1):
            # First day of the month, `offset` months back.
            year, month = today.year, today.month - offset
            while month <= 0:
                month += 12
                year -= 1
            start = today.replace(year=year, month=month, day=1)
            end = (start.replace(year=year + 1, month=1, day=1)
                   if month == 12
                   else start.replace(month=month + 1, day=1))
            count = Maintenance.search_count([
                ('request_date', '>=', fields.Datetime.to_datetime(start)),
                ('request_date', '<', fields.Datetime.to_datetime(end)),
            ])
            months.append((start.strftime('%b'), count))

        return {
            'utilization_chart': _bar_chart(utilization),
            'maintenance_chart': _line_chart(months),
        }

    # -- insight lists ---------------------------------------------------
    @api.model
    def _insight_list(self, rows, empty):
        if not rows:
            return '<p class="text-muted mb-0">%s</p>' % _esc(empty)
        items = ''.join(
            '<li class="px-0 py-1"><b>%s</b>: %s</li>' % (_esc(title), _esc(detail))
            for title, detail in rows)
        return '<ul class="list-unstyled mb-0">%s</ul>' % items

    @api.model
    def _insight_values(self):
        Asset = self.env['assetflow.asset']
        Booking = self.env['assetflow.resource.booking']
        today = fields.Date.context_today(self)
        month_start = fields.Datetime.to_datetime(today.replace(day=1))

        # Most used: bookings booked this month, busiest first.
        booking_data = Booking._read_group(
            [('state', '!=', 'cancelled'), ('start_time', '>=', month_start)],
            groupby=['asset_id'], aggregates=['__count'])
        busiest = sorted(booking_data, key=lambda r: r[1], reverse=True)[:3]
        most_used = [
            (asset.display_name,
             _("%s booking(s) this month", count))
            for asset, count in busiest
        ]

        # Due for maintenance, or old enough to be retired.
        due = Asset.search([
            ('next_service_date', '!=', False),
            ('state', 'not in', ('retired', 'disposed')),
        ], order='next_service_date')
        attention = [
            (asset.display_name,
             _("service due in %s day(s)", asset.service_due_days)
             if asset.service_due_days >= 0
             else _("service overdue by %s day(s)", abs(asset.service_due_days)))
            for asset in due[:3]
        ]
        ageing = Asset.search([('state', 'not in', ('retired', 'disposed'))])
        attention += [
            (asset.display_name,
             _("%.0f years old — nearing retirement", asset.age_years))
            for asset in ageing.filtered('nearing_retirement')[:3]
        ]

        # Idle: nothing has happened to them in 60+ days.
        idle = Asset.search([
            ('state', 'in', ('available', 'reserved')),
        ]).filtered(lambda a: a.idle_days >= 60).sorted(
            key=lambda a: a.idle_days, reverse=True)
        idle_rows = [
            (asset.display_name, _("unused %s days", asset.idle_days))
            for asset in idle[:5]
        ]

        return {
            'most_used_html': self._insight_list(
                most_used, _("No bookings recorded this month.")),
            'due_maintenance_html': self._insight_list(
                attention, _("Nothing due for service or retirement.")),
            'idle_html': self._insight_list(
                idle_rows, _("No asset has been idle for 60 days or more.")),
        }

    # -- export ----------------------------------------------------------
    def action_export_report(self):
        """Export the full asset register, with its analytics, as a CSV."""
        self.ensure_one()
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow([
            'Asset Tag', 'Name', 'Category', 'Status', 'Condition', 'Location',
            'Held By', 'Department', 'Acquisition Date', 'Acquisition Cost',
            'Age (Years)', 'Idle (Days)', 'Bookings This Month',
            'Next Service', 'Nearing Retirement',
        ])
        for asset in self.env['assetflow.asset'].search([], order='asset_tag'):
            writer.writerow([
                asset.asset_tag, asset.name,
                asset.category_id.name or '',
                dict(asset._fields['state'].selection).get(asset.state, ''),
                dict(asset._fields['condition'].selection).get(asset.condition, ''),
                asset.location or '',
                asset.current_holder_id.name or '',
                asset.current_department_id.name or '',
                asset.acquisition_date or '',
                asset.acquisition_cost,
                round(asset.age_years, 1),
                asset.idle_days,
                asset.bookings_this_month,
                asset.next_service_date or '',
                'Yes' if asset.nearing_retirement else 'No',
            ])

        filename = 'assetflow-report-%s.csv' % fields.Date.context_today(self)
        attachment = self.env['ir.attachment'].create({
            'name': filename,
            'type': 'binary',
            'datas': base64.b64encode(buffer.getvalue().encode('utf-8')),
            'mimetype': 'text/csv',
        })
        return {
            'type': 'ir.actions.act_url',
            'url': '/web/content/%s?download=true' % attachment.id,
            'target': 'self',
        }

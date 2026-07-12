# -*- coding: utf-8 -*-
"""Reporting & analytics helpers (Screens 9 & 10).

This module deliberately touches the existing models only through ``_inherit``
so that the reporting work stays in its own file and does not collide with the
teams owning the asset / booking screens. It adds a handful of *stored,
groupable* fields that the pivot, graph and heatmap views need — nothing here
changes existing behaviour.

    * asset.retirement_date / is_nearing_retirement
        Derived from the category's expected lifetime, so the "assets nearing
        retirement" report has something concrete to filter on.
    * booking.booking_hour / booking_weekday
        The start slot broken down into hour-of-day and day-of-week, which is
        exactly what a "peak usage windows" heatmap pivots on.
"""

from dateutil.relativedelta import relativedelta

from odoo import api, fields, models

# Lifecycle states in which retirement planning no longer makes sense.
_DEAD_STATES = ('lost', 'retired', 'disposed')

# How far ahead (in days) an asset counts as "nearing" retirement.
NEARING_RETIREMENT_WINDOW = 365

WEEKDAYS = [
    ('0', 'Monday'),
    ('1', 'Tuesday'),
    ('2', 'Wednesday'),
    ('3', 'Thursday'),
    ('4', 'Friday'),
    ('5', 'Saturday'),
    ('6', 'Sunday'),
]


class AssetflowAsset(models.Model):
    _inherit = 'assetflow.asset'

    retirement_date = fields.Date(
        compute='_compute_retirement', store=True,
        help="Acquisition date plus the category's expected lifetime. "
             "Informative — it drives the 'nearing retirement' report.")
    is_nearing_retirement = fields.Boolean(
        string='Nearing Retirement', compute='_compute_retirement', store=True,
        help="Still in service and within a year of its expected end of life.")

    @api.depends('acquisition_date', 'category_id.depreciation_years', 'state')
    def _compute_retirement(self):
        today = fields.Date.context_today(self)
        horizon = today + relativedelta(days=NEARING_RETIREMENT_WINDOW)
        for asset in self:
            years = asset.category_id.depreciation_years
            if asset.acquisition_date and years:
                asset.retirement_date = (
                    asset.acquisition_date + relativedelta(years=years))
            else:
                asset.retirement_date = False
            asset.is_nearing_retirement = bool(
                asset.retirement_date
                and asset.state not in _DEAD_STATES
                and asset.retirement_date <= horizon)


class AssetflowResourceBooking(models.Model):
    _inherit = 'assetflow.resource.booking'

    booking_hour = fields.Integer(
        string='Start Hour', compute='_compute_slot_breakdown', store=True,
        help="Hour of the day (0-23, in your timezone) the booking starts — "
             "used by the usage heatmap.")
    booking_weekday = fields.Selection(
        WEEKDAYS, string='Weekday', compute='_compute_slot_breakdown',
        store=True, help="Day of week the booking starts.")

    @api.depends('start_time')
    def _compute_slot_breakdown(self):
        for booking in self:
            if booking.start_time:
                # Convert the stored UTC value into the current user's timezone
                # so the heatmap reflects local working hours.
                local = fields.Datetime.context_timestamp(
                    booking, booking.start_time)
                booking.booking_hour = local.hour
                booking.booking_weekday = str(local.weekday())
            else:
                booking.booking_hour = 0
                booking.booking_weekday = False

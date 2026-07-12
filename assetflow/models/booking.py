from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class AssetFlowBooking(models.Model):
    _name = 'assetflow.booking'
    _description = 'AssetFlow Resource Booking'
    _order = 'start_time desc'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    asset_id = fields.Many2one('assetflow.asset', string='Resource', required=True, tracking=True,
                                domain=[('is_bookable', '=', True)])
    employee_id = fields.Many2one('assetflow.employee', string='Booked By', required=True, tracking=True)
    start_time = fields.Datetime(string='Start Time', required=True, tracking=True)
    end_time = fields.Datetime(string='End Time', required=True, tracking=True)
    status = fields.Selection([
        ('upcoming', 'Upcoming'),
        ('ongoing', 'Ongoing'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ], string='Status', default='upcoming', required=True, tracking=True)
    notes = fields.Text(string='Notes')

    @api.constrains('start_time', 'end_time', 'asset_id')
    def _check_overlap(self):
        for booking in self:
            if booking.start_time >= booking.end_time:
                raise ValidationError(_("Start time must be before end time."))
            domain = [
                ('asset_id', '=', booking.asset_id.id),
                ('status', 'not in', ['cancelled']),
                ('id', '!=', booking.id),
                ('start_time', '<', booking.end_time),
                ('end_time', '>', booking.start_time),
            ]
            overlapping = self.search(domain, limit=1)
            if overlapping:
                raise ValidationError(_(
                    "This time slot overlaps with an existing booking (%s - %s).",
                    overlapping.start_time, overlapping.end_time
                ))

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        for record in records:
            self.env['assetflow.activity.log'].create({
                'user_id': self.env.user.employee_id.id if self.env.user.employee_id else False,
                'user_name': self.env.user.name,
                'action': 'CONFIRM_BOOKING',
                'details': _('Booking created for %s by %s (%s - %s)',
                    record.asset_id.name, record.employee_id.name,
                    record.start_time, record.end_time),
            })
        return records

    def action_cancel(self):
        self.ensure_one()
        self.write({'status': 'cancelled'})
        self.env['assetflow.notification'].create({
            'user_id': self.employee_id.id,
            'title': _('Booking Cancelled'),
            'message': _('Booking for %s (%s - %s) has been cancelled.',
                self.asset_id.name, self.start_time, self.end_time),
            'type': 'warning',
        })
        self.env['assetflow.activity.log'].create({
            'user_id': self.env.user.employee_id.id if self.env.user.employee_id else False,
            'user_name': self.env.user.name,
            'action': 'CANCEL_BOOKING',
            'details': _('Booking for %s by %s cancelled', self.asset_id.name, self.employee_id.name),
        })

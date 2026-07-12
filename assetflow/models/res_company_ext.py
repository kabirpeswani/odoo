# -*- coding: utf-8 -*-
"""Organisation structures: departments and the employee directory.

The employee directory is *not* a separate model: it is a projection of
``res.users`` so that the AssetFlow role and the Odoo access rights can never
drift apart. Roles are mapped 1:1 onto the four AssetFlow security groups and
may only be written by an AssetFlow Administrator (see ``_check_role_grant``).
"""

from odoo import _, api, fields, models
from odoo.exceptions import AccessError, ValidationError

# Ordered from the least to the most privileged. The XML data file declares the
# groups with ``implied_ids`` chaining in the same order, so granting a role
# implicitly grants every role below it.
ROLE_GROUPS = [
    ('employee', 'assetflow.group_assetflow_employee'),
    ('dept_head', 'assetflow.group_assetflow_dept_head'),
    ('manager', 'assetflow.group_assetflow_manager'),
    ('admin', 'assetflow.group_assetflow_admin'),
]


class AssetflowDepartment(models.Model):
    _name = 'assetflow.department'
    _description = 'AssetFlow Department'
    _inherit = ['mail.thread']
    _parent_name = 'parent_id'
    _parent_store = True
    _order = 'complete_name'

    name = fields.Char(required=True, tracking=True)
    code = fields.Char(help="Short code used on reports and audit scopes.")
    complete_name = fields.Char(
        string='Full Path', compute='_compute_complete_name',
        recursive=True, store=True)
    manager_id = fields.Many2one(
        'res.users', string='Department Head',
        domain="[('share', '=', False)]", tracking=True,
        help="Head of department. Automatically granted visibility on every "
             "allocation of this department.")
    parent_id = fields.Many2one(
        'assetflow.department', string='Parent Department',
        ondelete='restrict', index=True)
    parent_path = fields.Char(index=True, unaccent=False)
    child_ids = fields.One2many(
        'assetflow.department', 'parent_id', string='Sub-Departments')
    member_ids = fields.One2many(
        'res.users', 'department_id', string='Members')
    state = fields.Selection(
        [('active', 'Active'), ('inactive', 'Inactive')],
        default='active', required=True, tracking=True)
    company_id = fields.Many2one(
        'res.company', default=lambda self: self.env.company, required=True)

    member_count = fields.Integer(compute='_compute_counts')
    asset_count = fields.Integer(compute='_compute_counts')

    _sql_constraints = [
        ('name_company_uniq', 'unique(name, company_id)',
         'A department with this name already exists in this company.'),
    ]

    @api.depends('name', 'parent_id.complete_name')
    def _compute_complete_name(self):
        for dept in self:
            if dept.parent_id:
                dept.complete_name = '%s / %s' % (
                    dept.parent_id.complete_name, dept.name)
            else:
                dept.complete_name = dept.name

    def _compute_counts(self):
        user_data = self.env['res.users']._read_group(
            [('department_id', 'in', self.ids)],
            groupby=['department_id'], aggregates=['__count'])
        users = {dept.id: count for dept, count in user_data}

        alloc_data = self.env['assetflow.asset.allocation']._read_group(
            [('department_id', 'in', self.ids), ('state', '=', 'approved')],
            groupby=['department_id'], aggregates=['__count'])
        assets = {dept.id: count for dept, count in alloc_data}

        for dept in self:
            dept.member_count = users.get(dept.id, 0)
            dept.asset_count = assets.get(dept.id, 0)

    @api.constrains('parent_id')
    def _check_parent_recursion(self):
        if not self._check_recursion():
            raise ValidationError(
                _("A department cannot be its own ancestor."))

    def action_view_members(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Members of %s', self.name),
            'res_model': 'res.users',
            'view_mode': 'tree,form',
            'domain': [('department_id', '=', self.id)],
            'context': {'default_department_id': self.id},
        }

    def action_view_allocated_assets(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Assets of %s', self.name),
            'res_model': 'assetflow.asset.allocation',
            'view_mode': 'tree,form',
            'domain': [('department_id', '=', self.id),
                       ('state', '=', 'approved')],
        }


class ResUsers(models.Model):
    """Employee directory: name, email, department, role and status."""
    _inherit = 'res.users'

    department_id = fields.Many2one(
        'assetflow.department', string='Department')
    assetflow_role = fields.Selection(
        [('employee', 'Employee'),
         ('dept_head', 'Department Head'),
         ('manager', 'Asset Manager'),
         ('admin', 'Administrator')],
        string='AssetFlow Role',
        compute='_compute_assetflow_role',
        inverse='_inverse_assetflow_role',
        help="Highest AssetFlow role granted to this user. Only an AssetFlow "
             "Administrator may change it.")
    job_title = fields.Char()
    allocation_ids = fields.One2many(
        'assetflow.asset.allocation', 'employee_id', string='Allocations')
    allocated_asset_count = fields.Integer(compute='_compute_asset_counts')
    booking_count = fields.Integer(compute='_compute_asset_counts')

    @property
    def SELF_READABLE_FIELDS(self):
        return super().SELF_READABLE_FIELDS + [
            'department_id', 'assetflow_role', 'job_title',
            'allocated_asset_count', 'booking_count',
        ]

    @api.depends('groups_id')
    def _compute_assetflow_role(self):
        # Resolve from the most to the least privileged: implied_ids means an
        # admin also carries the employee group.
        xmlid_to_role = {xmlid: role for role, xmlid in ROLE_GROUPS}
        groups = {
            xmlid: self.env.ref(xmlid, raise_if_not_found=False)
            for xmlid in xmlid_to_role
        }
        for user in self:
            user.assetflow_role = False
            for role, xmlid in reversed(ROLE_GROUPS):
                group = groups.get(xmlid)
                if group and group in user.groups_id:
                    user.assetflow_role = role
                    break

    def _inverse_assetflow_role(self):
        for user in self:
            if not user.assetflow_role:
                continue
            target = self.env.ref('assetflow.%s' % {
                'employee': 'group_assetflow_employee',
                'dept_head': 'group_assetflow_dept_head',
                'manager': 'group_assetflow_manager',
                'admin': 'group_assetflow_admin',
            }[user.assetflow_role])
            others = self.env['res.groups']
            for _role, xmlid in ROLE_GROUPS:
                group = self.env.ref(xmlid, raise_if_not_found=False)
                if group and group != target:
                    others |= group
            # Drop every AssetFlow group, then grant the elected one. The
            # implied_ids chain re-adds the lower-privilege groups.
            user.sudo().write({
                'groups_id': [(3, gid) for gid in others.ids] + [(4, target.id)],
            })

    def _check_role_grant(self, vals):
        """Guard against self-elevation: only an AssetFlow admin may hand out
        AssetFlow roles / security groups."""
        if self.env.su or self.env.context.get('assetflow_bypass_role_guard'):
            return
        touches_roles = 'assetflow_role' in vals or 'groups_id' in vals
        if not touches_roles:
            return
        if not self.env.user.has_group('assetflow.group_assetflow_admin'):
            raise AccessError(_(
                "Only an AssetFlow Administrator can assign user roles or "
                "security groups. Please contact your administrator."))

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            self._check_role_grant(vals)
            # Signup / manual creation always lands on the Employee role.
            vals.setdefault('assetflow_role', 'employee')
        return super().create(vals_list)

    def write(self, vals):
        self._check_role_grant(vals)
        return super().write(vals)

    def _compute_asset_counts(self):
        alloc_data = self.env['assetflow.asset.allocation']._read_group(
            [('employee_id', 'in', self.ids),
             ('state', 'in', ('approved', 'overdue'))],
            groupby=['employee_id'], aggregates=['__count'])
        allocs = {user.id: count for user, count in alloc_data}

        booking_data = self.env['assetflow.resource.booking']._read_group(
            [('user_id', 'in', self.ids),
             ('state', 'in', ('upcoming', 'ongoing'))],
            groupby=['user_id'], aggregates=['__count'])
        bookings = {user.id: count for user, count in booking_data}

        for user in self:
            user.allocated_asset_count = allocs.get(user.id, 0)
            user.booking_count = bookings.get(user.id, 0)

    def action_view_my_allocations(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Allocations'),
            'res_model': 'assetflow.asset.allocation',
            'view_mode': 'tree,form',
            'domain': [('employee_id', '=', self.id)],
            'context': {'default_employee_id': self.id},
        }

    def action_view_my_bookings(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Bookings'),
            'res_model': 'assetflow.resource.booking',
            'view_mode': 'calendar,tree,form',
            'domain': [('user_id', '=', self.id)],
            'context': {'default_user_id': self.id},
        }

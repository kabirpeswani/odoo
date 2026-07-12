from odoo import http
from odoo.http import request
from odoo import fields
import json
from datetime import datetime


class AssetFlowAPI(http.Controller):

    def _get_employee(self):
        user = request.env.user
        return request.env['assetflow.employee'].sudo().search([('user_id', '=', user.id)], limit=1)

    def _json_response(self, data, status=200):
        return request.make_response(
            json.dumps(data, default=str),
            headers=[('Content-Type', 'application/json')],
            status=status
        )

    # ─── Dashboard ────────────────────────────────────────────────
    @http.route('/api/assetflow/dashboard', type='http', auth='user', methods=['GET', 'POST'], csrf=False)
    def dashboard(self, **kwargs):
        Asset = request.env['assetflow.asset'].sudo()
        Booking = request.env['assetflow.booking'].sudo()
        Maintenance = request.env['assetflow.maintenance'].sudo()
        Transfer = request.env['assetflow.transfer'].sudo()
        Notification = request.env['assetflow.notification'].sudo()
        Log = request.env['assetflow.activity.log'].sudo()
        Employee = request.env['assetflow.employee'].sudo()
        Category = request.env['assetflow.category'].sudo()
        Department = request.env['assetflow.department'].sudo()

        if request.httprequest.method == 'GET':
            assets = Asset.search([])
            today_str = fields.Date.today()

            overdue_assets = Asset.search([
                ('expected_return_date', '<', today_str),
                ('status', '=', 'allocated'),
            ])

            upcoming_assets = Asset.search([
                ('expected_return_date', '>=', today_str),
                ('status', '=', 'allocated'),
            ], limit=5)

            stats = {
                'assets_available': Asset.search_count([('status', '=', 'available')]),
                'assets_allocated': Asset.search_count([('status', '=', 'allocated')]),
                'active_bookings': Booking.search_count([('status', 'in', ('upcoming', 'ongoing'))]),
                'maintenance_today': Maintenance.search_count([('status', 'in', ('approved', 'technician_assigned', 'in_progress'))]),
                'pending_transfers': Transfer.search_count([('status', '=', 'pending')]),
                'upcoming_returns': len(upcoming_assets),
            }

            return self._json_response({
                'stats': stats,
                'overdue_returns': [{
                    'id': a.asset_tag,
                    'name': a.name,
                    'asset_tag': a.asset_tag,
                    'holder_name': a.current_holder_id.name or '',
                    'department_name': a.current_department_id.name or '',
                    'days_overdue': (fields.Date.today() - a.expected_return_date).days,
                } for a in overdue_assets],
                'upcoming_returns_list': [{
                    'id': a.asset_tag,
                    'name': a.name,
                    'asset_tag': a.asset_tag,
                    'holder_name': a.current_holder_id.name or '',
                } for a in upcoming_assets],
                'notifications': [{
                    'id': n.id,
                    'title': n.title,
                    'message': n.message,
                    'type': n.type,
                    'is_read': n.is_read,
                    'timestamp': str(n.timestamp),
                } for n in Notification.search([], limit=10)],
                'recent_logs': [{
                    'id': l.id,
                    'user_name': l.user_name,
                    'action': l.action,
                    'details': l.details,
                    'timestamp': str(l.timestamp),
                } for l in Log.search([], limit=10)],
                'assets': self._serialize_assets(assets),
            })

        else:
            payload = json.loads(request.httprequest.data)
            action = payload.get('action')

            if action == 'REGISTER_ASSET':
                asset = Asset.create({
                    'name': payload['name'],
                    'category_id': payload.get('categoryId'),
                    'serial_number': payload.get('serialNumber', ''),
                    'acquisition_cost': payload.get('acquisitionCost', 0),
                    'condition': payload.get('condition', 'good'),
                    'location': payload.get('location', ''),
                    'is_bookable': payload.get('isBookable', False),
                })
                Log.create({
                    'user_name': request.env.user.name,
                    'action': 'REGISTER_ASSET',
                    'details': f'Asset {asset.asset_tag} registered',
                })
                return self._json_response({'success': True, 'asset': asset.asset_tag})

            elif action == 'BOOK_RESOURCE':
                booking = Booking.create({
                    'asset_id': payload['assetId'],
                    'employee_id': payload['employeeId'],
                    'start_time': payload['startTime'],
                    'end_time': payload['endTime'],
                })
                return self._json_response({'success': True, 'booking_id': booking.id})

            elif action == 'RAISE_MAINTENANCE':
                maint = Maintenance.create({
                    'asset_id': payload['assetId'],
                    'issue_description': payload['issueDescription'],
                    'priority': payload.get('priority', 'medium'),
                    'requested_by_id': self._get_employee().id,
                })
                return self._json_response({'success': True, 'maintenance_id': maint.id})

    # ─── Setup ────────────────────────────────────────────────────
    @http.route('/api/assetflow/setup', type='http', auth='user', methods=['GET', 'POST'], csrf=False)
    def setup(self, **kwargs):
        Department = request.env['assetflow.department'].sudo()
        Category = request.env['assetflow.category'].sudo()
        Employee = request.env['assetflow.employee'].sudo()
        Log = request.env['assetflow.activity.log'].sudo()

        if request.httprequest.method == 'GET':
            return self._json_response({
                'departments': [{'id': d.id, 'name': d.name, 'headId': d.head_id.id if d.head_id else None,
                                 'parentDepartmentId': d.parent_department_id.id if d.parent_department_id else None,
                                 'status': 'Active' if d.status == 'active' else 'Inactive'}
                                for d in Department.search([])],
                'categories': [{'id': c.id, 'name': c.name} for c in Category.search([])],
                'employees': [{'id': e.id, 'name': e.name, 'email': e.email,
                               'departmentId': e.department_id.id, 'role': dict(Employee._fields['role'].selection).get(e.role, e.role),
                               'status': 'Active' if e.status == 'active' else 'Inactive'}
                              for e in Employee.search([])],
            })

        payload = json.loads(request.httprequest.data)
        action = payload.get('action')

        if action == 'CREATE_DEPARTMENT':
            dept = Department.create({
                'name': payload['name'],
                'head_id': payload.get('headId'),
                'parent_department_id': payload.get('parentDepartmentId'),
                'status': payload.get('status', 'active').lower(),
            })
            Log.create({
                'user_name': request.env.user.name,
                'action': 'CREATE_DEPARTMENT',
                'details': f'Department "{dept.name}" created',
            })
            return self._json_response({'success': True, 'id': dept.id})

        elif action == 'UPDATE_DEPARTMENT':
            dept = Department.browse(payload['id'])
            if payload.get('name'): dept.name = payload['name']
            if 'headId' in payload: dept.head_id = payload['headId']
            if 'parentDepartmentId' in payload: dept.parent_department_id = payload['parentDepartmentId']
            if payload.get('status'): dept.status = payload['status'].lower()
            Log.create({
                'user_name': request.env.user.name,
                'action': 'UPDATE_DEPARTMENT',
                'details': f'Department "{dept.name}" updated',
            })
            return self._json_response({'success': True})

        elif action == 'CREATE_CATEGORY':
            cat = Category.create({'name': payload['name']})
            Log.create({
                'user_name': request.env.user.name,
                'action': 'CREATE_CATEGORY',
                'details': f'Category "{cat.name}" created',
            })
            return self._json_response({'success': True, 'id': cat.id})

        elif action == 'UPDATE_EMPLOYEE':
            emp = Employee.browse(payload['id'])
            role_map = {
                'Admin': 'admin', 'Asset Manager': 'asset_manager',
                'Department Head': 'department_head', 'Employee': 'employee',
            }
            if payload.get('role'):
                emp.role = role_map.get(payload['role'], payload['role'].lower())
            if payload.get('departmentId'): emp.department_id = payload['departmentId']
            if payload.get('status'): emp.status = payload['status'].lower()
            Log.create({
                'user_name': request.env.user.name,
                'action': 'PROMOTE_EMPLOYEE',
                'details': f'Employee "{emp.name}" updated to role {payload.get("role", emp.role)}',
            })
            return self._json_response({'success': True})

    # ─── Allocations ──────────────────────────────────────────────
    @http.route('/api/assetflow/allocation', type='http', auth='user', methods=['GET', 'POST'], csrf=False)
    def allocation(self, **kwargs):
        Asset = request.env['assetflow.asset'].sudo()
        Employee = request.env['assetflow.employee'].sudo()
        Department = request.env['assetflow.department'].sudo()
        Allocation = request.env['assetflow.allocation'].sudo()
        Transfer = request.env['assetflow.transfer'].sudo()
        Log = request.env['assetflow.activity.log'].sudo()

        if request.httprequest.method == 'GET':
            return self._json_response({
                'assets': self._serialize_assets(Asset.search([])),
                'employees': [{'id': e.id, 'name': e.name} for e in Employee.search([('status', '=', 'active')])],
                'departments': [{'id': d.id, 'name': d.name} for d in Department.search([('status', '=', 'active')])],
                'transfers': [{
                    'id': t.id, 'assetId': t.asset_id.id, 'assetName': t.asset_id.name,
                    'assetTag': t.asset_id.asset_tag,
                    'requestedById': t.requested_by_id.id, 'requestedByName': t.requested_by_id.name,
                    'targetEmployeeId': t.target_employee_id.id, 'targetEmployeeName': t.target_employee_id.name,
                    'requestDate': str(t.request_date), 'status': t.state.capitalize(),
                    'notes': t.notes,
                } for t in Transfer.search([('state', '=', 'pending')])],
                'logs': [{'id': l.id, 'userName': l.user_name, 'action': l.action,
                          'details': l.details, 'timestamp': str(l.timestamp)}
                         for l in Log.search([], limit=20)],
            })

        payload = json.loads(request.httprequest.data)
        action = payload.get('action')

        if action == 'ALLOCATE':
            emp = Employee.browse(payload['employeeId'])
            alloc = Allocation.create({
                'asset_id': payload['assetId'],
                'employee_id': payload['employeeId'],
                'department_id': emp.department_id.id,
                'expected_return_date': payload.get('expectedReturnDate'),
                'notes': payload.get('notes', ''),
            })
            return self._json_response({'success': True, 'allocation_id': alloc.id})

        elif action == 'SUBMIT_TRANSFER':
            trans = Transfer.create({
                'asset_id': payload['assetId'],
                'requested_by_id': self._get_employee().id,
                'target_employee_id': payload['targetEmployeeId'],
                'notes': payload.get('notes', ''),
            })
            Log.create({
                'user_name': request.env.user.name,
                'action': 'SUBMIT_TRANSFER',
                'details': f'Transfer requested for asset #{payload["assetId"]}',
            })
            return self._json_response({'success': True, 'transfer_id': trans.id})

        elif action == 'APPROVE_TRANSFER':
            transfer = Transfer.browse(payload['transferId'])
            transfer.action_approve()
            return self._json_response({'success': True})

        elif action == 'REJECT_TRANSFER':
            transfer = Transfer.browse(payload['transferId'])
            transfer.action_reject()
            return self._json_response({'success': True})

        elif action == 'RETURN_ASSET':
            asset = Asset.browse(payload['assetId'])
            alloc = Allocation.search([
                ('asset_id', '=', asset.id),
                ('state', '=', 'active'),
            ], limit=1)
            if alloc:
                alloc.write({
                    'state': 'returned',
                    'actual_return_date': fields.Datetime.now(),
                    'return_condition': payload.get('conditionNotes', ''),
                })
            asset.write({
                'status': 'available',
                'current_holder_id': False,
                'current_department_id': False,
                'expected_return_date': False,
            })
            Log.create({
                'user_name': request.env.user.name,
                'action': 'RETURN',
                'details': f'Asset {asset.asset_tag} returned',
            })
            return self._json_response({'success': True})

    # ─── Bookings ─────────────────────────────────────────────────
    @http.route('/api/assetflow/booking', type='http', auth='user', methods=['GET', 'POST'], csrf=False)
    def booking(self, **kwargs):
        Asset = request.env['assetflow.asset'].sudo()
        Employee = request.env['assetflow.employee'].sudo()
        Department = request.env['assetflow.department'].sudo()
        Booking = request.env['assetflow.booking'].sudo()

        if request.httprequest.method == 'GET':
            return self._json_response({
                'assets': self._serialize_assets(Asset.search([('is_bookable', '=', True)])),
                'employees': [{'id': e.id, 'name': e.name} for e in Employee.search([('status', '=', 'active')])],
                'departments': [{'id': d.id, 'name': d.name} for d in Department.search([('status', '=', 'active')])],
                'bookings': [{
                    'id': b.id, 'assetId': b.asset_id.id, 'assetName': b.asset_id.name,
                    'employeeId': b.employee_id.id, 'employeeName': b.employee_id.name,
                    'startTime': str(b.start_time), 'endTime': str(b.end_time),
                    'status': b.status.capitalize(), 'notes': b.notes,
                } for b in Booking.search([])],
            })

        payload = json.loads(request.httprequest.data)
        action = payload.get('action')

        if action == 'CREATE_BOOKING':
            booking = Booking.create({
                'asset_id': payload['assetId'],
                'employee_id': payload['employeeId'],
                'start_time': payload['startTime'],
                'end_time': payload['endTime'],
                'notes': payload.get('notes', ''),
            })
            return self._json_response({'success': True, 'booking_id': booking.id})

        elif action == 'CANCEL_BOOKING':
            Booking.browse(payload['bookingId']).action_cancel()
            return self._json_response({'success': True})

    # ─── Maintenance ──────────────────────────────────────────────
    @http.route('/api/assetflow/maintenance', type='http', auth='user', methods=['GET', 'POST'], csrf=False)
    def maintenance(self, **kwargs):
        Asset = request.env['assetflow.asset'].sudo()
        Employee = request.env['assetflow.employee'].sudo()
        Maintenance = request.env['assetflow.maintenance'].sudo()

        if request.httprequest.method == 'GET':
            return self._json_response({
                'maintenance': [{
                    'id': m.id, 'assetId': m.asset_id.id, 'assetName': m.asset_id.name,
                    'assetTag': m.asset_id.asset_tag,
                    'issueDescription': m.issue_description,
                    'priority': m.priority.capitalize(),
                    'status': dict(Maintenance._fields['status'].selection).get(m.status, m.status.capitalize()),
                    'requestedById': m.requested_by_id.id, 'requestedByName': m.requested_by_id.name,
                    'requestDate': str(m.request_date), 'notes': m.notes,
                } for m in Maintenance.search([])],
                'assets': self._serialize_assets(Asset.search([])),
                'employees': [{'id': e.id, 'name': e.name} for e in Employee.search([('status', '=', 'active')])],
            })

        payload = json.loads(request.httprequest.data)
        action = payload.get('action')

        if action == 'CREATE_REQUEST':
            maint = Maintenance.create({
                'asset_id': payload['assetId'],
                'issue_description': payload['issueDescription'],
                'priority': payload.get('priority', 'medium').lower(),
                'requested_by_id': payload.get('requestedById') or self._get_employee().id,
                'notes': payload.get('notes', ''),
            })
            return self._json_response({'success': True, 'maintenance_id': maint.id})

        elif action == 'UPDATE_STATUS':
            maint = Maintenance.browse(payload['requestId'])
            status_map = {
                'Pending': 'pending', 'Approved': 'approved', 'Rejected': 'rejected',
                'Technician Assigned': 'technician_assigned', 'In Progress': 'in_progress',
                'Resolved': 'resolved',
            }
            new_status = status_map.get(payload['newStatus'], payload['newStatus'].lower())
            action_methods = {
                'approved': 'action_approve', 'rejected': 'action_reject',
                'technician_assigned': 'action_assign_technician',
                'in_progress': 'action_start', 'resolved': 'action_resolve',
            }
            if new_status in action_methods:
                getattr(maint, action_methods[new_status])()
            else:
                maint.write({'status': new_status, 'notes': payload.get('notes', maint.notes)})
            return self._json_response({'success': True})

    # ─── Audit ────────────────────────────────────────────────────
    @http.route('/api/assetflow/audit', type='http', auth='user', methods=['GET', 'POST'], csrf=False)
    def audit(self, **kwargs):
        Asset = request.env['assetflow.asset'].sudo()
        Employee = request.env['assetflow.employee'].sudo()
        AuditCycle = request.env['assetflow.audit.cycle'].sudo()
        AuditCheck = request.env['assetflow.audit.check'].sudo()

        if request.httprequest.method == 'GET':
            return self._json_response({
                'audits': [{
                    'id': a.id, 'name': a.name,
                    'startDate': str(a.start_date), 'endDate': str(a.end_date),
                    'status': 'Active' if a.status == 'active' else 'Closed',
                    'auditors': [aud.name for aud in a.auditor_ids],
                    'assetChecks': {str(c.asset_id.id): {
                        'status': c.check_status.capitalize(),
                        'checkedAt': str(c.checked_at) if c.checked_at else None,
                        'notes': c.notes,
                    } for c in a.check_ids},
                    'discrepancyCount': a.discrepancy_count,
                } for a in AuditCycle.search([])],
                'assets': self._serialize_assets(Asset.search([])),
                'employees': [{'id': e.id, 'name': e.name} for e in Employee.search([('status', '=', 'active')])],
            })

        payload = json.loads(request.httprequest.data)
        action = payload.get('action')

        if action == 'UPDATE_CHECK':
            check = AuditCheck.search([
                ('audit_id', '=', payload['auditId']),
                ('asset_id', '=', payload['assetId']),
            ], limit=1)
            status_map = {'Verified': 'verified', 'Missing': 'missing', 'Damaged': 'damaged'}
            if check:
                check.write({
                    'check_status': status_map.get(payload['checkStatus'], payload['checkStatus'].lower()),
                    'checked_at': fields.Datetime.now(),
                    'checked_by_id': self._get_employee().id,
                })
            return self._json_response({'success': True})

        elif action == 'CLOSE_CYCLE':
            AuditCycle.browse(payload['auditId']).action_close()
            return self._json_response({'success': True})

    # ─── Reports ──────────────────────────────────────────────────
    @http.route('/api/assetflow/reports', type='http', auth='user', methods=['GET'], csrf=False)
    def reports(self, **kwargs):
        Asset = request.env['assetflow.asset'].sudo()
        Maintenance = request.env['assetflow.maintenance'].sudo()
        Booking = request.env['assetflow.booking'].sudo()
        Department = request.env['assetflow.department'].sudo()

        assets = Asset.search([])
        status_counts = {
            'Available': Asset.search_count([('status', '=', 'available')]),
            'Allocated': Asset.search_count([('status', '=', 'allocated')]),
            'Reserved': Asset.search_count([('status', '=', 'reserved')]),
            'UnderMaintenance': Asset.search_count([('status', '=', 'under_maintenance')]),
            'Lost': Asset.search_count([('status', '=', 'lost')]),
            'Retired': Asset.search_count([('status', '=', 'retired')]),
        }

        dept_allocations = [{
            'departmentName': d.name,
            'count': Asset.search_count([('current_department_id', '=', d.id)]),
        } for d in Department.search([])]

        maint_by_cat = request.env.cr.execute("""
            SELECT c.name, COUNT(m.id)
            FROM assetflow_maintenance m
            JOIN assetflow_asset a ON a.id = m.asset_id
            JOIN assetflow_category c ON c.id = a.category_id
            GROUP BY c.name
        """)
        maint_by_cat = request.env.cr.dictfetchall()

        nearing_retirement = Asset.search([
            ('acquisition_date', '<', fields.Date.today()),
            ('condition', 'in', ('fair', 'poor')),
            ('status', 'not in', ('retired', 'disposed')),
        ], limit=5)

        return self._json_response({
            'statusCounts': status_counts,
            'deptAllocations': dept_allocations,
            'maintenanceByCategory': maint_by_cat,
            'nearingRetirement': [{
                'id': a.id, 'name': a.name, 'category': a.category_id.name,
                'condition': a.condition, 'acquisitionDate': str(a.acquisition_date),
            } for a in nearing_retirement],
            'kpis': {
                'totalAssetsCount': len(assets),
                'totalAssetsVal': sum(assets.mapped('acquisition_cost')),
                'utilizationRate': round(Asset.search_count([('status', '=', 'allocated')]) / max(len(assets), 1) * 100, 1),
                'maintenanceCount': Maintenance.search_count([('status', '!=', 'resolved')]),
            },
        })

    # ─── Notifications ────────────────────────────────────────────
    @http.route('/api/assetflow/notifications', type='http', auth='user', methods=['GET', 'POST'], csrf=False)
    def notifications(self, **kwargs):
        Notification = request.env['assetflow.notification'].sudo()
        Log = request.env['assetflow.activity.log'].sudo()
        Employee = request.env['assetflow.employee'].sudo()

        if request.httprequest.method == 'GET':
            return self._json_response({
                'notifications': [{
                    'id': n.id, 'title': n.title, 'message': n.message,
                    'type': n.type, 'isRead': n.is_read, 'timestamp': str(n.timestamp),
                } for n in Notification.search([], order='timestamp desc')],
                'logs': [{
                    'id': l.id, 'userName': l.user_name, 'action': l.action,
                    'details': l.details, 'timestamp': str(l.timestamp),
                } for l in Log.search([], order='timestamp desc', limit=50)],
                'employees': [{'id': e.id, 'name': e.name} for e in Employee.search([])],
            })

        payload = json.loads(request.httprequest.data)
        action = payload.get('action')

        if action == 'MARK_READ':
            Notification.browse(payload['notificationId']).action_mark_read()
            return self._json_response({'success': True})

        elif action == 'MARK_ALL_READ':
            Notification.search([('is_read', '=', False)]).write({'is_read': True})
            return self._json_response({'success': True})

        elif action == 'CLEAR_ALL':
            Notification.search([]).unlink()
            return self._json_response({'success': True})

        elif action == 'SIMULATE':
            type_map = {
                'overdue': ('Overdue Return Alert', 'Asset return is overdue', 'warning'),
                'maintenance': ('Maintenance Update', 'Maintenance request status changed', 'info'),
                'allocation': ('New Allocation', 'An asset has been allocated to you', 'success'),
                'booking': ('Booking Reminder', 'Your booking starts in 15 minutes', 'info'),
                'audit': ('Audit Discrepancy', 'Discrepancy found in audit cycle', 'error'),
            }
            sim = type_map.get(payload.get('type', 'info'), ('Notification', 'Test notification', 'info'))
            Notification.create({
                'title': sim[0],
                'message': sim[1],
                'type': sim[2],
                'user_id': self._get_employee().id,
            })
            return self._json_response({'success': True})

    # ─── Helpers ──────────────────────────────────────────────────
    def _serialize_assets(self, assets):
        return [{
            'id': a.asset_tag,
            'name': a.name,
            'assetTag': a.asset_tag,
            'categoryId': a.category_id.id,
            'categoryName': a.category_id.name,
            'serialNumber': a.serial_number,
            'acquisitionDate': str(a.acquisition_date) if a.acquisition_date else None,
            'acquisitionCost': a.acquisition_cost,
            'condition': a.condition.capitalize(),
            'location': a.location,
            'status': dict(a._fields['status'].selection).get(a.status, a.status.capitalize()),
            'isBookable': a.is_bookable,
            'currentHolderId': a.current_holder_id.id,
            'currentHolderName': a.current_holder_id.name,
            'currentDepartmentId': a.current_department_id.id,
            'currentDepartmentName': a.current_department_id.name,
            'expectedReturnDate': str(a.expected_return_date) if a.expected_return_date else None,
        } for a in assets]

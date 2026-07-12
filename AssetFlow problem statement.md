# AssetFlow – Enterprise Asset & Resource Management System

**AssetFlow** is an ERP platform for organizations to centrally manage physical assets and shared resources. It replaces manual tracking with a digital system that manages asset lifecycles, allocations, bookings, maintenance, audits, notifications, and reporting.

### Core Features

* **Authentication**

  * Employee signup (no role selection)
  * Admin assigns Asset Manager and Department Head roles
  * Login, password reset, session management

* **Dashboard**

  * KPIs: Available Assets, Allocated Assets, Maintenance, Active Bookings, Pending Transfers, Upcoming/Overdue Returns
  * Quick actions for asset registration, booking, and maintenance requests

* **Organization Setup (Admin)**

  * Manage departments and hierarchy
  * Create asset categories
  * Manage employee directory and assign roles

* **Asset Management**

  * Register assets with category, serial number, asset tag, location, condition, documents, and bookable flag
  * Search/filter assets
  * Track lifecycle:

    * Available
    * Allocated
    * Reserved
    * Under Maintenance
    * Lost
    * Retired
    * Disposed
  * View allocation and maintenance history

* **Asset Allocation & Transfers**

  * Allocate assets to employees/departments
  * Prevent double allocation
  * Transfer approval workflow
  * Asset return with condition check
  * Automatic overdue tracking

* **Resource Booking**

  * Book shared resources (rooms, vehicles, equipment)
  * Calendar view
  * Prevent overlapping bookings
  * Cancel/reschedule
  * Booking reminders

* **Maintenance Management**

  * Submit maintenance requests
  * Approval workflow:

    * Pending → Approved/Rejected → Assigned → In Progress → Resolved
  * Automatically update asset status
  * Maintain repair history

* **Asset Audits**

  * Create audit cycles
  * Assign auditors
  * Verify assets (Verified/Missing/Damaged)
  * Auto-generate discrepancy reports
  * Lock completed audits and update asset status

* **Reports & Analytics**

  * Asset utilization
  * Maintenance trends
  * Assets nearing retirement
  * Department allocation summaries
  * Resource booking heatmaps
  * Export reports

* **Notifications & Activity Logs**

  * Asset assignments
  * Maintenance approvals
  * Booking updates
  * Transfer approvals
  * Overdue return alerts
  * Audit discrepancies
  * Complete audit trail

### User Roles

**Admin**

* Manage departments, categories, employees, and roles
* Configure audit cycles
* View organization-wide analytics

**Asset Manager**

* Register and allocate assets
* Approve transfers and maintenance
* Approve returns
* Resolve audit discrepancies

**Department Head**

* Manage departmental assets
* Approve allocation/transfer requests
* Book shared resources for the department

**Employee**

* View assigned assets
* Book shared resources
* Raise maintenance requests
* Request transfers and returns

### Workflow

1. Admin configures departments, categories, and user roles.
2. Asset Manager registers assets (initially **Available**).
3. Assets are allocated or marked as bookable resources.
4. Employees book shared resources with overlap validation.
5. Maintenance requests follow an approval workflow before repairs.
6. Assets are transferred or returned, with overdue items automatically flagged.
7. Scheduled audits verify assets and generate discrepancy reports.
8. Dashboards, notifications, logs, and analytics provide organization-wide visibility.

**Goal:** Build a scalable, role-based ERP system for end-to-end asset and resource management, excluding purchasing, invoicing, and accounting functionality.

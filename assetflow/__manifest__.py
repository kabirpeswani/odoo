{
    'name': 'AssetFlow - Enterprise Asset & Resource Management',
    'version': '1.0.0',
    'summary': 'Enterprise Asset & Resource Management System',
    'description': """
AssetFlow - Enterprise Asset & Resource Management System
=========================================================
Track, allocate, and maintain physical assets and shared resources through a centralized ERP platform.

Key Features:
- Department, Asset Category, and Employee Directory management
- Full asset lifecycle tracking (Available, Allocated, Reserved, Under Maintenance, Lost, Retired, Disposed)
- Asset allocation with double-allocation prevention and transfer workflows
- Shared resource booking with overlap validation
- Maintenance request approval workflow
- Scheduled audit cycles with discrepancy reporting
- Dashboard KPIs, notifications, and activity logs
- Role-based access control (Admin, Asset Manager, Department Head, Employee)
    """,
    'author': 'AssetFlow Team',
    'website': 'https://assetflow.example.com',
    'category': 'Operations/Assets',
    'depends': ['base', 'mail'],
    'data': [
        'security/assetflow_groups.xml',
        'security/ir.model.access.csv',
        'data/sequence_data.xml',
        'data/seed_data.xml',
        'views/actions.xml',
        'views/department_views.xml',
        'views/category_views.xml',
        'views/employee_views.xml',
        'views/asset_views.xml',
        'views/allocation_views.xml',
        'views/transfer_views.xml',
        'views/booking_views.xml',
        'views/maintenance_views.xml',
        'views/audit_views.xml',
        'views/notification_views.xml',
        'views/activity_log_views.xml',
        'views/menus.xml',
        'views/dashboard_views.xml',
        'reports/report_views.xml',
    ],
    'demo': ['data/demo_data.xml'],
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'LGPL-3',
}

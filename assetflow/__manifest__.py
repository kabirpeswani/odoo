{
    'name': 'AssetFlow',
    'summary': 'Enterprise Asset & Resource Management System',
    'description': """
AssetFlow — Enterprise Asset & Resource Management
==================================================

A standalone asset lifecycle platform:

* Asset master registry with auto-generated asset tags and a full lifecycle
  state machine (available / allocated / reserved / maintenance / lost /
  retired / disposed).
* Allocation & transfer workflow with conflict detection: an asset already
  held by someone cannot be re-allocated, the user is redirected to a
  Transfer Request instead.
* Shared resource booking with strict slot-overlap prevention and a calendar
  view.
* Maintenance requests with an approval workflow and technician work logs;
  approval/resolution drives the asset state automatically.
* Physical audit cycles with per-asset verification lines; closing a cycle
  reconciles the physical findings back onto the asset records.

No accounting, purchase or invoicing dependencies.
""",
    'author': 'AssetFlow Team',
    'website': 'https://example.com',
    'category': 'Operations/Asset Management',
    'version': '17.0.1.0.0',
    'license': 'LGPL-3',
    'depends': ['base', 'mail'],
    'data': [
        # Security must load before anything referencing the groups.
        'security/assetflow_security.xml',
        'security/ir.model.access.csv',

        # Sequences, crons, demo-free master data.
        'data/assetflow_data.xml',

        # Views, actions and menus.
        'views/assetflow_menus_views.xml',
    ],
    'application': True,
    'installable': True,
    'auto_install': False,
}

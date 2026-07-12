# -*- coding: utf-8 -*-
"""Install/upgrade hooks."""


def post_init_hook(env):
    """Attach existing departments and categories to the Organization Setup.

    ``setup_id`` is defaulted on create, so anything made from now on links
    itself. Records that already existed when this field was introduced have a
    null ``setup_id`` and would silently disappear from the Organization Setup
    screen, whose tabs are One2many over exactly that field. Backfill them.
    """
    setup = env.ref('assetflow.org_setup_main', raise_if_not_found=False)
    if not setup:
        return
    for model in ('assetflow.department', 'assetflow.asset.category'):
        orphans = env[model].sudo().search([('setup_id', '=', False)])
        if orphans:
            orphans.write({'setup_id': setup.id})

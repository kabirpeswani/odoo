from odoo import models, fields


class AssetFlowStatusReport(models.AbstractModel):
    _name = 'report.assetflow.report_asset_status'
    _description = 'Asset Status Report'

    def _get_report_values(self, docids, data=None):
        docs = self.env['assetflow.asset'].browse(docids)
        return {
            'doc_ids': docids,
            'doc_model': 'assetflow.asset',
            'docs': docs,
            'status_counts': {
                'available': self.env['assetflow.asset'].search_count([('status', '=', 'available')]),
                'allocated': self.env['assetflow.asset'].search_count([('status', '=', 'allocated')]),
                'under_maintenance': self.env['assetflow.asset'].search_count([('status', '=', 'under_maintenance')]),
            },
        }

import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb, AuditCycle, ActivityLog, AppNotification } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    
    // Enrich audit cycles with auditor names
    const enrichedAudits = db.audits.map(a => {
      const auditorNames = a.auditors.map(id => {
        const emp = db.employees.find(e => e.id === id);
        return emp ? emp.name : 'Unknown Auditor';
      });

      return {
        ...a,
        auditorNames
      };
    });

    return NextResponse.json({
      audits: enrichedAudits,
      assets: db.assets,
      employees: db.employees.filter(e => e.status === 'Active')
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();
    const { action, payload, userId = 'emp-3' } = body;

    const user = db.employees.find(e => e.id === userId) || db.employees[0];
    const timestamp = new Date().toISOString();

    if (action === 'UPDATE_CHECK') {
      const { auditId, assetId, checkStatus } = payload;
      const audit = db.audits.find(a => a.id === auditId);

      if (!audit) {
        return NextResponse.json({ error: 'Audit cycle not found' }, { status: 404 });
      }

      if (audit.status === 'Closed') {
        return NextResponse.json({ error: 'Cannot check assets in a closed audit cycle' }, { status: 400 });
      }

      // Update check
      audit.assetChecks[assetId] = {
        status: checkStatus,
        checkedAt: timestamp
      };

      // Recalculate discrepancies
      const checks = Object.values(audit.assetChecks);
      const discrepancyCount = checks.filter(c => c.status === 'Missing' || c.status === 'Damaged').length;
      audit.discrepancyCount = discrepancyCount;

      saveDb(db);
      return NextResponse.json({ success: true, audit });
    }

    if (action === 'CLOSE_CYCLE') {
      const { auditId } = payload;
      const audit = db.audits.find(a => a.id === auditId);

      if (!audit) {
        return NextResponse.json({ error: 'Audit cycle not found' }, { status: 404 });
      }

      audit.status = 'Closed';

      // Update statuses of checked assets:
      // Close Audit Cycle — locks the cycle and updates affected asset statuses (e.g., Lost for confirmed-missing items)
      Object.entries(audit.assetChecks).forEach(([assetId, check]) => {
        const asset = db.assets.find(a => a.id === assetId);
        if (asset) {
          if (check.status === 'Missing') {
            asset.status = 'Lost';
          } else if (check.status === 'Damaged') {
            // Mark damaged assets as under maintenance for repairs
            asset.status = 'Under Maintenance';
          }
        }
      });

      // Log action
      const logDetails = `Closed audit cycle "${audit.name}" - ${audit.discrepancyCount} discrepancies flagged and processed`;
      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        action: 'CLOSE_AUDIT',
        details: logDetails,
        timestamp
      };
      db.logs.push(log);

      // Create notifications for Asset Managers
      db.employees.filter(e => e.role === 'Asset Manager').forEach(mgr => {
        const notif: AppNotification = {
          id: `ntf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          userId: mgr.id,
          title: 'Audit Cycle Closed',
          message: `Audit cycle "${audit.name}" has been closed with ${audit.discrepancyCount} discrepancies.`,
          type: 'warning',
          isRead: false,
          timestamp
        };
        db.notifications.push(notif);
      });

      saveDb(db);
      return NextResponse.json({ success: true, audit });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb, AppNotification, ActivityLog } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    
    // Return all notifications and logs sorted by timestamp descending
    const notifications = (db.notifications || [])
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
    const logs = (db.logs || [])
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      notifications,
      logs,
      employees: db.employees || []
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

    if (!db.notifications) db.notifications = [];
    if (!db.logs) db.logs = [];

    if (action === 'MARK_READ') {
      const { notificationId } = payload;
      const notif = db.notifications.find(n => n.id === notificationId);
      if (notif) {
        notif.isRead = true;
        saveDb(db);
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'MARK_ALL_READ') {
      db.notifications.forEach(n => {
        n.isRead = true;
      });
      saveDb(db);
      return NextResponse.json({ success: true });
    }

    if (action === 'CLEAR_ALL') {
      db.notifications = [];
      saveDb(db);
      return NextResponse.json({ success: true });
    }

    if (action === 'SIMULATE') {
      const { type } = payload;
      let title = 'System Notification';
      let message = 'A system event has occurred.';
      let notifType: 'info' | 'warning' | 'success' | 'error' = 'info';
      let logAction = 'SYSTEM_EVENT';
      let logDetails = 'A simulated system event occurred.';

      switch (type) {
        case 'overdue':
          title = 'Overdue Return Alert';
          message = 'Asset AF-0062 (Projector bulb not turning on) is overdue by 5 days. Please check with Priya Shah.';
          notifType = 'warning';
          logAction = 'OVERDUE_ALERT';
          logDetails = 'System triggered overdue alert for Projector bulb (AF-0062)';
          break;
        case 'maintenance':
          title = 'Maintenance Approved';
          message = 'Maintenance request for AC Unit (AF-003) has been approved by Raj Sharma.';
          notifType = 'success';
          logAction = 'UPDATE_MAINTENANCE';
          logDetails = 'Raj Sharma approved maintenance request for AC Unit (AF-003)';
          break;
        case 'allocation':
          title = 'Asset Assigned';
          message = 'MacBook Pro M3 (AF-0051) has been allocated to Siddharth Iqbal.';
          notifType = 'info';
          logAction = 'ALLOCATE_ASSET';
          logDetails = 'Raj Sharma allocated MacBook Pro M3 (AF-0051) to Siddharth Iqbal';
          break;
        case 'booking':
          title = 'Booking Confirmed';
          message = 'Conference Room A booking confirmed for Ananya Rao at 10:00 AM.';
          notifType = 'success';
          logAction = 'CONFIRM_BOOKING';
          logDetails = 'Ananya Rao booked Conference Room A for 2026-07-12 10:00-11:00';
          break;
        case 'audit':
          title = 'Audit Discrepancy Flagged';
          message = 'Audit cycle Audit-2026-Q2 flagged 2 damaged assets in Engineering department.';
          notifType = 'error';
          logAction = 'AUDIT_DISCREPANCY';
          logDetails = 'Auditor Priya Shah submitted audit discrepancies for Engineering department';
          break;
      }

      const notifId = `ntf-${Date.now()}`;
      const logId = `log-${Date.now()}`;

      const newNotif: AppNotification = {
        id: notifId,
        userId: user.id,
        title,
        message,
        type: notifType,
        isRead: false,
        timestamp
      };

      const newLog: ActivityLog = {
        id: logId,
        userId: user.id,
        userName: user.name,
        action: logAction,
        details: logDetails,
        timestamp
      };

      db.notifications.push(newNotif);
      db.logs.push(newLog);
      saveDb(db);

      return NextResponse.json({ success: true, notification: newNotif, log: newLog });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

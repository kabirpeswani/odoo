import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb, MaintenanceRequest, ActivityLog, AppNotification } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    
    // Enrich maintenance requests with asset details
    const enrichedRequests = db.maintenance.map(m => {
      const asset = db.assets.find(a => a.id === m.assetId);
      const requester = db.employees.find(e => e.id === m.requestedById);
      
      return {
        ...m,
        assetName: asset ? asset.name : 'Unknown Asset',
        assetCategory: asset ? db.categories.find(c => c.id === asset.categoryId)?.name : 'Unknown Category',
        requesterName: requester ? requester.name : 'Unknown Employee'
      };
    });

    return NextResponse.json({
      maintenance: enrichedRequests,
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

    if (action === 'UPDATE_STATUS') {
      const { requestId, newStatus, notes } = payload;
      const request = db.maintenance.find(m => m.id === requestId);

      if (!request) {
        return NextResponse.json({ error: 'Maintenance request not found' }, { status: 404 });
      }

      const oldStatus = request.status;
      request.status = newStatus;
      if (notes !== undefined) {
        request.notes = notes;
      }

      // Sync Asset Status:
      // Approving a card moves the asset to under maintenance, resolving return it to available
      const asset = db.assets.find(a => a.id === request.assetId);
      if (asset) {
        if (newStatus === 'Resolved') {
          asset.status = 'Available';
          asset.currentHolderId = null;
          asset.currentDepartmentId = null;
          asset.expectedReturnDate = null;
        } else if (newStatus === 'Approved' || newStatus === 'Technician Assigned' || newStatus === 'In Progress') {
          asset.status = 'Under Maintenance';
        } else if (newStatus === 'Pending') {
          // If reverted to pending, it might be available in inventory
          asset.status = 'Available';
        }
      }

      // Create log details
      const assetName = asset ? asset.name : 'Asset';
      const logDetails = `${assetName} ${request.assetId} - maintenance status updated from ${oldStatus} to ${newStatus}`;
      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        action: 'UPDATE_MAINTENANCE',
        details: logDetails,
        timestamp
      };
      db.logs.push(log);

      // Create notification
      const requesterId = request.requestedById;
      const notif: AppNotification = {
        id: `ntf-${Date.now()}`,
        userId: requesterId,
        title: `Maintenance Request ${newStatus}`,
        message: `Your maintenance request for ${assetName} (${request.assetId}) is now ${newStatus}.`,
        type: newStatus === 'Resolved' ? 'success' : newStatus === 'Rejected' ? 'error' : 'info',
        isRead: false,
        timestamp
      };
      db.notifications.push(notif);

      saveDb(db);
      return NextResponse.json({ success: true, request });
    }

    if (action === 'CREATE_REQUEST') {
      const { assetId, issueDescription, priority, notes } = payload;
      const asset = db.assets.find(a => a.id === assetId);

      if (!asset) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }

      const newRequest: MaintenanceRequest = {
        id: `mt-${Date.now()}`,
        assetId,
        issueDescription,
        priority: priority || 'Medium',
        status: 'Pending',
        requestedById: user.id,
        requestDate: new Date().toISOString().split('T')[0],
        notes: notes || ''
      };

      db.maintenance.push(newRequest);

      // Log
      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        action: 'RAISE_MAINTENANCE',
        details: `Raised maintenance request for ${asset.name} (${asset.id}) - ${issueDescription}`,
        timestamp
      };
      db.logs.push(log);

      saveDb(db);
      return NextResponse.json({ success: true, request: newRequest });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

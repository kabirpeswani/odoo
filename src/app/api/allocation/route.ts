import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb, Asset, TransferRequest, ActivityLog, AppNotification } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    
    // Enrich transfers with employee names
    const enrichedTransfers = db.transfers.map(t => {
      const asset = db.assets.find(a => a.id === t.assetId);
      const requester = db.employees.find(e => e.id === t.requestedById);
      const target = db.employees.find(e => e.id === t.targetEmployeeId);
      
      const currentHolder = asset ? db.employees.find(e => e.id === asset.currentHolderId) : null;
      const currentDept = asset && currentHolder ? db.departments.find(d => d.id === currentHolder.departmentId) : null;

      return {
        ...t,
        assetName: asset ? asset.name : 'Unknown Asset',
        requesterName: requester ? requester.name : 'Unknown Employee',
        targetEmployeeName: target ? target.name : 'Unknown Employee',
        currentHolderName: currentHolder ? currentHolder.name : 'Unknown Employee',
        currentHolderDept: currentDept ? currentDept.name : 'Unknown Department'
      };
    });

    return NextResponse.json({
      assets: db.assets,
      employees: db.employees.filter(e => e.status === 'Active'),
      departments: db.departments.filter(d => d.status === 'Active'),
      transfers: enrichedTransfers,
      logs: db.logs
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();
    const { action, payload, userId = 'emp-3' } = body; // default to Kabir Peswani (Admin)

    const user = db.employees.find(e => e.id === userId) || db.employees[0];
    const timestamp = new Date().toISOString();

    if (action === 'ALLOCATE') {
      const { assetId, employeeId, expectedReturnDate, notes } = payload;
      const asset = db.assets.find(a => a.id === assetId);
      const employee = db.employees.find(e => e.id === employeeId);

      if (!asset) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }
      if (!employee) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }
      if (asset.status === 'Allocated') {
        return NextResponse.json({ error: 'Asset is already allocated' }, { status: 400 });
      }

      const dept = db.departments.find(d => d.id === employee.departmentId);
      const deptName = dept ? dept.name : 'Unknown Department';

      // Update asset
      asset.status = 'Allocated';
      asset.currentHolderId = employee.id;
      asset.currentDepartmentId = employee.departmentId;
      asset.expectedReturnDate = expectedReturnDate || null;

      // Add log matching formatting exactly
      const logDetails = `${asset.name} ${asset.id} - allocated to ${employee.name} - ${deptName}`;
      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        action: 'ALLOCATE',
        details: logDetails,
        timestamp
      };
      db.logs.push(log);

      // Create notification
      const notif: AppNotification = {
        id: `ntf-${Date.now()}`,
        userId: employee.id,
        title: 'Asset Allocated',
        message: `Asset ${asset.id} (${asset.name}) has been allocated to you. Expected return: ${expectedReturnDate || 'N/A'}.`,
        type: 'success',
        isRead: false,
        timestamp
      };
      db.notifications.push(notif);

      saveDb(db);
      return NextResponse.json({ success: true, asset });
    }

    if (action === 'SUBMIT_TRANSFER') {
      const { assetId, targetEmployeeId, notes } = payload;
      const asset = db.assets.find(a => a.id === assetId);
      const targetEmployee = db.employees.find(e => e.id === targetEmployeeId);

      if (!asset) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }
      if (!targetEmployee) {
        return NextResponse.json({ error: 'Target employee not found' }, { status: 404 });
      }
      if (asset.status !== 'Allocated' || !asset.currentHolderId) {
        return NextResponse.json({ error: 'Asset must be allocated to be transferred' }, { status: 400 });
      }

      const currentHolder = db.employees.find(e => e.id === asset.currentHolderId);
      const currentHolderName = currentHolder ? currentHolder.name : 'Unknown';

      // Create transfer request
      const newTransfer: TransferRequest = {
        id: `tr-${Date.now()}`,
        assetId,
        requestedById: user.id,
        targetEmployeeId,
        requestDate: new Date().toISOString().split('T')[0],
        status: 'Pending',
        notes: notes || ''
      };
      db.transfers.push(newTransfer);

      // Log the transfer request
      const logDetails = `Transfer request submitted for ${asset.name} (${asset.id}) from ${currentHolderName} to ${targetEmployee.name}`;
      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        action: 'SUBMIT_TRANSFER',
        details: logDetails,
        timestamp
      };
      db.logs.push(log);

      // Notify the Asset Managers and the target employee
      db.employees.filter(e => e.role === 'Asset Manager').forEach(mgr => {
        const notif: AppNotification = {
          id: `ntf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          userId: mgr.id,
          title: 'Transfer Request Submitted',
          message: `${user.name} requested transfer of ${asset.name} (${asset.id}) to ${targetEmployee.name}.`,
          type: 'info',
          isRead: false,
          timestamp
        };
        db.notifications.push(notif);
      });

      saveDb(db);
      return NextResponse.json({ success: true, transfer: newTransfer });
    }

    if (action === 'APPROVE_TRANSFER') {
      const { transferId } = payload;
      const transferIndex = db.transfers.findIndex(t => t.id === transferId);

      if (transferIndex === -1) {
        return NextResponse.json({ error: 'Transfer request not found' }, { status: 404 });
      }

      const transfer = db.transfers[transferIndex];
      transfer.status = 'Approved';

      const asset = db.assets.find(a => a.id === transfer.assetId);
      const targetEmployee = db.employees.find(e => e.id === transfer.targetEmployeeId);

      if (!asset || !targetEmployee) {
        return NextResponse.json({ error: 'Asset or Target Employee not found for this transfer' }, { status: 400 });
      }

      const previousHolderId = asset.currentHolderId;
      const previousHolder = db.employees.find(e => e.id === previousHolderId);
      const previousHolderName = previousHolder ? previousHolder.name : 'Unknown';

      const targetDept = db.departments.find(d => d.id === targetEmployee.departmentId);
      const targetDeptName = targetDept ? targetDept.name : 'Unknown Department';

      // Reallocate the asset
      asset.currentHolderId = targetEmployee.id;
      asset.currentDepartmentId = targetEmployee.departmentId;
      asset.status = 'Allocated';
      
      // Log the action
      const logDetails = `${asset.name} ${asset.id} - transferred from ${previousHolderName} to ${targetEmployee.name} - ${targetDeptName}`;
      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        action: 'APPROVE_TRANSFER',
        details: logDetails,
        timestamp
      };
      db.logs.push(log);

      // Create notification for target employee
      const notifTarget: AppNotification = {
        id: `ntf-${Date.now()}-1`,
        userId: targetEmployee.id,
        title: 'Asset Transferred to You',
        message: `Asset ${asset.id} (${asset.name}) has been transferred to you from ${previousHolderName}.`,
        type: 'success',
        isRead: false,
        timestamp
      };
      db.notifications.push(notifTarget);

      // Create notification for previous holder
      if (previousHolderId) {
        const notifPrev: AppNotification = {
          id: `ntf-${Date.now()}-2`,
          userId: previousHolderId,
          title: 'Asset Transferred',
          message: `Asset ${asset.id} (${asset.name}) has been successfully transferred to ${targetEmployee.name}.`,
          type: 'info',
          isRead: false,
          timestamp
        };
        db.notifications.push(notifPrev);
      }

      saveDb(db);
      return NextResponse.json({ success: true, transfer });
    }

    if (action === 'REJECT_TRANSFER') {
      const { transferId } = payload;
      const transfer = db.transfers.find(t => t.id === transferId);

      if (!transfer) {
        return NextResponse.json({ error: 'Transfer request not found' }, { status: 404 });
      }

      transfer.status = 'Rejected';

      const asset = db.assets.find(a => a.id === transfer.assetId);
      const targetEmployee = db.employees.find(e => e.id === transfer.targetEmployeeId);
      const targetEmployeeName = targetEmployee ? targetEmployee.name : 'Unknown';

      // Log rejection
      const logDetails = `Transfer request rejected for ${asset ? asset.name : 'Asset'} (${transfer.assetId}) to ${targetEmployeeName}`;
      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        action: 'REJECT_TRANSFER',
        details: logDetails,
        timestamp
      };
      db.logs.push(log);

      saveDb(db);
      return NextResponse.json({ success: true, transfer });
    }

    if (action === 'RETURN_ASSET') {
      const { assetId, conditionNotes } = payload;
      const asset = db.assets.find(a => a.id === assetId);

      if (!asset) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }
      if (asset.status !== 'Allocated' || !asset.currentHolderId) {
        return NextResponse.json({ error: 'Asset is not currently allocated' }, { status: 400 });
      }

      const holder = db.employees.find(e => e.id === asset.currentHolderId);
      const holderName = holder ? holder.name : 'Unknown Employee';

      // Update asset status
      asset.status = 'Available';
      asset.currentHolderId = null;
      asset.currentDepartmentId = null;
      asset.expectedReturnDate = null;

      // Log the return
      const logDetails = `${asset.name} ${asset.id} - returned by ${holderName} - condition: good`;
      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        action: 'RETURN',
        details: logDetails,
        timestamp
      };
      db.logs.push(log);

      saveDb(db);
      return NextResponse.json({ success: true, asset });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

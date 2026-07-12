import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb, Asset, Booking, MaintenanceRequest, AppNotification, ActivityLog } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    
    // We assume the current date for calculations is 2026-07-12 based on user context
    const currentDateStr = '2026-07-12';
    const currentDate = new Date(currentDateStr);

    // 1. Calculations for KPIs
    const assetsAvailable = db.assets.filter(a => a.status === 'Available').length;
    const assetsAllocated = db.assets.filter(a => a.status === 'Allocated').length;
    
    // Active Bookings (Ongoing or Upcoming bookings)
    const activeBookings = db.bookings.filter(b => 
      b.status === 'Ongoing' || b.status === 'Upcoming'
    ).length;

    // Maintenance Today (Assets under maintenance)
    const maintenanceToday = db.assets.filter(a => 
      a.status === 'Under Maintenance'
    ).length;

    // Pending Transfers
    const pendingTransfers = db.transfers.filter(t => t.status === 'Pending').length;

    // Upcoming returns (returns due in next 7 days, excluding overdue)
    const sevenDaysLater = new Date(currentDate);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const upcomingReturns = db.assets.filter(a => {
      if (a.status !== 'Allocated' || !a.expectedReturnDate) return false;
      const returnDate = new Date(a.expectedReturnDate);
      return returnDate >= currentDate && returnDate <= sevenDaysLater;
    }).length;

    // 2. Overdue returns: return date in the past, and still allocated
    const overdueReturns = db.assets.filter(a => {
      if (a.status !== 'Allocated' || !a.expectedReturnDate) return false;
      const returnDate = new Date(a.expectedReturnDate);
      return returnDate < currentDate;
    }).map(a => {
      const holder = db.employees.find(e => e.id === a.currentHolderId);
      const dept = db.departments.find(d => d.id === a.currentDepartmentId);
      
      // Calculate delay in days
      const returnDate = new Date(a.expectedReturnDate!);
      const diffTime = Math.abs(currentDate.getTime() - returnDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        ...a,
        holderName: holder ? holder.name : 'Unknown Employee',
        departmentName: dept ? dept.name : 'Unknown Department',
        daysOverdue: diffDays
      };
    });

    // 3. Upcoming returns detailed list
    const upcomingReturnsList = db.assets.filter(a => {
      if (a.status !== 'Allocated' || !a.expectedReturnDate) return false;
      const returnDate = new Date(a.expectedReturnDate);
      return returnDate >= currentDate && returnDate <= sevenDaysLater;
    }).map(a => {
      const holder = db.employees.find(e => e.id === a.currentHolderId);
      const dept = db.departments.find(d => d.id === a.currentDepartmentId);
      return {
        ...a,
        holderName: holder ? holder.name : 'Unknown Employee',
        departmentName: dept ? dept.name : 'Unknown Department'
      };
    });

    // 4. Notifications (read first 5 unread or recent)
    const notifications = db.notifications
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    // 5. Recent Activity Logs
    const recentLogs = db.logs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    // Return all data
    return NextResponse.json({
      stats: {
        assetsAvailable,
        assetsAllocated,
        activeBookings,
        maintenanceToday,
        pendingTransfers,
        upcomingReturns
      },
      overdueReturns,
      upcomingReturnsList,
      notifications,
      recentLogs,
      assets: db.assets,
      bookings: db.bookings,
      employees: db.employees.filter(e => e.status === 'Active'),
      categories: db.categories,
      departments: db.departments
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();
    const { action, payload, userId = 'emp-1' } = body;

    const user = db.employees.find(e => e.id === userId) || db.employees[0];
    const timestamp = new Date().toISOString();

    if (action === 'REGISTER_ASSET') {
      const { name, categoryId, serialNumber, acquisitionCost, condition, location, isBookable } = payload;
      
      // Auto-generate Asset Tag: e.g. AF-0011
      const currentTags = db.assets.map(a => parseInt(a.id.replace('AF-', ''), 10));
      const nextNum = currentTags.length > 0 ? Math.max(...currentTags) + 1 : 1;
      const nextId = `AF-${nextNum.toString().padStart(4, '0')}`;

      const newAsset: Asset = {
        id: nextId,
        name,
        categoryId,
        serialNumber: serialNumber || `SN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        acquisitionDate: new Date().toISOString().split('T')[0],
        acquisitionCost: Number(acquisitionCost) || 0,
        condition: condition || 'New',
        location,
        status: 'Available',
        isBookable: Boolean(isBookable),
        currentHolderId: null,
        currentDepartmentId: null,
        expectedReturnDate: null
      };

      db.assets.push(newAsset);

      // Create log
      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        action: 'REGISTER_ASSET',
        details: `Registered new asset ${newAsset.id} (${newAsset.name}) in ${newAsset.location}`,
        timestamp
      };
      db.logs.push(log);

      // Create notifications for Asset Managers
      db.employees.filter(e => e.role === 'Asset Manager').forEach(mgr => {
        const notif: AppNotification = {
          id: `ntf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          userId: mgr.id,
          title: 'New Asset Registered',
          message: `${user.name} registered asset ${newAsset.id} - ${newAsset.name}.`,
          type: 'success',
          isRead: false,
          timestamp
        };
        db.notifications.push(notif);
      });

      saveDb(db);
      return NextResponse.json({ success: true, asset: newAsset });
    }

    if (action === 'BOOK_RESOURCE') {
      const { assetId, employeeId, startTime, endTime } = payload;
      const asset = db.assets.find(a => a.id === assetId);

      if (!asset) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }

      if (!asset.isBookable) {
        return NextResponse.json({ error: 'This asset is not set as a shared bookable resource' }, { status: 400 });
      }

      // Check overlaps
      const reqStart = new Date(startTime);
      const reqEnd = new Date(endTime);

      if (reqStart >= reqEnd) {
        return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
      }

      const hasOverlap = db.bookings.some(b => {
        if (b.assetId !== assetId || b.status === 'Cancelled' || b.status === 'Completed') return false;
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        // Overlap condition: startA < endB and startB < endA
        return reqStart < bEnd && bStart < reqEnd;
      });

      if (hasOverlap) {
        // Find who booked it
        const overlappingBooking = db.bookings.find(b => {
          if (b.assetId !== assetId || b.status === 'Cancelled' || b.status === 'Completed') return false;
          const bStart = new Date(b.startTime);
          const bEnd = new Date(b.endTime);
          return reqStart < bEnd && bStart < reqEnd;
        });
        const holder = overlappingBooking ? db.employees.find(e => e.id === overlappingBooking.employeeId) : null;
        const holderName = holder ? holder.name : 'another employee';

        return NextResponse.json({ 
          error: `Overlap Error: This resource is already booked by ${holderName} from ${new Date(overlappingBooking!.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} to ${new Date(overlappingBooking!.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.` 
        }, { status: 400 });
      }

      // Create Booking
      const newBooking: Booking = {
        id: `bk-${Date.now()}`,
        assetId,
        employeeId,
        startTime,
        endTime,
        status: 'Upcoming'
      };

      db.bookings.push(newBooking);

      // Create log
      const bookingUser = db.employees.find(e => e.id === employeeId) || user;
      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        userId: bookingUser.id,
        userName: bookingUser.name,
        action: 'BOOK_RESOURCE',
        details: `Booked shared resource ${asset.id} (${asset.name}) for ${startTime} to ${endTime}`,
        timestamp
      };
      db.logs.push(log);

      // Notify department head or employee
      const notif: AppNotification = {
        id: `ntf-${Date.now()}`,
        userId: bookingUser.id,
        title: 'Booking Confirmed',
        message: `Your booking for ${asset.name} on ${new Date(startTime).toLocaleDateString()} is confirmed.`,
        type: 'success',
        isRead: false,
        timestamp
      };
      db.notifications.push(notif);

      saveDb(db);
      return NextResponse.json({ success: true, booking: newBooking });
    }

    if (action === 'RAISE_MAINTENANCE') {
      const { assetId, issueDescription, priority } = payload;
      const asset = db.assets.find(a => a.id === assetId);

      if (!asset) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }

      // Create Maintenance Request
      const newRequest: MaintenanceRequest = {
        id: `mt-${Date.now()}`,
        assetId,
        issueDescription,
        priority: priority || 'Medium',
        status: 'Pending',
        requestedById: user.id,
        requestDate: new Date().toISOString().split('T')[0]
      };

      db.maintenance.push(newRequest);

      // Create log
      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        action: 'RAISE_MAINTENANCE',
        details: `Raised maintenance request for ${asset.id} (${asset.name}). Issue: ${issueDescription}`,
        timestamp
      };
      db.logs.push(log);

      // Notify Asset Managers
      db.employees.filter(e => e.role === 'Asset Manager').forEach(mgr => {
        const notif: AppNotification = {
          id: `ntf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          userId: mgr.id,
          title: 'Maintenance Request Raised',
          message: `${user.name} requested maintenance for ${asset.id} (${asset.name}).`,
          type: 'warning',
          isRead: false,
          timestamp
        };
        db.notifications.push(notif);
      });

      saveDb(db);
      return NextResponse.json({ success: true, request: newRequest });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

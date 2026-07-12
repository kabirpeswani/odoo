import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb, Booking, ActivityLog, AppNotification } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    
    const bookableAssets = db.assets.filter(a => a.isBookable);
    
    // Enrich bookings with employee and department names
    const enrichedBookings = db.bookings.map(b => {
      const asset = db.assets.find(a => a.id === b.assetId);
      const employee = db.employees.find(e => e.id === b.employeeId);
      const department = employee ? db.departments.find(d => d.id === employee.departmentId) : null;
      
      return {
        ...b,
        assetName: asset ? asset.name : 'Unknown Space',
        employeeName: employee ? employee.name : 'Unknown Employee',
        departmentName: department ? department.name : 'Unknown Department'
      };
    });

    return NextResponse.json({
      assets: bookableAssets,
      employees: db.employees.filter(e => e.status === 'Active'),
      departments: db.departments.filter(d => d.status === 'Active'),
      bookings: enrichedBookings
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

    if (action === 'CREATE_BOOKING') {
      const { assetId, employeeId, startTime, endTime, notes } = payload;
      const asset = db.assets.find(a => a.id === assetId);
      const employee = db.employees.find(e => e.id === employeeId);

      if (!asset) {
        return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
      }
      if (!asset.isBookable) {
        return NextResponse.json({ error: 'This asset is not a shared bookable resource' }, { status: 400 });
      }
      if (!employee) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }

      const reqStart = new Date(startTime);
      const reqEnd = new Date(endTime);

      if (reqStart >= reqEnd) {
        return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
      }

      // Check overlaps
      const conflictingBooking = db.bookings.find(b => {
        if (b.assetId !== assetId || b.status === 'Cancelled' || b.status === 'Completed') return false;
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        return reqStart < bEnd && bStart < reqEnd;
      });

      if (conflictingBooking) {
        const holder = db.employees.find(e => e.id === conflictingBooking.employeeId);
        const holderName = holder ? holder.name : 'another employee';
        const formattedConfStart = new Date(conflictingBooking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const formattedConfEnd = new Date(conflictingBooking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return NextResponse.json({
          error: `Overlap conflict: Already booked by ${holderName} from ${formattedConfStart} to ${formattedConfEnd}.`,
          conflict: {
            startTime: conflictingBooking.startTime,
            endTime: conflictingBooking.endTime,
            employeeName: holderName,
            notes: conflictingBooking.notes || `Booked - ${holderName}`
          }
        }, { status: 409 });
      }

      // Create new booking
      const newBooking: Booking = {
        id: `bk-${Date.now()}`,
        assetId,
        employeeId,
        startTime,
        endTime,
        status: 'Upcoming',
        notes: notes || `Booked - ${employee.name}`
      };
      db.bookings.push(newBooking);

      // Create log
      // Format details e.g.: "Room B2 - booking confirmed - 2:00 to 3:00 PM"
      const formatTimeStr = (tStr: string) => {
        return new Date(tStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      };
      
      const logDetails = `${asset.name} - booking confirmed - ${formatTimeStr(startTime)} to ${formatTimeStr(endTime)}`;
      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        action: 'CONFIRM_BOOKING',
        details: logDetails,
        timestamp
      };
      db.logs.push(log);

      // Create notification for employee
      const notif: AppNotification = {
        id: `ntf-${Date.now()}`,
        userId: employee.id,
        title: 'Booking Confirmed',
        message: `Your booking for ${asset.name} on ${new Date(startTime).toLocaleDateString()} from ${formatTimeStr(startTime)} to ${formatTimeStr(endTime)} has been confirmed.`,
        type: 'success',
        isRead: false,
        timestamp
      };
      db.notifications.push(notif);

      saveDb(db);
      return NextResponse.json({ success: true, booking: newBooking });
    }

    if (action === 'CANCEL_BOOKING') {
      const { bookingId } = payload;
      const booking = db.bookings.find(b => b.id === bookingId);

      if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }

      booking.status = 'Cancelled';

      // Log cancellation
      const asset = db.assets.find(a => a.id === booking.assetId);
      const logDetails = `${asset ? asset.name : 'Resource'} - booking cancelled for ${new Date(booking.startTime).toLocaleDateString()}`;
      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        action: 'CANCEL_BOOKING',
        details: logDetails,
        timestamp
      };
      db.logs.push(log);

      saveDb(db);
      return NextResponse.json({ success: true, booking });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

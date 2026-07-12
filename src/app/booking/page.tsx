'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Employee {
  id: string;
  name: string;
  email: string;
  departmentId: string;
}

interface Department {
  id: string;
  name: string;
}

interface BookableAsset {
  id: string;
  name: string;
  categoryId: string;
  serialNumber: string;
  location: string;
  isBookable: boolean;
}

interface Booking {
  id: string;
  assetId: string;
  employeeId: string;
  startTime: string;
  endTime: string;
  status: 'Upcoming' | 'Ongoing' | 'Completed' | 'Cancelled';
  notes?: string;
  assetName?: string;
  employeeName?: string;
  departmentName?: string;
}

interface BookingPageData {
  assets: BookableAsset[];
  employees: Employee[];
  departments: Department[];
  bookings: Booking[];
}

export default function ResourceBookingPage() {
  const [data, setData] = useState<BookingPageData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selector states
  const [selectedAssetId, setSelectedAssetId] = useState<string>('AF-0210'); // Default to Conference room B2
  const [selectedDate, setSelectedDate] = useState<string>('2026-07-07'); // Default to mockup date (Tue, 7 Jul 2026)

  // Booking Form states
  const [bookingEmployeeId, setBookingEmployeeId] = useState<string>('emp-1'); // Priya Shah
  const [bookingTeam, setBookingTeam] = useState<string>('Procurement Team');
  const [bookingStartHour, setBookingStartHour] = useState<string>('09:30'); // Default to mockup conflicting start
  const [bookingEndHour, setBookingEndHour] = useState<string>('10:30'); // Default to mockup conflicting end

  // Conflict simulator / Attempt state
  const [conflictAttempt, setConflictAttempt] = useState<{
    startTime: string;
    endTime: string;
    message: string;
  } | null>(null);

  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/booking');
      if (!res.ok) throw new Error('Failed to fetch booking data');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBookSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId || !bookingEmployeeId || !selectedDate || !bookingStartHour || !bookingEndHour) {
      setFormError('Please fill out all booking fields');
      return;
    }

    const startTimeISO = `${selectedDate}T${bookingStartHour}:00`;
    const endTimeISO = `${selectedDate}T${bookingEndHour}:00`;

    try {
      setFormLoading(true);
      setFormError(null);
      setFormSuccess(null);
      setConflictAttempt(null);

      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_BOOKING',
          payload: {
            assetId: selectedAssetId,
            employeeId: bookingEmployeeId,
            startTime: startTimeISO,
            endTime: endTimeISO,
            notes: bookingTeam ? `Booked - ${bookingTeam} - ${parseInt(bookingStartHour)} to ${parseInt(bookingEndHour)}` : undefined
          },
          userId: bookingEmployeeId
        })
      });

      const result = await res.json();
      
      if (res.status === 409) {
        // Conflict detected
        setConflictAttempt({
          startTime: startTimeISO,
          endTime: endTimeISO,
          message: 'conflict - slot is unavailable'
        });
        setFormError(result.error || 'Overlap Conflict: Slot is unavailable.');
        return;
      }

      if (!res.ok) throw new Error(result.error || 'Failed to book resource');

      setFormSuccess('Booking confirmed successfully!');
      await fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Operation failed');
    } finally {
      setFormLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    try {
      setFormError(null);
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CANCEL_BOOKING',
          payload: { bookingId }
        })
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Failed to cancel booking');
      }

      setFormSuccess('Booking cancelled successfully.');
      await fetchData();
      setTimeout(() => setFormSuccess(null), 3000);
    } catch (err: any) {
      setFormError(err.message || 'Operation failed');
    }
  };

  const simulateConflict = () => {
    setConflictAttempt({
      startTime: `${selectedDate}T09:30:00`,
      endTime: `${selectedDate}T10:30:00`,
      message: 'conflict - slot is unavailable'
    });
    setFormError('Overlap conflict: Already booked by Procurement Team from 09:00 AM to 10:00 AM.');
  };

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="loader"></span>
          <p style={{ marginTop: '16px', fontWeight: 500 }}>Syncing Resource Bookings...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
        <div style={{ textAlign: 'center', padding: '24px', background: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--accent-red)' }}>
          <p style={{ color: 'var(--accent-red)', marginBottom: '16px' }}>{error}</p>
          <button onClick={fetchData} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent-purple)', color: 'white', cursor: 'pointer' }}>Retry</button>
        </div>
      </div>
    );
  }

  const { assets = [], employees = [], departments = [], bookings = [] } = data!;

  const selectedAsset = assets.find(a => a.id === selectedAssetId) || assets[0];

  // Get active bookings for this resource on the selected date
  const activeBookings = bookings.filter(b => {
    if (b.assetId !== selectedAssetId || b.status === 'Cancelled') return false;
    const bDate = b.startTime.split('T')[0];
    return bDate === selectedDate;
  });

  // Hours list for the timeline
  const timelineHours = [
    { label: '9:00', hour: 9 },
    { label: '10:00', hour: 10 },
    { label: '11:00', hour: 11 },
    { label: '12:00', hour: 12 },
    { label: '1:00', hour: 13 },
    { label: '2:00', hour: 14 },
    { label: '3:00', hour: 15 },
    { label: '4:00', hour: 16 },
    { label: '5:00', hour: 17 }
  ];

  // Helper to calculate top offset (80px height per hour, timeline starts at 9:00 AM)
  const getTopOffset = (timeStr: string) => {
    const time = new Date(timeStr);
    const hour = time.getHours();
    const minutes = time.getMinutes();
    
    const minutesSince9AM = (hour - 9) * 60 + minutes;
    const pixelsPerMinute = 80 / 60; // 80px per hour
    
    return Math.max(0, minutesSince9AM * pixelsPerMinute);
  };

  // Helper to calculate height
  const getBookingHeight = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    
    const diffMs = end.getTime() - start.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    const pixelsPerMinute = 80 / 60;
    
    return Math.max(20, diffMinutes * pixelsPerMinute);
  };

  // Human readable title date
  const formatHeaderDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100vw', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      
      {/* TOP HEADER */}
      <header style={{ height: '64px', backgroundColor: 'var(--bg-header)', display: 'flex', alignItems: 'center', padding: '0 24px', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'white', letterSpacing: '-0.3px', cursor: 'pointer' }}>AssetFlow</h1>
        </Link>
      </header>

      {/* BODY CONTAINER */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT SIDEBAR */}
        <aside style={{ width: '240px', borderRight: '1px solid var(--border)', backgroundColor: 'var(--bg-sidebar)', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
          
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>
              Dashboard
            </div>
          </Link>

          <Link href="/setup" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>
              Organization setup
            </div>
          </Link>
          
          <Link href="/assets" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>Assets</div>
          </Link>

          <Link href="/allocation" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>
              Allocation & Transfer
            </div>
          </Link>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '10px 14px', 
            borderRadius: '6px', 
            color: 'var(--accent-purple)', 
            fontWeight: 600, 
            background: 'var(--accent-purple-glow)', 
            border: '1px solid var(--accent-purple)',
            cursor: 'default'
          }}>
            Resource Booking
          </div>

          <Link href="/maintenance" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>Maintenance</div>
          </Link>
          <Link href="/audit" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>Audit</div>
          </Link>
          <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'default' }}>Reports</div>
          <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'default' }}>Notifications</div>

        </aside>

        {/* MAIN PANEL */}
        <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', display: 'flex', gap: '32px' }}>
          
          {/* LEFT COLUMN: SCHEDULER VIEW */}
          <div className="glow-card" style={{ flex: 1.3, padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '500px' }}>
            
            {/* Toolbar: selectors */}
            <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Resource</label>
                <select 
                  value={selectedAssetId} 
                  onChange={(e) => {
                    setSelectedAssetId(e.target.value);
                    setConflictAttempt(null);
                    setFormError(null);
                    setFormSuccess(null);
                  }}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', fontWeight: 500 }}
                >
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                  ))}
                </select>
              </div>

              <div style={{ width: '160px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date</label>
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setConflictAttempt(null);
                    setFormError(null);
                    setFormSuccess(null);
                  }}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>

              <div style={{ alignSelf: 'flex-end' }}>
                <button 
                  onClick={simulateConflict}
                  style={{ padding: '10px 14px', backgroundColor: 'transparent', color: 'var(--accent-red)', border: '1px dashed var(--accent-red)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Simulate Overlap
                </button>
              </div>
            </div>

            {/* Scheduler Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                {selectedAsset ? selectedAsset.name : 'Resource'} — {formatHeaderDate(selectedDate)}
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Timeline: 9:00 AM — 6:00 PM</span>
            </div>

            {/* Timeline Scheduler Grid */}
            <div style={{ display: 'flex', position: 'relative', marginTop: '12px', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)' }}>
              
              {/* Left Hour Markers */}
              <div style={{ width: '70px', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', flexShrink: 0 }}>
                {timelineHours.map(th => (
                  <div key={th.label} style={{ height: '80px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8px 0', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {th.label}
                  </div>
                ))}
              </div>

              {/* Right Content Area with lines */}
              <div style={{ flex: 1, height: '720px', position: 'relative', overflow: 'hidden' }}>
                {/* Horizontal hour lines */}
                {timelineHours.map((th, index) => (
                  <div 
                    key={`line-${th.label}`} 
                    style={{ 
                      position: 'absolute', 
                      top: `${index * 80}px`, 
                      left: 0, 
                      right: 0, 
                      height: '1px', 
                      backgroundColor: 'var(--border)',
                      opacity: 0.7
                    }} 
                  />
                ))}

                {/* Drawn Booking Blocks */}
                {activeBookings.map(b => {
                  const top = getTopOffset(b.startTime);
                  const height = getBookingHeight(b.startTime, b.endTime);
                  
                  // Extract hours for detail label e.g.: "9 to 10"
                  const startHour = new Date(b.startTime).getHours();
                  const endHour = new Date(b.endTime).getHours();
                  const durationStr = `${startHour > 12 ? startHour - 12 : startHour} to ${endHour > 12 ? endHour - 12 : endHour}`;

                  return (
                    <div 
                      key={b.id}
                      style={{
                        position: 'absolute',
                        top: `${top}px`,
                        left: '12px',
                        right: '12px',
                        height: `${height}px`,
                        backgroundColor: '#173e6e', // Solid blue color matching mockup exactly
                        border: '1px solid #2563eb',
                        borderRadius: '6px',
                        color: 'white',
                        padding: '12px 16px',
                        fontSize: '14px',
                        fontWeight: 500,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        zIndex: 10
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{b.notes || `Booked - ${b.employeeName}`}</span>
                        <button 
                          onClick={() => handleCancelBooking(b.id)}
                          style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                        >
                          Cancel
                        </button>
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>
                        Time: {new Date(b.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(b.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  );
                })}

                {/* Overlap Conflict Simulation block (Red dashed) */}
                {conflictAttempt && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: `${getTopOffset(conflictAttempt.startTime)}px`,
                      left: '12px',
                      right: '12px',
                      height: `${getBookingHeight(conflictAttempt.startTime, conflictAttempt.endTime)}px`,
                      border: '2px dashed var(--accent-red)',
                      backgroundColor: 'rgba(217, 83, 79, 0.05)',
                      borderRadius: '6px',
                      color: 'var(--accent-red)',
                      padding: '12px 16px',
                      fontSize: '14px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      zIndex: 20
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: 700 }}>Requested 9:30 to 10:30 - {conflictAttempt.message}</span>
                      <span style={{ fontSize: '11px', opacity: 0.8 }}>Conflict triggered by overlap validation check</span>
                    </div>
                  </div>
                )}

              </div>

            </div>

          </div>

          {/* RIGHT COLUMN: BOOK A SLOT FORM */}
          <div className="glow-card" style={{ flex: 0.8, padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', alignSelf: 'flex-start', minWidth: '320px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              Book a slot
            </h3>

            {formSuccess && (
              <div style={{ padding: '12px', backgroundColor: 'var(--accent-green-glow)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', borderRadius: '6px', fontSize: '13px', fontWeight: 500 }}>
                {formSuccess}
              </div>
            )}

            {formError && (
              <div style={{ padding: '12px', backgroundColor: 'var(--accent-red-glow)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', borderRadius: '6px', fontSize: '13px', fontWeight: 500 }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleBookSlot} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Employee selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Booked For</label>
                <select 
                  value={bookingEmployeeId} 
                  onChange={(e) => setBookingEmployeeId(e.target.value)} 
                  required
                  style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px' }}
                >
                  {employees.map(e => {
                    const deptName = departments.find(d => d.id === e.departmentId)?.name || 'No Dept';
                    return <option key={e.id} value={e.id}>{e.name} ({deptName})</option>;
                  })}
                </select>
              </div>

              {/* Team Name / Notes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Team Name / Purpose</label>
                <input 
                  type="text" 
                  value={bookingTeam} 
                  onChange={(e) => setBookingTeam(e.target.value)}
                  placeholder="e.g. Procurement Team"
                  required
                  style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>

              {/* Booking Time range */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Start Time</label>
                  <select 
                    value={bookingStartHour} 
                    onChange={(e) => setBookingStartHour(e.target.value)}
                    style={{ width: '100%', padding: '9px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px' }}
                  >
                    <option value="09:00">09:00 AM</option>
                    <option value="09:30">09:30 AM</option>
                    <option value="10:00">10:00 AM</option>
                    <option value="10:30">10:30 AM</option>
                    <option value="11:00">11:00 AM</option>
                    <option value="11:30">11:30 AM</option>
                    <option value="12:00">12:00 PM</option>
                    <option value="12:30">12:30 PM</option>
                    <option value="13:00">01:00 PM</option>
                    <option value="13:30">01:30 PM</option>
                    <option value="14:00">02:00 PM</option>
                    <option value="14:30">02:30 PM</option>
                    <option value="15:00">03:00 PM</option>
                    <option value="15:30">03:30 PM</option>
                    <option value="16:00">04:00 PM</option>
                    <option value="16:30">04:30 PM</option>
                    <option value="17:00">05:00 PM</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>End Time</label>
                  <select 
                    value={bookingEndHour} 
                    onChange={(e) => setBookingEndHour(e.target.value)}
                    style={{ width: '100%', padding: '9px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px' }}
                  >
                    <option value="09:30">09:30 AM</option>
                    <option value="10:00">10:00 AM</option>
                    <option value="10:30">10:30 AM</option>
                    <option value="11:00">11:00 AM</option>
                    <option value="11:30">11:30 AM</option>
                    <option value="12:00">12:00 PM</option>
                    <option value="12:30">12:30 PM</option>
                    <option value="13:00">01:00 PM</option>
                    <option value="13:30">01:30 PM</option>
                    <option value="14:00">02:00 PM</option>
                    <option value="14:30">02:30 PM</option>
                    <option value="15:00">03:00 PM</option>
                    <option value="15:30">03:30 PM</option>
                    <option value="16:00">04:00 PM</option>
                    <option value="16:30">04:30 PM</option>
                    <option value="17:00">05:00 PM</option>
                    <option value="17:30">05:30 PM</option>
                    <option value="18:00">06:00 PM</option>
                  </select>
                </div>

              </div>

              <button 
                type="submit" 
                disabled={formLoading}
                style={{ 
                  padding: '12px', 
                  backgroundColor: '#14532d', // green background matching mockup exactly
                  color: '#86efac', 
                  border: '1.5px solid #166534',
                  borderRadius: '6px', 
                  fontWeight: 600, 
                  fontSize: '14px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  marginTop: '10px',
                  opacity: formLoading ? 0.7 : 1
                }}
              >
                Book a slot
              </button>

            </form>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              <strong>Conflict Rule Check:</strong> Two bookings cannot overlap. For example, if Room B2 is booked 9:00 - 10:00, booking 9:30 - 10:30 is blocked, while booking 10:00 - 11:00 succeeds.
            </div>

          </div>

        </main>

      </div>
    </div>
  );
}

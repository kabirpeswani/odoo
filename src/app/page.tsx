'use client';

import React, { useState, useEffect } from 'react';

interface AssetCategory {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  departmentId: string;
  role: 'Admin' | 'Asset Manager' | 'Department Head' | 'Employee';
}

interface Asset {
  id: string;
  name: string;
  categoryId: string;
  serialNumber: string;
  acquisitionDate: string;
  acquisitionCost: number;
  condition: 'New' | 'Good' | 'Fair' | 'Poor';
  location: string;
  status: 'Available' | 'Allocated' | 'Reserved' | 'Under Maintenance' | 'Lost' | 'Retired' | 'Disposed';
  isBookable: boolean;
  currentHolderId: string | null;
  currentDepartmentId: string | null;
  expectedReturnDate: string | null;
  holderName?: string;
  departmentName?: string;
  daysOverdue?: number;
}

interface Booking {
  id: string;
  assetId: string;
  employeeId: string;
  startTime: string;
  endTime: string;
  status: 'Upcoming' | 'Ongoing' | 'Completed' | 'Cancelled';
}

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

interface DashboardData {
  stats: {
    assetsAvailable: number;
    assetsAllocated: number;
    activeBookings: number;
    maintenanceToday: number;
    pendingTransfers: number;
    upcomingReturns: number;
  };
  overdueReturns: Asset[];
  upcomingReturnsList: Asset[];
  recentLogs: ActivityLog[];
  assets: Asset[];
  bookings: Booking[];
  employees: Employee[];
  categories: AssetCategory[];
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [activeModal, setActiveModal] = useState<'register' | 'book' | 'maintenance' | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  // Form states
  const [registerForm, setRegisterForm] = useState({
    name: '',
    categoryId: '',
    serialNumber: '',
    acquisitionCost: '',
    condition: 'New' as const,
    location: '',
    isBookable: false
  });

  const [bookForm, setBookForm] = useState({
    assetId: '',
    employeeId: '',
    startTime: '2026-07-12T14:00',
    endTime: '2026-07-12T15:00'
  });

  const [maintenanceForm, setMaintenanceForm] = useState({
    assetId: '',
    issueDescription: '',
    priority: 'Medium' as const
  });

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      const json = await res.json();
      setData(json);
      setError(null);
      
      // Setup initial selections
      if (json.categories.length > 0) {
        setRegisterForm(prev => ({ ...prev, categoryId: json.categories[0].id }));
      }
      if (json.assets.length > 0) {
        const firstBookable = json.assets.find((a: Asset) => a.isBookable) || json.assets[0];
        setBookForm(prev => ({
          ...prev,
          assetId: firstBookable.id,
          employeeId: json.employees[0]?.id || ''
        }));
        setMaintenanceForm(prev => ({
          ...prev,
          assetId: json.assets[0].id
        }));
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Handle Quick Actions
  const handleAction = async (action: string, payload: any) => {
    try {
      setModalLoading(true);
      setModalError(null);
      setModalSuccess(null);

      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload, userId: 'emp-3' }) // Simulate Kabir
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to execute action');
      }

      setModalSuccess('Action completed successfully!');
      await fetchDashboardData();
      
      setTimeout(() => {
        setActiveModal(null);
        setModalSuccess(null);
      }, 1200);

    } catch (err: any) {
      setModalError(err.message || 'Operation failed');
    } finally {
      setModalLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', background: '#090A0F', color: '#94A3B8' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="loader"></span>
          <p style={{ marginTop: '16px', fontWeight: 500 }}>Syncing AssetFlow...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', background: '#090A0F', color: '#94A3B8' }}>
        <div style={{ textAlign: 'center', padding: '24px', background: '#11121A', borderRadius: '12px', border: '1px solid #EF4444' }}>
          <p style={{ color: '#EF4444', marginBottom: '16px' }}>{error}</p>
          <button onClick={fetchDashboardData} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#3B82F6', color: 'white', cursor: 'pointer' }}>Retry</button>
        </div>
      </div>
    );
  }

  const { stats, overdueReturns, recentLogs, assets, employees, categories } = data!;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100vw', backgroundColor: '#090A0F', color: '#F8FAFC' }}>
      
      {/* TOP HEADER */}
      <header style={{ height: '64px', borderBottom: '1px solid #1E202B', display: 'flex', alignItems: 'center', padding: '0 24px', flexShrink: 0 }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'white', letterSpacing: '-0.3px' }}>AssetFlow</h1>
      </header>

      {/* BODY CONTENT CONTAINER */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT SIDEBAR */}
        <aside style={{ width: '240px', borderRight: '1px solid #1E202B', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '10px 14px', 
            borderRadius: '8px', 
            color: '#34D399', 
            fontWeight: 600, 
            background: 'rgba(16, 185, 129, 0.05)', 
            border: '1px solid #10B981',
            cursor: 'default'
          }}>
            Dashboard
          </div>

          <div style={{ padding: '10px 14px', color: '#94A3B8', fontWeight: 500, cursor: 'default' }}>Organization setup</div>
          <div style={{ padding: '10px 14px', color: '#94A3B8', fontWeight: 500, cursor: 'default' }}>Assets</div>
          <div style={{ padding: '10px 14px', color: '#94A3B8', fontWeight: 500, cursor: 'default' }}>Allocation & Transfer</div>
          <div style={{ padding: '10px 14px', color: '#94A3B8', fontWeight: 500, cursor: 'default' }}>Resource Booking</div>
          <div style={{ padding: '10px 14px', color: '#94A3B8', fontWeight: 500, cursor: 'default' }}>Maintenance</div>
          <div style={{ padding: '10px 14px', color: '#94A3B8', fontWeight: 500, cursor: 'default' }}>Audit</div>
          <div style={{ padding: '10px 14px', color: '#94A3B8', fontWeight: 500, cursor: 'default' }}>Reports</div>
          <div style={{ padding: '10px 14px', color: '#94A3B8', fontWeight: 500, cursor: 'default' }}>Notifications</div>

        </aside>

        {/* MAIN OPERATIONS PANEL */}
        <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* TITLE */}
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'white', letterSpacing: '-0.3px' }}>Today's Overview</h2>

          {/* KPI CARDS GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            
            {/* Card 1: Available */}
            <div style={{ background: '#11121A', border: '1px solid #1E202B', borderRadius: '12px', padding: '20px 24px' }}>
              <div style={{ color: '#94A3B8', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Available</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'white' }}>{stats.assetsAvailable}</div>
            </div>

            {/* Card 2: Allocated */}
            <div style={{ background: '#11121A', border: '1px solid #1E202B', borderRadius: '12px', padding: '20px 24px' }}>
              <div style={{ color: '#94A3B8', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Allocated</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'white' }}>{stats.assetsAllocated}</div>
            </div>

            {/* Card 3: Available (Maintenance count 4 in mockup) */}
            <div style={{ background: '#11121A', border: '1px solid #1E202B', borderRadius: '12px', padding: '20px 24px' }}>
              <div style={{ color: '#94A3B8', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Available</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'white' }}>{stats.maintenanceToday}</div>
            </div>

            {/* Card 4: Active Bookings */}
            <div style={{ background: '#11121A', border: '1px solid #1E202B', borderRadius: '12px', padding: '20px 24px' }}>
              <div style={{ color: '#94A3B8', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Active Bookings</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'white' }}>{stats.activeBookings}</div>
            </div>

            {/* Card 5: Pending Transfers */}
            <div style={{ background: '#11121A', border: '1px solid #1E202B', borderRadius: '12px', padding: '20px 24px' }}>
              <div style={{ color: '#94A3B8', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Pending Transfers</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'white' }}>{stats.pendingTransfers}</div>
            </div>

            {/* Card 6: Upcoming returns */}
            <div style={{ background: '#11121A', border: '1px solid #1E202B', borderRadius: '12px', padding: '20px 24px' }}>
              <div style={{ color: '#94A3B8', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Upcoming returns</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'white' }}>{stats.upcomingReturns}</div>
            </div>

          </div>

          {/* OVERDUE ALERTS BAR */}
          <div style={{ 
            backgroundColor: 'rgba(239, 68, 68, 0.08)', 
            border: '1px solid rgba(239, 68, 68, 0.25)', 
            color: '#F87171', 
            padding: '14px 20px', 
            borderRadius: '10px', 
            fontSize: '14px', 
            fontWeight: 600, 
            display: 'flex', 
            alignItems: 'center' 
          }}>
            {overdueReturns.length} assets overdue for return - flagged for follow-up
          </div>

          {/* ACTIONS ROW */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            
            {/* Register Asset Button */}
            <button 
              onClick={() => setActiveModal('register')}
              style={{ 
                padding: '14px', 
                borderRadius: '8px', 
                border: '1px solid #10B981', 
                backgroundColor: 'rgba(16, 185, 129, 0.05)', 
                color: '#34D399', 
                fontWeight: 600, 
                fontSize: '14px',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              + register asset
            </button>

            {/* Book Resource Button */}
            <button 
              onClick={() => setActiveModal('book')}
              style={{ 
                padding: '14px', 
                borderRadius: '8px', 
                border: '1px solid #1E202B', 
                backgroundColor: '#11121A', 
                color: 'white', 
                fontWeight: 600, 
                fontSize: '14px',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              Book resource
            </button>

            {/* Raise Requests Button */}
            <button 
              onClick={() => setActiveModal('maintenance')}
              style={{ 
                padding: '14px', 
                borderRadius: '8px', 
                border: '1px solid #1E202B', 
                backgroundColor: '#11121A', 
                color: 'white', 
                fontWeight: 600, 
                fontSize: '14px',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              Raise requests
            </button>

          </div>

          {/* RECENT ACTIVITY SECTION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>Recent Activity</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentLogs.map((log) => (
                <div key={log.id} style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.5' }}>
                  {log.details}
                </div>
              ))}
            </div>
          </div>

        </main>

      </div>

      {/* ==================== REGISTER ASSET MODAL ==================== */}
      {activeModal === 'register' && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ width: '460px', backgroundColor: '#11121A', border: '1px solid #1E202B', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #1E202B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'white' }}>Register Asset</h3>
              <button onClick={() => { setActiveModal(null); setModalError(null); }} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              {modalError && <div style={{ padding: '10px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', color: '#EF4444', borderRadius: '6px', marginBottom: '14px', fontSize: '12px' }}>{modalError}</div>}
              {modalSuccess && <div style={{ padding: '10px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10B981', color: '#34D399', borderRadius: '6px', marginBottom: '14px', fontSize: '12px' }}>{modalSuccess}</div>}
              <form onSubmit={(e) => { e.preventDefault(); handleAction('REGISTER_ASSET', registerForm); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Asset Name *</label>
                  <input type="text" required placeholder="e.g. MacBook Pro M3" value={registerForm.name} onChange={(e) => setRegisterForm(prev => ({ ...prev, name: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #1E202B', backgroundColor: '#090A0F', color: 'white', fontSize: '13px', outline: 'none' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Category</label>
                    <select value={registerForm.categoryId} onChange={(e) => setRegisterForm(prev => ({ ...prev, categoryId: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #1E202B', backgroundColor: '#090A0F', color: 'white', fontSize: '13px', outline: 'none' }}>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Serial Number</label>
                    <input type="text" placeholder="e.g. SN-88219" value={registerForm.serialNumber} onChange={(e) => setRegisterForm(prev => ({ ...prev, serialNumber: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #1E202B', backgroundColor: '#090A0F', color: 'white', fontSize: '13px', outline: 'none' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Location *</label>
                  <input type="text" required placeholder="e.g. 3rd Floor Desk A" value={registerForm.location} onChange={(e) => setRegisterForm(prev => ({ ...prev, location: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #1E202B', backgroundColor: '#090A0F', color: 'white', fontSize: '13px', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <input type="checkbox" id="isBookable" checked={registerForm.isBookable} onChange={(e) => setRegisterForm(prev => ({ ...prev, isBookable: e.target.checked }))} style={{ cursor: 'pointer' }} />
                  <label htmlFor="isBookable" style={{ fontSize: '12px', color: '#94A3B8', cursor: 'pointer' }}>Enable shared booking for this resource</label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                  <button type="button" onClick={() => { setActiveModal(null); setModalError(null); }} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #1E202B', backgroundColor: 'transparent', color: '#94A3B8', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                  <button type="submit" disabled={modalLoading} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#10B981', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>{modalLoading ? 'Saving...' : 'Register'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==================== BOOK RESOURCE MODAL ==================== */}
      {activeModal === 'book' && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ width: '460px', backgroundColor: '#11121A', border: '1px solid #1E202B', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #1E202B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'white' }}>Book Resource</h3>
              <button onClick={() => { setActiveModal(null); setModalError(null); }} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              {modalError && <div style={{ padding: '10px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', color: '#EF4444', borderRadius: '6px', marginBottom: '14px', fontSize: '12px' }}>{modalError}</div>}
              {modalSuccess && <div style={{ padding: '10px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10B981', color: '#34D399', borderRadius: '6px', marginBottom: '14px', fontSize: '12px' }}>{modalSuccess}</div>}
              <form onSubmit={(e) => { e.preventDefault(); handleAction('BOOK_RESOURCE', bookForm); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Select Bookable Resource *</label>
                  <select value={bookForm.assetId} onChange={(e) => setBookForm(prev => ({ ...prev, assetId: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #1E202B', backgroundColor: '#090A0F', color: 'white', fontSize: '13px', outline: 'none' }}>
                    {assets.filter(a => a.isBookable).map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Book For Employee *</label>
                  <select value={bookForm.employeeId} onChange={(e) => setBookForm(prev => ({ ...prev, employeeId: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #1E202B', backgroundColor: '#090A0F', color: 'white', fontSize: '13px', outline: 'none' }}>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Start Date & Time</label>
                    <input type="datetime-local" value={bookForm.startTime} onChange={(e) => setBookForm(prev => ({ ...prev, startTime: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #1E202B', backgroundColor: '#090A0F', color: 'white', fontSize: '13px', outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>End Date & Time</label>
                    <input type="datetime-local" value={bookForm.endTime} onChange={(e) => setBookForm(prev => ({ ...prev, endTime: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #1E202B', backgroundColor: '#090A0F', color: 'white', fontSize: '13px', outline: 'none' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                  <button type="button" onClick={() => { setActiveModal(null); setModalError(null); }} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #1E202B', backgroundColor: 'transparent', color: '#94A3B8', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                  <button type="submit" disabled={modalLoading} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#3B82F6', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>{modalLoading ? 'Booking...' : 'Book Resource'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==================== RAISE REQUESTS MODAL ==================== */}
      {activeModal === 'maintenance' && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ width: '460px', backgroundColor: '#11121A', border: '1px solid #1E202B', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #1E202B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'white' }}>Raise Request</h3>
              <button onClick={() => { setActiveModal(null); setModalError(null); }} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              {modalError && <div style={{ padding: '10px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', color: '#EF4444', borderRadius: '6px', marginBottom: '14px', fontSize: '12px' }}>{modalError}</div>}
              {modalSuccess && <div style={{ padding: '10px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10B981', color: '#34D399', borderRadius: '6px', marginBottom: '14px', fontSize: '12px' }}>{modalSuccess}</div>}
              <form onSubmit={(e) => { e.preventDefault(); handleAction('RAISE_MAINTENANCE', maintenanceForm); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Select Asset needing Service *</label>
                  <select value={maintenanceForm.assetId} onChange={(e) => setMaintenanceForm(prev => ({ ...prev, assetId: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #1E202B', backgroundColor: '#090A0F', color: 'white', fontSize: '13px', outline: 'none' }}>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Describe Issue *</label>
                  <textarea required rows={4} placeholder="What needs repair or service?" value={maintenanceForm.issueDescription} onChange={(e) => setMaintenanceForm(prev => ({ ...prev, issueDescription: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #1E202B', backgroundColor: '#090A0F', color: 'white', fontSize: '13px', outline: 'none', resize: 'none' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                  <button type="button" onClick={() => { setActiveModal(null); setModalError(null); }} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #1E202B', backgroundColor: 'transparent', color: '#94A3B8', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                  <button type="submit" disabled={modalLoading} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#8B5CF6', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>{modalLoading ? 'Submitting...' : 'Raise Request'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

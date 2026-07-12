'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface AssetCategory {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  name: string;
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
}

interface DashboardData {
  assets: Asset[];
  categories: AssetCategory[];
  departments: Department[];
  employees: Employee[];
}

export default function AssetDirectory() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  // Register Modal state
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  const [registerForm, setRegisterForm] = useState({
    name: '',
    categoryId: 'cat-1',
    serialNumber: '',
    acquisitionCost: '',
    condition: 'New' as const,
    location: '',
    isBookable: false
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to fetch asset directory');
      const json = await res.json();
      setData(json);
      setError(null);
      
      if (json.categories.length > 0) {
        setRegisterForm(prev => ({ ...prev, categoryId: json.categories[0].id }));
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setModalLoading(true);
      setModalError(null);
      setModalSuccess(null);

      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REGISTER_ASSET',
          payload: registerForm,
          userId: 'emp-3' // simulated user Kabir
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to register asset');

      setModalSuccess('Asset registered successfully!');
      await fetchData();

      setTimeout(() => {
        setShowRegisterModal(false);
        setModalSuccess(null);
        setRegisterForm({
          name: '',
          categoryId: data?.categories[0]?.id || 'cat-1',
          serialNumber: '',
          acquisitionCost: '',
          condition: 'New',
          location: '',
          isBookable: false
        });
      }, 1200);

    } catch (err: any) {
      setModalError(err.message || 'Registration failed');
    } finally {
      setModalLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="loader"></span>
          <p style={{ marginTop: '16px', fontWeight: 500 }}>Loading Asset Directory...</p>
        </div>
      </div>
    );
  }

  const { assets = [], categories = [], departments = [] } = data || {};

  // Filter Logic
  const filteredAssets = assets.filter(asset => {
    // Search query match (tag, name, serial number, or location)
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      asset.id.toLowerCase().includes(query) || 
      asset.name.toLowerCase().includes(query) || 
      asset.serialNumber.toLowerCase().includes(query) ||
      asset.location.toLowerCase().includes(query);

    // Category filter
    const matchesCategory = selectedCategory === 'all' || asset.categoryId === selectedCategory;

    // Status filter
    const matchesStatus = selectedStatus === 'all' || asset.status === selectedStatus;

    // Department filter
    const matchesDepartment = selectedDepartment === 'all' || asset.currentDepartmentId === selectedDepartment;

    return matchesSearch && matchesCategory && matchesStatus && matchesDepartment;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100vw', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      
      {/* TOP HEADER */}
      <header style={{ height: '64px', backgroundColor: 'var(--bg-header)', display: 'flex', alignItems: 'center', padding: '0 24px', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'white', letterSpacing: '-0.3px' }}>AssetFlow</h1>
      </header>

      {/* BODY CONTENT CONTAINER */}
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
            Assets
          </div>

          <Link href="/allocation" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>Allocation & Transfer</div>
          </Link>
          <Link href="/booking" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>Resource Booking</div>
          </Link>
          <Link href="/maintenance" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>Maintenance</div>
          </Link>
          <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'default' }}>Audit</div>
          <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'default' }}>Reports</div>
          <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'default' }}>Notifications</div>

        </aside>

        {/* MAIN PANEL */}
        <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* SEARCH & REGISTER HEADER ROW */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexShrink: 0 }}>
            
            {/* Search Bar */}
            <div style={{ position: 'relative', flex: 1, maxWidth: '480px' }}>
              <input 
                type="text" 
                placeholder="Search by tag, serial, or QR code.." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '12px 14px', 
                  borderRadius: '6px', 
                  border: '1px solid var(--border)', 
                  backgroundColor: 'var(--bg-card)', 
                  color: 'var(--text-primary)', 
                  outline: 'none', 
                  fontSize: '14px',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                }}
              />
            </div>

            {/* Register Asset Button */}
            <button 
              onClick={() => setShowRegisterModal(true)}
              style={{ 
                padding: '12px 18px', 
                borderRadius: '6px', 
                border: 'none', 
                backgroundColor: 'var(--accent-purple)', 
                color: 'white', 
                fontWeight: 600, 
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(113, 75, 103, 0.15)'
              }}
            >
              + Register Asset
            </button>

          </div>

          {/* FILTER ROW */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', flexShrink: 0 }}>
            
            {/* Category Filter */}
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ 
                padding: '10px 14px', 
                borderRadius: '6px', 
                border: '1px solid var(--border)', 
                backgroundColor: 'var(--bg-card)', 
                color: 'var(--text-secondary)', 
                fontSize: '14px',
                fontWeight: 500,
                outline: 'none',
                cursor: 'pointer',
                minWidth: '150px'
              }}
            >
              <option value="all">Category: All</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* Status Filter */}
            <select 
              value={selectedStatus} 
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{ 
                padding: '10px 14px', 
                borderRadius: '6px', 
                border: '1px solid var(--border)', 
                backgroundColor: 'var(--bg-card)', 
                color: 'var(--text-secondary)', 
                fontSize: '14px',
                fontWeight: 500,
                outline: 'none',
                cursor: 'pointer',
                minWidth: '150px'
              }}
            >
              <option value="all">Status: All</option>
              <option value="Available">Available</option>
              <option value="Allocated">Allocated</option>
              <option value="Reserved">Reserved</option>
              <option value="Under Maintenance">Under Maintenance</option>
              <option value="Lost">Lost</option>
              <option value="Retired">Retired</option>
              <option value="Disposed">Disposed</option>
            </select>

            {/* Department Filter */}
            <select 
              value={selectedDepartment} 
              onChange={(e) => setSelectedDepartment(e.target.value)}
              style={{ 
                padding: '10px 14px', 
                borderRadius: '6px', 
                border: '1px solid var(--border)', 
                backgroundColor: 'var(--bg-card)', 
                color: 'var(--text-secondary)', 
                fontSize: '14px',
                fontWeight: 500,
                outline: 'none',
                cursor: 'pointer',
                minWidth: '150px'
              }}
            >
              <option value="all">Department: All</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>

          </div>

          {/* ASSETS LIST TABLE */}
          <div className="glow-card" style={{ overflow: 'hidden', marginTop: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: '#fcfcfd' }}>
                  <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Tag</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Name</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Category</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Location</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No assets found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => {
                    const catName = categories.find(c => c.id === asset.categoryId)?.name || 'Uncategorized';
                    return (
                      <tr key={asset.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--accent-purple)' }}>{asset.id}</td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>{asset.name}</td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>{catName}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ 
                            fontSize: '11px', 
                            fontWeight: 700, 
                            color: asset.status === 'Available' ? 'var(--accent-green)' : asset.status === 'Allocated' ? 'var(--accent-blue)' : asset.status === 'Under Maintenance' ? 'var(--accent-purple)' : 'var(--text-muted)',
                            backgroundColor: asset.status === 'Available' ? 'var(--accent-green-glow)' : asset.status === 'Allocated' ? 'var(--accent-blue-glow)' : asset.status === 'Under Maintenance' ? 'var(--accent-purple-glow)' : 'var(--border)',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            {asset.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>{asset.location}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </main>

      </div>

      {/* ==================== REGISTER ASSET MODAL ==================== */}
      {showRegisterModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ width: '460px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Register Asset</h3>
              <button onClick={() => { setShowRegisterModal(false); setModalError(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              {modalError && <div style={{ padding: '10px', backgroundColor: 'var(--accent-red-glow)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', borderRadius: '6px', marginBottom: '14px', fontSize: '12px' }}>{modalError}</div>}
              {modalSuccess && <div style={{ padding: '10px', backgroundColor: 'var(--accent-green-glow)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', borderRadius: '6px', marginBottom: '14px', fontSize: '12px' }}>{modalSuccess}</div>}
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Asset Name *</label>
                  <input type="text" required placeholder="e.g. MacBook Pro M3" value={registerForm.name} onChange={(e) => setRegisterForm(prev => ({ ...prev, name: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Category</label>
                    <select value={registerForm.categoryId} onChange={(e) => setRegisterForm(prev => ({ ...prev, categoryId: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Serial Number</label>
                    <input type="text" placeholder="e.g. SN-88219" value={registerForm.serialNumber} onChange={(e) => setRegisterForm(prev => ({ ...prev, serialNumber: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Location *</label>
                  <input type="text" required placeholder="e.g. 3rd Floor Desk A" value={registerForm.location} onChange={(e) => setRegisterForm(prev => ({ ...prev, location: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <input type="checkbox" id="isBookable" checked={registerForm.isBookable} onChange={(e) => setRegisterForm(prev => ({ ...prev, isBookable: e.target.checked }))} style={{ cursor: 'pointer' }} />
                  <label htmlFor="isBookable" style={{ fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>Enable shared booking for this resource</label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                  <button type="button" onClick={() => { setShowRegisterModal(false); setModalError(null); }} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                  <button type="submit" disabled={modalLoading} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--accent-purple)', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>{modalLoading ? 'Saving...' : 'Register'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

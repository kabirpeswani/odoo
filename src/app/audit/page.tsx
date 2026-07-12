'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface AuditCycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Closed';
  auditors: string[];
  auditorNames: string[];
  assetChecks: Record<string, { status: 'Verified' | 'Missing' | 'Damaged'; checkedAt: string }>;
  discrepancyCount: number;
}

interface Asset {
  id: string;
  name: string;
  location: string;
  status: string;
}

interface AuditPageData {
  audits: AuditCycle[];
  assets: Asset[];
}

export default function AssetAuditPage() {
  const [data, setData] = useState<AuditPageData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCycleId, setActiveCycleId] = useState<string>('audit-q3-eng');

  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/audit');
      if (!res.ok) throw new Error('Failed to fetch audit data');
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

  const handleUpdateCheck = async (assetId: string, checkStatus: 'Verified' | 'Missing' | 'Damaged') => {
    if (activeAudit && activeAudit.status === 'Closed') return;
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_CHECK',
          payload: {
            auditId: activeCycleId,
            assetId,
            checkStatus
          }
        })
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Failed to update check');
      }

      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    }
  };

  const handleCloseAuditCycle = async () => {
    if (!window.confirm('Are you sure you want to close this audit cycle? This will lock the audit checks and automatically update asset statuses (e.g. marking missing items as "Lost").')) return;
    try {
      setActionLoading(true);
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CLOSE_CYCLE',
          payload: {
            auditId: activeCycleId
          }
        })
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Failed to close audit cycle');
      }

      setActionSuccess('Audit cycle has been successfully closed and asset records updated.');
      await fetchData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="loader"></span>
          <p style={{ marginTop: '16px', fontWeight: 500 }}>Syncing Audit Cycles...</p>
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

  const { audits = [], assets = [] } = data!;
  const activeAudit = audits.find(a => a.id === activeCycleId);

  // Define checklist assets matching mockup expected layout:
  // Row 1: AF-0003 (Dell laptop) expected at Desk E12
  // Row 2: AF-9921 (Office chair) expected at Desk E14
  // Row 3: AF-9838 (Monitor) expected at Desk E15
  const checklistAssetIds = ['AF-0003', 'AF-9921', 'AF-9838'];
  const checklistAssets = checklistAssetIds.map(id => {
    const asset = assets.find(a => a.id === id);
    return {
      id,
      name: asset ? asset.name : 'Unknown Asset',
      location: asset ? asset.location : 'Unknown Desk',
      status: asset ? asset.status : 'Unknown'
    };
  });

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

          <Link href="/booking" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>
              Resource Booking
            </div>
          </Link>

          <Link href="/maintenance" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>
              Maintenance
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
            Audit
          </div>

          <Link href="/reports" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>Reports</div>
          </Link>
          <Link href="/notifications" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>Notifications</div>
          </Link>

        </aside>

        {/* MAIN PANEL */}
        <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Header row */}
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Asset Audit</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Verify physical asset presence and condition in designated scopes</p>
          </div>

          {actionSuccess && (
            <div style={{ padding: '14px 20px', backgroundColor: 'var(--accent-green-glow)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', borderRadius: '6px', fontSize: '14px', fontWeight: 500 }}>
              {actionSuccess}
            </div>
          )}

          {activeAudit ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Active Audit Cycle Card - styled brown exactly matching mockup */}
              <div style={{ 
                backgroundColor: '#3e2b26', // brown background matching mockup exactly
                border: '1px solid #78350f', 
                borderRadius: '8px', 
                padding: '24px', 
                color: '#fef3c7',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.06)'
              }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>
                  {activeAudit.name} — {formatCycleDate(activeAudit.startDate)} to {formatCycleDate(activeAudit.endDate)}
                </h3>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>
                  <strong>Auditors:</strong> {activeAudit.auditorNames.map(name => {
                    // format full names to initials style like mockup "A. Rao, S. Iqbal"
                    const parts = name.split(' ');
                    if (parts.length >= 2) {
                      return `${parts[0][0]}. ${parts[1]}`;
                    }
                    return name;
                  }).join(', ')}
                </div>
                <div style={{ fontSize: '12px', marginTop: '6px', display: 'inline-flex', alignSelf: 'flex-start', padding: '3px 8px', borderRadius: '12px', backgroundColor: activeAudit.status === 'Active' ? 'var(--accent-green-glow)' : 'var(--border)', color: activeAudit.status === 'Active' ? 'var(--accent-green)' : 'var(--text-secondary)', border: activeAudit.status === 'Active' ? '1px solid var(--accent-green)' : '1px solid var(--border)', fontWeight: 600 }}>
                  {activeAudit.status === 'Active' ? 'Active' : 'Closed & Locked'}
                </div>
              </div>

              {/* Checklist Table */}
              <div className="glow-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', borderBottom: '2px solid var(--border)', paddingBottom: '12px', fontWeight: 700, fontSize: '14px', color: 'var(--text-secondary)' }}>
                  <div>Asset</div>
                  <div>Expected location</div>
                  <div style={{ textAlign: 'center' }}>Verification</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {checklistAssets.map(asset => {
                    const check = activeAudit.assetChecks[asset.id];
                    const checkStatus = check ? check.status : null;
                    const isClosed = activeAudit.status === 'Closed';

                    return (
                      <div 
                        key={asset.id} 
                        style={{ 
                          display: 'grid', 
                          gridTemplateColumns: '1.2fr 1fr 1.2fr', 
                          padding: '16px 0', 
                          borderBottom: '1px solid var(--border)', 
                          alignItems: 'center',
                          fontSize: '14px'
                        }}
                      >
                        {/* Asset Column */}
                        <div style={{ fontWeight: 600 }}>
                          {asset.id} {asset.name}
                        </div>

                        {/* Location Column */}
                        <div style={{ color: 'var(--text-secondary)' }}>
                          {asset.location}
                        </div>

                        {/* Action buttons columns */}
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          
                          {/* Verified button */}
                          <button
                            type="button"
                            disabled={isClosed}
                            onClick={() => handleUpdateCheck(asset.id, 'Verified')}
                            style={{
                              padding: '6px 16px',
                              borderRadius: '20px',
                              border: checkStatus === 'Verified' ? '2px solid #10b981' : '1.5px solid var(--border)',
                              backgroundColor: checkStatus === 'Verified' ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                              color: checkStatus === 'Verified' ? '#10b981' : 'var(--text-muted)',
                              fontWeight: 700,
                              cursor: isClosed ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            Verified
                          </button>

                          {/* Missing button */}
                          <button
                            type="button"
                            disabled={isClosed}
                            onClick={() => handleUpdateCheck(asset.id, 'Missing')}
                            style={{
                              padding: '6px 16px',
                              borderRadius: '20px',
                              border: checkStatus === 'Missing' ? '2px solid var(--accent-red)' : '1.5px solid var(--border)',
                              backgroundColor: checkStatus === 'Missing' ? 'rgba(217, 83, 79, 0.08)' : 'transparent',
                              color: checkStatus === 'Missing' ? 'var(--accent-red)' : 'var(--text-muted)',
                              fontWeight: 700,
                              cursor: isClosed ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            Missing
                          </button>

                          {/* Damaged button */}
                          <button
                            type="button"
                            disabled={isClosed}
                            onClick={() => handleUpdateCheck(asset.id, 'Damaged')}
                            style={{
                              padding: '6px 16px',
                              borderRadius: '20px',
                              border: checkStatus === 'Damaged' ? '2px solid var(--text-muted)' : '1.5px solid var(--border)',
                              backgroundColor: checkStatus === 'Damaged' ? 'rgba(134, 142, 150, 0.08)' : 'transparent',
                              color: checkStatus === 'Damaged' ? 'var(--text-muted)' : 'var(--text-muted)',
                              fontWeight: 700,
                              cursor: isClosed ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            Damaged
                          </button>

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Discrepancy report Alert Banner */}
              {activeAudit.discrepancyCount > 0 && (
                <div style={{
                  backgroundColor: '#451a03', // Dark brown/amber background matching mockup
                  border: '1px solid #92400e',
                  color: '#fef3c7',
                  padding: '16px 24px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                }}>
                  {activeAudit.discrepancyCount} assets flagged - discrepancy report generated automatically
                </div>
              )}

              {/* Action Close Button */}
              {activeAudit.status === 'Active' && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleCloseAuditCycle}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#14532d', // green background Odoo button
                    color: '#86efac', 
                    border: '1.5px solid #166534',
                    borderRadius: '6px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '14px',
                    alignSelf: 'flex-start',
                    boxShadow: '0 2px 4px rgba(22, 101, 52, 0.2)',
                    transition: 'all 0.2s',
                    opacity: actionLoading ? 0.7 : 1
                  }}
                >
                  Close audit cycle
                </button>
              )}

            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px', border: '2px dashed var(--border)', borderRadius: '8px', color: 'var(--text-muted)' }}>
              No active audit cycles found.
            </div>
          )}

        </main>

      </div>
    </div>
  );
}

// Helper formatting date
function formatCycleDate(dateStr: string) {
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toLowerCase();
  return `${day} ${month}`;
}

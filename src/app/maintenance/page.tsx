'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Asset {
  id: string;
  name: string;
  categoryId: string;
  status: string;
  location: string;
}

interface MaintenanceRequest {
  id: string;
  assetId: string;
  issueDescription: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Pending' | 'Approved' | 'Technician Assigned' | 'In Progress' | 'Resolved';
  requestedById: string;
  requestDate: string;
  notes?: string;
  assetName?: string;
  assetCategory?: string;
  requesterName?: string;
}

interface MaintenancePageData {
  maintenance: MaintenanceRequest[];
  assets: Asset[];
  employees: { id: string; name: string }[];
}

export default function MaintenanceKanbanPage() {
  const [data, setData] = useState<MaintenancePageData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // New request modal & form states
  const [showModal, setShowModal] = useState<boolean>(false);
  const [newRequestAssetId, setNewRequestAssetId] = useState<string>('');
  const [newRequestIssue, setNewRequestIssue] = useState<string>('');
  const [newRequestPriority, setNewRequestPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  
  // Status transition helper states (for inputs like technician name)
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const [transitionNotes, setTransitionNotes] = useState<string>('');
  const [targetStatus, setTargetStatus] = useState<MaintenanceRequest['status'] | null>(null);
  const [draggedOverCol, setDraggedOverCol] = useState<string | null>(null);

  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/maintenance');
      if (!res.ok) throw new Error('Failed to fetch maintenance requests');
      const json = await res.json();
      setData(json);
      setError(null);
      if (json.assets.length > 0 && !newRequestAssetId) {
        setNewRequestAssetId(json.assets[0].id);
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

  const handleUpdateStatus = async (requestId: string, newStatus: MaintenanceRequest['status'], notes?: string) => {
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_STATUS',
          payload: { requestId, newStatus, notes }
        })
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Failed to update status');
      }

      setTransitioningId(null);
      setTransitionNotes('');
      setTargetStatus(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequestAssetId || !newRequestIssue) {
      setFormError('Please select an asset and describe the issue');
      return;
    }

    try {
      setFormLoading(true);
      setFormError(null);
      setFormSuccess(null);

      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_REQUEST',
          payload: {
            assetId: newRequestAssetId,
            issueDescription: newRequestIssue,
            priority: newRequestPriority
          },
          userId: 'emp-1' // Simulate request raised by Priya
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to create request');

      setFormSuccess('Maintenance request submitted successfully!');
      setNewRequestIssue('');
      await fetchData();
      setTimeout(() => {
        setShowModal(false);
        setFormSuccess(null);
      }, 1200);
    } catch (err: any) {
      setFormError(err.message || 'Operation failed');
    } finally {
      setFormLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="loader"></span>
          <p style={{ marginTop: '16px', fontWeight: 500 }}>Syncing Kanban Board...</p>
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

  const { maintenance = [], assets = [] } = data!;

  const columns: { title: string; status: MaintenanceRequest['status'] }[] = [
    { title: 'Pending', status: 'Pending' },
    { title: 'Approved', status: 'Approved' },
    { title: 'Technician assigned', status: 'Technician Assigned' },
    { title: 'in progress', status: 'In Progress' },
    { title: 'Resolved', status: 'Resolved' }
  ];

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
            Maintenance
          </div>

          <Link href="/audit" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>Audit</div>
          </Link>
          <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'default' }}>Reports</div>
          <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'default' }}>Notifications</div>

        </aside>

        {/* MAIN PANEL */}
        <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Maintenance Management</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Approval & repairs workflow kanban board</p>
            </div>
            <button 
              onClick={() => setShowModal(true)}
              style={{ padding: '10px 20px', backgroundColor: 'var(--accent-purple)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            >
              + Raise Request
            </button>
          </div>

          {/* Kanban Board Row Container */}
          <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', flex: 1, paddingBottom: '16px', minHeight: '580px', alignItems: 'stretch' }}>
            
            {columns.map(col => {
              const colRequests = maintenance.filter(m => m.status === col.status);
              const isDraggedOver = draggedOverCol === col.status;

              return (
                <div 
                  key={col.status} 
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={(e) => { e.preventDefault(); setDraggedOverCol(col.status); }}
                  onDragLeave={() => setDraggedOverCol(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDraggedOverCol(null);
                    const id = e.dataTransfer.getData('text/plain');
                    if (!id) return;
                    if (col.status === 'Technician Assigned' || col.status === 'In Progress' || col.status === 'Resolved') {
                      setTransitioningId(id);
                      setTargetStatus(col.status);
                      const req = maintenance.find(m => m.id === id);
                      setTransitionNotes(req?.notes || '');
                    } else {
                      handleUpdateStatus(id, col.status);
                    }
                  }}
                  style={{ 
                    flex: 1, 
                    minWidth: '240px', 
                    maxWidth: '300px', 
                    backgroundColor: isDraggedOver ? 'var(--accent-purple-glow)' : 'var(--bg-secondary)', 
                    borderRadius: '8px', 
                    border: isDraggedOver ? '2px dashed var(--accent-purple)' : '1px solid var(--border)', 
                    display: 'flex', 
                    flexDirection: 'column',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Column Header */}
                  <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{col.title}</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', backgroundColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                      {colRequests.length}
                    </span>
                  </div>

                  {/* Cards container */}
                  <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
                    {colRequests.length > 0 ? (
                      colRequests.map(req => {
                        const isResolved = req.status === 'Resolved';
                        
                        // Extract details to match mockup text
                        const title = req.assetId;
                        const subtitle = req.assetName || '';
                        
                        // Strip assetName prefix from issueDescription to get clean detail
                        let detail = req.issueDescription;
                        if (detail.toLowerCase().startsWith(subtitle.toLowerCase())) {
                          detail = detail.slice(subtitle.length).trim();
                        }

                        // Determine priority colors
                        const prioBg = req.priority === 'High' ? 'rgba(217,83,79,0.1)' : req.priority === 'Medium' ? 'rgba(240,173,78,0.1)' : 'rgba(0,135,138,0.1)';
                        const prioColor = req.priority === 'High' ? 'var(--accent-red)' : req.priority === 'Medium' ? 'var(--accent-yellow)' : 'var(--accent-blue)';

                        return (
                          <div 
                            key={req.id}
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', req.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragOver={(e) => e.stopPropagation()}
                            style={{
                              padding: '16px',
                              borderRadius: '8px',
                              border: isResolved ? '1.5px solid #10b981' : '1px solid var(--border)',
                              backgroundColor: isResolved ? '#064e3b' : 'var(--bg-card)', // resolved is dark green background as in mockup
                              color: isResolved ? '#a7f3d0' : 'var(--text-primary)',
                              boxShadow: '0 4px 6px rgba(0,0,0,0.03)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                              cursor: 'grab'
                            }}
                            className="glow-card"
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <strong style={{ fontSize: '14px', color: isResolved ? 'white' : 'var(--text-primary)' }}>{title}</strong>
                              
                              {/* Status action menu button */}
                              <select 
                                value={req.status} 
                                onChange={(e) => {
                                  const nextStat = e.target.value as MaintenanceRequest['status'];
                                  if (nextStat === 'Technician Assigned' || nextStat === 'In Progress' || nextStat === 'Resolved') {
                                    setTransitioningId(req.id);
                                    setTargetStatus(nextStat);
                                    setTransitionNotes(req.notes || '');
                                  } else {
                                    handleUpdateStatus(req.id, nextStat);
                                  }
                                }}
                                style={{ 
                                  fontSize: '11px', 
                                  padding: '2px 4px', 
                                  borderRadius: '4px', 
                                  border: '1px solid var(--border)', 
                                  backgroundColor: isResolved ? '#022c22' : 'var(--bg-secondary)', 
                                  color: isResolved ? 'white' : 'var(--text-secondary)',
                                  outline: 'none',
                                  cursor: 'pointer'
                                }}
                              >
                                {columns.map(c => (
                                  <option key={c.status} value={c.status}>{c.title}</option>
                                ))}
                              </select>
                            </div>

                            {/* Subtitle / Asset Name */}
                            <div style={{ fontSize: '13px', fontWeight: 600, color: isResolved ? '#34d399' : 'var(--text-secondary)' }}>
                              {subtitle}
                            </div>

                            {/* Issue description details */}
                            <div style={{ fontSize: '13px', opacity: 0.9, lineHeight: '1.4' }}>
                              {detail}
                            </div>

                            {/* Notes (technician / parts info) */}
                            {req.notes && (
                              <div style={{ 
                                fontSize: '12px', 
                                padding: '6px 8px', 
                                borderRadius: '4px', 
                                backgroundColor: isResolved ? '#022c22' : 'var(--bg-primary)',
                                color: isResolved ? '#34d399' : 'var(--text-muted)',
                                fontWeight: 500,
                                display: 'inline-block'
                              }}>
                                {req.notes}
                              </div>
                            )}

                            {/* Priority flag on active cards */}
                            {!isResolved && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '10px', backgroundColor: prioBg, color: prioColor }}>
                                  {req.priority}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{req.requestDate}</span>
                              </div>
                            )}

                          </div>
                        );
                      })
                    ) : (
                      <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '12px', border: '1.5px dashed var(--border)', borderRadius: '6px' }}>
                        No tasks
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

          </div>

          {/* Kanban Info / Caption matching mockup exactly */}
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', borderTop: '1px solid var(--border)', paddingTop: '16px', fontStyle: 'italic' }}>
            Approving a card moves the asset to under maintenance, resolving return it to available
          </div>

        </main>

      </div>

      {/* ==================== RAISE REQUEST MODAL ==================== */}
      {showModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ width: '420px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Raise Maintenance Request</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>

            <form onSubmit={handleCreateRequest} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {formError && <div style={{ padding: '8px 12px', backgroundColor: 'var(--accent-red-glow)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', borderRadius: '4px', fontSize: '12px' }}>{formError}</div>}
              {formSuccess && <div style={{ padding: '8px 12px', backgroundColor: 'var(--accent-green-glow)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', borderRadius: '4px', fontSize: '12px' }}>{formSuccess}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Asset</label>
                <select 
                  value={newRequestAssetId} 
                  onChange={(e) => setNewRequestAssetId(e.target.value)} 
                  required
                  style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px' }}
                >
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>{a.id} - {a.name} ({a.status})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Describe Issue</label>
                <textarea 
                  value={newRequestIssue} 
                  onChange={(e) => setNewRequestIssue(e.target.value)} 
                  placeholder="e.g. Projector bulb not turning on"
                  required
                  rows={3}
                  style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Priority</label>
                <select 
                  value={newRequestPriority} 
                  onChange={(e) => setNewRequestPriority(e.target.value as any)}
                  style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px' }}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <button 
                type="submit" 
                disabled={formLoading}
                style={{ padding: '12px', backgroundColor: 'var(--accent-purple)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: formLoading ? 0.7 : 1 }}
              >
                Submit Request
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== TRANSITION INTERMEDIARY MODAL (technician name / notes) ==================== */}
      {transitioningId && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ width: '380px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {targetStatus === 'Technician Assigned' ? 'Assign Technician' : targetStatus === 'In Progress' ? 'Update In Progress Details' : 'Resolve Maintenance'}
              </h3>
              <button onClick={() => { setTransitioningId(null); setTargetStatus(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {targetStatus === 'Technician Assigned' ? 'Technician details (e.g. tech: R varma)' : targetStatus === 'In Progress' ? 'Status notes (e.g. parts ordered)' : 'Resolution notes (e.g. resolved 7 Jul)'}
                </label>
                <input 
                  type="text" 
                  value={transitionNotes}
                  onChange={(e) => setTransitionNotes(e.target.value)}
                  placeholder={targetStatus === 'Technician Assigned' ? 'tech: R varma' : targetStatus === 'In Progress' ? 'parts ordered' : 'resolved 7 Jul'}
                  style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>

              <button 
                type="button" 
                onClick={() => {
                  if (transitioningId && targetStatus) {
                    handleUpdateStatus(transitioningId, targetStatus, transitionNotes);
                  }
                }}
                style={{ padding: '10px', backgroundColor: 'var(--accent-purple)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Save & Update Column
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

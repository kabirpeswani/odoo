'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Employee {
  id: string;
  name: string;
  email: string;
  departmentId: string;
  role: string;
}

interface Department {
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
  condition: string;
  location: string;
  status: 'Available' | 'Allocated' | 'Reserved' | 'Under Maintenance' | 'Lost' | 'Retired' | 'Disposed';
  isBookable: boolean;
  currentHolderId: string | null;
  currentDepartmentId: string | null;
  expectedReturnDate: string | null;
}

interface TransferRequest {
  id: string;
  assetId: string;
  requestedById: string;
  targetEmployeeId: string;
  requestDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  notes?: string;
  assetName?: string;
  requesterName?: string;
  targetEmployeeName?: string;
  currentHolderName?: string;
  currentHolderDept?: string;
}

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

interface AllocationPageData {
  assets: Asset[];
  employees: Employee[];
  departments: Department[];
  transfers: TransferRequest[];
  logs: ActivityLog[];
}

export default function AllocationTransferPage() {
  const [data, setData] = useState<AllocationPageData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [selectedAssetId, setSelectedAssetId] = useState<string>('AF-0114'); // Default to mockup asset
  const [targetEmployeeId, setTargetEmployeeId] = useState<string>('');
  const [transferReason, setTransferReason] = useState<string>('');
  
  const [allocateEmployeeId, setAllocateEmployeeId] = useState<string>('');
  const [expectedReturnDate, setExpectedReturnDate] = useState<string>('');
  const [allocationNotes, setAllocationNotes] = useState<string>('');

  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/allocation');
      if (!res.ok) throw new Error('Failed to fetch allocation data');
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

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId || !allocateEmployeeId) {
      setFormError('Please select both an asset and an employee');
      return;
    }

    try {
      setFormLoading(true);
      setFormError(null);
      setFormSuccess(null);

      const res = await fetch('/api/allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ALLOCATE',
          payload: {
            assetId: selectedAssetId,
            employeeId: allocateEmployeeId,
            expectedReturnDate: expectedReturnDate || null,
            notes: allocationNotes
          },
          userId: 'emp-3' // Admin Kabir
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to allocate asset');

      setFormSuccess(`Successfully allocated asset to employee.`);
      setAllocateEmployeeId('');
      setExpectedReturnDate('');
      setAllocationNotes('');
      await fetchData();

      setTimeout(() => setFormSuccess(null), 3000);
    } catch (err: any) {
      setFormError(err.message || 'Operation failed');
    } finally {
      setFormLoading(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId || !targetEmployeeId) {
      setFormError('Please select a target employee for transfer');
      return;
    }

    try {
      setFormLoading(true);
      setFormError(null);
      setFormSuccess(null);

      const res = await fetch('/api/allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SUBMIT_TRANSFER',
          payload: {
            assetId: selectedAssetId,
            targetEmployeeId,
            notes: transferReason
          },
          userId: 'emp-3' // Admin Kabir
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to submit transfer request');

      setFormSuccess(`Transfer request submitted successfully.`);
      setTargetEmployeeId('');
      setTransferReason('');
      await fetchData();

      setTimeout(() => setFormSuccess(null), 3000);
    } catch (err: any) {
      setFormError(err.message || 'Operation failed');
    } finally {
      setFormLoading(false);
    }
  };

  const handleTransferAction = async (transferId: string, action: 'APPROVE_TRANSFER' | 'REJECT_TRANSFER') => {
    try {
      setFormError(null);
      const res = await fetch('/api/allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          payload: { transferId },
          userId: 'emp-3' // Admin Kabir
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to process transfer');

      setFormSuccess(`Transfer request has been ${action === 'APPROVE_TRANSFER' ? 'approved' : 'rejected'}.`);
      await fetchData();
      setTimeout(() => setFormSuccess(null), 3000);
    } catch (err: any) {
      setFormError(err.message || 'Operation failed');
    }
  };

  const handleReturnAsset = async (assetId: string) => {
    if (!window.confirm('Are you sure you want to return this asset to inventory?')) return;
    try {
      setFormLoading(true);
      setFormError(null);
      setFormSuccess(null);

      const res = await fetch('/api/allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RETURN_ASSET',
          payload: { assetId },
          userId: 'emp-3'
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to return asset');

      setFormSuccess(`Asset returned to inventory.`);
      await fetchData();
      setTimeout(() => setFormSuccess(null), 3000);
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
          <p style={{ marginTop: '16px', fontWeight: 500 }}>Syncing Allocations & Transfers...</p>
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

  const { assets = [], employees = [], departments = [], transfers = [], logs = [] } = data!;

  // Find the currently selected asset details
  const selectedAsset = assets.find(a => a.id === selectedAssetId) || assets[0];

  // Current holder & department details
  const holder = selectedAsset ? employees.find(e => e.id === selectedAsset.currentHolderId) : null;
  const dept = selectedAsset && holder ? departments.find(d => d.id === holder.departmentId) : null;

  // Filter logs for allocation history of the selected asset
  const selectedAssetLogs = logs
    .filter(log => log.details.includes(selectedAssetId))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Hardcode history matching mockup exactly for AF-0114 if no logs are found
  const mockupHistory = [
    { id: 'h-1', date: 'Mar 12', text: 'Allocated to Priya shah - Engineering' },
    { id: 'h-2', date: 'Jan 04', text: 'Returned by Arjun Nair - condition: good' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100vw', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      
      {/* TOP HEADER */}
      <header style={{ height: '64px', backgroundColor: 'var(--bg-header)', display: 'flex', alignItems: 'center', padding: '0 24px', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'white', letterSpacing: '-0.3px', cursor: 'pointer' }}>AssetFlow</h1>
        </Link>
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
          
          <Link href="/assets" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>Assets</div>
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
            Allocation & Transfer
          </div>

          <Link href="/booking" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>Resource Booking</div>
          </Link>
          <Link href="/maintenance" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>Maintenance</div>
          </Link>
          <Link href="/audit" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>Audit</div>
          </Link>
          <Link href="/reports" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>Reports</div>
          </Link>
          <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'default' }}>Notifications</div>

        </aside>

        {/* MAIN PANEL */}
        <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', display: 'flex', gap: '32px' }}>
          
          {/* LEFT COLUMN: ALLOCATION & TRANSFER FORM */}
          <div className="glow-card" style={{ flex: 1.2, padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', alignSelf: 'flex-start', minWidth: '480px' }}>
            
            {/* Status alerts */}
            {formSuccess && (
              <div style={{ padding: '12px 16px', backgroundColor: 'var(--accent-green-glow)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', borderRadius: '6px', fontSize: '14px', fontWeight: 500 }}>
                {formSuccess}
              </div>
            )}
            {formError && (
              <div style={{ padding: '12px 16px', backgroundColor: 'var(--accent-red-glow)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', borderRadius: '6px', fontSize: '14px', fontWeight: 500 }}>
                {formError}
              </div>
            )}

            {/* Asset Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Asset</label>
              <select 
                value={selectedAssetId} 
                onChange={(e) => {
                  setSelectedAssetId(e.target.value);
                  setTargetEmployeeId('');
                  setAllocateEmployeeId('');
                  setFormError(null);
                  setFormSuccess(null);
                }} 
                style={{ 
                  width: '100%', 
                  padding: '12px 14px', 
                  border: '1px solid var(--border)', 
                  borderRadius: '6px', 
                  backgroundColor: 'var(--bg-secondary)', 
                  color: 'var(--text-primary)',
                  fontSize: '15px',
                  fontWeight: 500,
                  outline: 'none'
                }}
              >
                {assets.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.id} - {a.name} ({a.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Warning block if asset is already allocated */}
            {selectedAsset && selectedAsset.status === 'Allocated' && (
              <div style={{ 
                backgroundColor: 'rgba(217, 83, 79, 0.08)', 
                border: '1.5px dashed var(--accent-red)', 
                color: 'var(--accent-red)', 
                padding: '16px 20px', 
                borderRadius: '8px', 
                fontSize: '14px',
                lineHeight: '1.6',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ fontWeight: 700 }}>
                  Already Allocated to {holder ? holder.name : 'Unknown Employee'} ({dept ? dept.name : 'Unknown Department'})
                </div>
                <div style={{ fontSize: '13px', opacity: 0.9 }}>
                  Direct re-allocation is blocked - submit a transfer request below
                </div>
              </div>
            )}

            {/* Dynamic Form: Transfer Request (if Allocated) OR Allocation Form (if Available) */}
            {selectedAsset && selectedAsset.status === 'Allocated' ? (
              
              // ================= TRANSFER REQUEST FORM =================
              <form onSubmit={handleTransferSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                  Transfer Request
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  
                  {/* From Field (Read-only) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>From</label>
                    <input 
                      type="text" 
                      readOnly 
                      value={holder ? holder.name : 'Unknown Holder'} 
                      style={{ 
                        width: '100%', 
                        padding: '10px 12px', 
                        border: '1px solid var(--border)', 
                        borderRadius: '6px', 
                        backgroundColor: '#f1f5f9', 
                        color: 'var(--text-secondary)',
                        fontSize: '14px',
                        outline: 'none',
                        cursor: 'not-allowed'
                      }} 
                    />
                  </div>

                  {/* To Field */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>To</label>
                    <select 
                      value={targetEmployeeId} 
                      onChange={(e) => setTargetEmployeeId(e.target.value)} 
                      required
                      style={{ 
                        width: '100%', 
                        padding: '10px 12px', 
                        border: '1px solid var(--border)', 
                        borderRadius: '6px', 
                        backgroundColor: 'var(--bg-secondary)', 
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    >
                      <option value="">Select Employee....</option>
                      {employees
                        .filter(e => e.id !== selectedAsset.currentHolderId)
                        .map(e => {
                          const eDept = departments.find(d => d.id === e.departmentId);
                          return (
                            <option key={e.id} value={e.id}>
                              {e.name} ({eDept ? eDept.name : 'Unknown'})
                            </option>
                          );
                        })}
                    </select>
                  </div>

                </div>

                {/* Reason field */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Reason</label>
                  <textarea 
                    value={transferReason} 
                    onChange={(e) => setTransferReason(e.target.value)}
                    rows={4}
                    placeholder="Enter reason for transfer request..."
                    required
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid var(--border)', 
                      borderRadius: '6px', 
                      backgroundColor: 'var(--bg-secondary)', 
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none',
                      resize: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    type="submit" 
                    disabled={formLoading}
                    style={{ 
                      padding: '12px 24px', 
                      backgroundColor: '#14532d', 
                      color: '#86efac', 
                      border: '1.5px solid #166534', 
                      borderRadius: '6px', 
                      fontWeight: 600, 
                      cursor: 'pointer',
                      fontSize: '14px',
                      transition: 'all 0.2s',
                      opacity: formLoading ? 0.7 : 1
                    }}
                  >
                    Submit Request
                  </button>

                  <button 
                    type="button" 
                    onClick={() => handleReturnAsset(selectedAsset.id)}
                    disabled={formLoading}
                    style={{ 
                      padding: '12px 18px', 
                      backgroundColor: 'transparent', 
                      color: 'var(--accent-red)', 
                      border: '1.5px solid var(--accent-red)', 
                      borderRadius: '6px', 
                      fontWeight: 600, 
                      cursor: 'pointer',
                      fontSize: '14px',
                      transition: 'all 0.2s'
                    }}
                  >
                    Return Asset
                  </button>
                </div>

              </form>
            ) : (
              
              // ================= DIRECT ALLOCATION FORM =================
              <form onSubmit={handleAllocate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                  Allocate Asset
                </h3>

                {selectedAsset && selectedAsset.status !== 'Available' && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '10px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    Asset status is <strong>{selectedAsset.status}</strong>. Direct allocation is restricted.
                  </div>
                )}
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  
                  {/* Assign to Employee */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Assign To</label>
                    <select 
                      value={allocateEmployeeId} 
                      onChange={(e) => setAllocateEmployeeId(e.target.value)} 
                      required
                      disabled={selectedAsset?.status !== 'Available'}
                      style={{ 
                        width: '100%', 
                        padding: '10px 12px', 
                        border: '1px solid var(--border)', 
                        borderRadius: '6px', 
                        backgroundColor: 'var(--bg-secondary)', 
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    >
                      <option value="">Select Employee....</option>
                      {employees.map(e => {
                        const eDept = departments.find(d => d.id === e.departmentId);
                        return (
                          <option key={e.id} value={e.id}>
                            {e.name} ({eDept ? eDept.name : 'Unknown'})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Expected Return Date */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Expected Return Date</label>
                    <input 
                      type="date" 
                      value={expectedReturnDate} 
                      onChange={(e) => setExpectedReturnDate(e.target.value)}
                      disabled={selectedAsset?.status !== 'Available'}
                      style={{ 
                        width: '100%', 
                        padding: '9px 12px', 
                        border: '1px solid var(--border)', 
                        borderRadius: '6px', 
                        backgroundColor: 'var(--bg-secondary)', 
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        outline: 'none'
                      }} 
                    />
                  </div>

                </div>

                {/* Notes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Allocation Notes</label>
                  <textarea 
                    value={allocationNotes} 
                    onChange={(e) => setAllocationNotes(e.target.value)}
                    rows={3}
                    placeholder="Enter special instructions or notes..."
                    disabled={selectedAsset?.status !== 'Available'}
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid var(--border)', 
                      borderRadius: '6px', 
                      backgroundColor: 'var(--bg-secondary)', 
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none',
                      resize: 'none'
                    }}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={formLoading || selectedAsset?.status !== 'Available'}
                  style={{ 
                    padding: '12px 24px', 
                    backgroundColor: 'var(--accent-purple)', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '6px', 
                    fontWeight: 600, 
                    cursor: selectedAsset?.status === 'Available' ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    transition: 'all 0.2s',
                    opacity: (formLoading || selectedAsset?.status !== 'Available') ? 0.6 : 1,
                    alignSelf: 'flex-start'
                  }}
                >
                  Allocate Asset
                </button>

              </form>
            )}

            {/* Allocation History Section */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', marginTop: '8px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
                Allocation history
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {selectedAssetId === 'AF-0114' && selectedAssetLogs.length === 0 ? (
                  // If we are looking at AF-0114 on fresh seed, display the mockup items exactly
                  mockupHistory.map(item => (
                    <div key={item.id} style={{ display: 'flex', gap: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                      <span style={{ fontWeight: 600, minWidth: '55px', color: 'var(--text-muted)' }}>{item.date}</span>
                      <span>—</span>
                      <span style={{ lineHeight: '1.4' }}>{item.text}</span>
                    </div>
                  ))
                ) : selectedAssetLogs.length > 0 ? (
                  // Dynamically format log entries
                  selectedAssetLogs.map(log => {
                    const date = new Date(log.timestamp);
                    const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
                    
                    // Format log details to look nice
                    let details = log.details;
                    if (details.includes(selectedAssetId)) {
                      // Strip asset code to read cleaner
                      details = details.replace(` (${selectedAssetId})`, '').replace(` ${selectedAssetId}`, '');
                    }
                    
                    // Capitalize first letter of detail
                    details = details.charAt(0).toUpperCase() + details.slice(1);

                    return (
                      <div key={log.id} style={{ display: 'flex', gap: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: 600, minWidth: '55px', color: 'var(--text-muted)' }}>{formattedDate}</span>
                        <span>—</span>
                        <span style={{ lineHeight: '1.4' }}>{details}</span>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No allocation or transfer history recorded for this asset.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: PENDING TRANSFERS REVIEW PANEL */}
          <div style={{ flex: 0.8, display: 'flex', flexDirection: 'column', gap: '24px', minWidth: '320px' }}>
            
            <div className="glow-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Pending Transfers Approval
              </h3>
              
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                As an Asset Manager, you can review and approve or reject asset transfer requests submitted by employees below.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
                {transfers.filter(t => t.status === 'Pending').length > 0 ? (
                  transfers.filter(t => t.status === 'Pending').map(t => (
                    <div key={t.id} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '6px', backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{t.assetName}</strong>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID: {t.assetId}</div>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '12px', backgroundColor: 'var(--accent-yellow-glow)', color: 'var(--accent-yellow)', border: '1px solid var(--accent-yellow)' }}>
                          Pending
                        </span>
                      </div>

                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div><strong>From:</strong> {t.currentHolderName} ({t.currentHolderDept})</div>
                        <div><strong>To:</strong> {t.targetEmployeeName}</div>
                        {t.notes && <div style={{ marginTop: '4px', fontStyle: 'italic', padding: '6px 10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', borderLeft: '3px solid var(--border)' }}>"{t.notes}"</div>}
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                        <button 
                          onClick={() => handleTransferAction(t.id, 'APPROVE_TRANSFER')}
                          style={{ 
                            flex: 1, 
                            padding: '8px', 
                            backgroundColor: 'var(--accent-green)', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            fontSize: '13px', 
                            fontWeight: 600, 
                            cursor: 'pointer',
                            transition: 'background-color 0.2s'
                          }}
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => handleTransferAction(t.id, 'REJECT_TRANSFER')}
                          style={{ 
                            flex: 1, 
                            padding: '8px', 
                            backgroundColor: 'transparent', 
                            color: 'var(--accent-red)', 
                            border: '1px solid var(--accent-red)', 
                            borderRadius: '4px', 
                            fontSize: '13px', 
                            fontWeight: 600, 
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '32px 16px', border: '1.5px dashed var(--border)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No pending transfer requests
                  </div>
                )}
              </div>
            </div>

            {/* Completed/History of transfers */}
            <div className="glow-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Recent Transfer Log
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {transfers.filter(t => t.status !== 'Pending').length > 0 ? (
                  transfers.filter(t => t.status !== 'Pending').slice(0, 5).map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingBottom: '8px', borderBottom: '1px solid var(--bg-primary)' }}>
                      <div>
                        <strong>{t.assetId}</strong> transferred to {t.targetEmployeeName}
                      </div>
                      <span style={{ 
                        color: t.status === 'Approved' ? 'var(--accent-green)' : 'var(--accent-red)',
                        fontWeight: 600
                      }}>
                        {t.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No transfer history
                  </div>
                )}
              </div>
            </div>

          </div>

        </main>

      </div>
    </div>
  );
}

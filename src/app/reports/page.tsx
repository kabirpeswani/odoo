'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface KPI {
  totalAssetsCount: number;
  totalAssetsVal: number;
  utilizationRate: number;
  maintenanceCount: number;
}

interface StatusCounts {
  Available: number;
  Allocated: number;
  Reserved: number;
  UnderMaintenance: number;
  Lost: number;
  Retired: number;
}

interface DeptAllocation {
  departmentName: string;
  count: number;
}

interface MaintenanceByCategory {
  categoryName: string;
  count: number;
}

interface NearingRetirementAsset {
  id: string;
  name: string;
  category: string;
  condition: string;
  acquisitionDate: string;
}

interface HeatmapDay {
  day: string;
  slots: { hour: number; count: number }[];
}

interface ReportsPageData {
  statusCounts: StatusCounts;
  deptAllocations: DeptAllocation[];
  maintenanceByCategory: MaintenanceByCategory[];
  nearingRetirement: NearingRetirementAsset[];
  heatmap: HeatmapDay[];
  kpis: KPI;
  assets: any[];
  maintenance: any[];
}

export default function ReportsAnalyticsPage() {
  const [data, setData] = useState<ReportsPageData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReportType, setSelectedReportType] = useState<string>('inventory');

  const fetchData = async () => {
    try {
      const res = await fetch('/api/reports');
      if (!res.ok) throw new Error('Failed to fetch reports data');
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

  const handleExportCSV = () => {
    if (!data) return;

    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = 'report.csv';

    if (selectedReportType === 'inventory') {
      filename = 'asset_inventory.csv';
      headers = ['Asset ID', 'Name', 'Category ID', 'Serial Number', 'Location', 'Acquisition Date', 'Cost', 'Condition', 'Status'];
      rows = (data.assets || []).map(a => [
        a.id, a.name, a.categoryId, a.serialNumber, a.location, a.acquisitionDate, (a.acquisitionCost || 0).toString(), a.condition, a.status
      ]);
    } else if (selectedReportType === 'maintenance') {
      filename = 'maintenance_logs.csv';
      headers = ['Request ID', 'Asset ID', 'Issue', 'Priority', 'Status', 'Date', 'Notes'];
      rows = (data.maintenance || []).map(m => [
        m.id, m.assetId, m.issueDescription, m.priority, m.status, m.requestDate, m.notes || ''
      ]);
    } else {
      filename = 'allocations.csv';
      headers = ['Asset ID', 'Asset Name', 'Holder ID', 'Department ID', 'Expected Return'];
      rows = (data.assets || []).filter(a => a.status === 'Allocated').map(a => [
        a.id, a.name, a.currentHolderId || '', a.currentDepartmentId || '', a.expectedReturnDate || ''
      ]);
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="loader"></span>
          <p style={{ marginTop: '16px', fontWeight: 500 }}>Generating Analytics & Reports...</p>
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

  const { statusCounts, deptAllocations, maintenanceByCategory, nearingRetirement, heatmap, kpis } = data!;

  // Calculate total counts for percentage checks
  const totalStatus = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  // Find max count in heatmap to calculate relative opacity scaling
  let maxHeatmapCount = 1;
  heatmap.forEach(day => {
    day.slots.forEach(slot => {
      if (slot.count > maxHeatmapCount) maxHeatmapCount = slot.count;
    });
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

          <Link href="/audit" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>
              Audit
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
            Reports
          </div>

          <Link href="/notifications" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>Notifications</div>
          </Link>

        </aside>

        {/* MAIN PANEL */}
        <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Header Row */}
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Reports & Analytics</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Real-time statistics, asset tracking trends, and exportable logs</p>
          </div>

          {/* KPI Summary Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
            
            <div className="glow-card" style={{ padding: '20px 24px' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Total Registered Assets</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)' }}>{kpis.totalAssetsCount}</div>
            </div>

            <div className="glow-card" style={{ padding: '20px 24px' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Total Catalog Value</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)' }}>${kpis.totalAssetsVal.toLocaleString()}</div>
            </div>

            <div className="glow-card" style={{ padding: '20px 24px' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Current Utilization Rate</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent-purple)' }}>{kpis.utilizationRate}%</div>
            </div>

            <div className="glow-card" style={{ padding: '20px 24px' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Total Maintenance Requests</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent-orange)' }}>{kpis.maintenanceCount}</div>
            </div>

          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
            
            {/* Donut Chart: Asset Status Distribution */}
            <div className="glow-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Asset Status Distribution</h3>
              
              <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                {/* CSS Conic Gradient Donut simulation */}
                <div style={{ 
                  width: '160px', 
                  height: '160px', 
                  borderRadius: '50%', 
                  background: `conic-gradient(
                    #24b574 0% ${Math.round((statusCounts.Available / totalStatus) * 360)}deg,
                    #714B67 ${Math.round((statusCounts.Available / totalStatus) * 360)}deg ${Math.round(((statusCounts.Available + statusCounts.Allocated) / totalStatus) * 360)}deg,
                    #f0ad4e ${Math.round(((statusCounts.Available + statusCounts.Allocated) / totalStatus) * 360)}deg ${Math.round(((statusCounts.Available + statusCounts.Allocated + statusCounts.Reserved) / totalStatus) * 360)}deg,
                    #f27830 ${Math.round(((statusCounts.Available + statusCounts.Allocated + statusCounts.Reserved) / totalStatus) * 360)}deg ${Math.round(((statusCounts.Available + statusCounts.Allocated + statusCounts.Reserved + statusCounts.UnderMaintenance) / totalStatus) * 360)}deg,
                    #d9534f ${Math.round(((statusCounts.Available + statusCounts.Allocated + statusCounts.Reserved + statusCounts.UnderMaintenance) / totalStatus) * 360)}deg 360deg
                  )`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  flexShrink: 0
                }}>
                  {/* Center cutout */}
                  <div style={{
                    width: '90px',
                    height: '90px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)'
                  }}>
                    <strong style={{ fontSize: '20px', fontWeight: 800 }}>{totalStatus}</strong>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total</span>
                  </div>
                </div>

                {/* Legend list */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <LegendItem color="#24b574" label="Available" count={statusCounts.Available} total={totalStatus} />
                  <LegendItem color="#714B67" label="Allocated" count={statusCounts.Allocated} total={totalStatus} />
                  <LegendItem color="#f0ad4e" label="Reserved" count={statusCounts.Reserved} total={totalStatus} />
                  <LegendItem color="#f27830" label="Maintenance" count={statusCounts.UnderMaintenance} total={totalStatus} />
                  <LegendItem color="#d9534f" label="Lost" count={statusCounts.Lost} total={totalStatus} />
                </div>
              </div>
            </div>

            {/* Bar Chart: Allocations by Department */}
            <div className="glow-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Allocations by Department</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'center' }}>
                {deptAllocations.map(dept => {
                  const maxCount = Math.max(...deptAllocations.map(d => d.count)) || 1;
                  const pct = Math.round((dept.count / maxCount) * 100);
                  
                  return (
                    <div key={dept.departmentName} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                        <span>{dept.departmentName}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{dept.count} Assets</span>
                      </div>
                      
                      {/* Bar container */}
                      <div style={{ width: '100%', height: '24px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <div style={{ 
                          width: `${pct}%`, 
                          height: '100%', 
                          backgroundColor: 'var(--accent-purple)', 
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          paddingRight: '12px',
                          transition: 'width 0.4s ease-out'
                        }}>
                          {pct > 15 && <span style={{ color: 'white', fontSize: '10px', fontWeight: 700 }}>{pct}%</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Heatmap & Retirement Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '28px' }}>
            
            {/* Booking Heatmap */}
            <div className="glow-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Resource Booking Heatmap (Peak usage windows)
              </h3>
              
              <div style={{ overflowX: 'auto' }}>
                {/* Heatmap grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '460px' }}>
                  
                  {/* Grid Hours Header */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '60px' }} /> {/* empty label spacer */}
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>
                      {[9, 10, 11, 12, 1, 2, 3, 4, 5].map((h, i) => (
                        <div key={i} style={{ width: '38px' }}>
                          {h}:00{h === 12 || h < 9 ? 'PM' : 'AM'}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Grid Rows */}
                  {heatmap.map(day => (
                    <div key={day.day} style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: '60px', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {day.day}
                      </div>

                      <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}>
                        {day.slots.map(slot => {
                          // calculate cell color density opacity based on booking count
                          const opacity = slot.count > 0 ? Math.min(1.0, 0.15 + (slot.count / maxHeatmapCount) * 0.85) : 0;
                          const cellBg = slot.count > 0 ? `rgba(113, 75, 103, ${opacity})` : 'var(--bg-primary)';
                          const cellBorder = slot.count > 0 ? '1px solid var(--accent-purple)' : '1px solid var(--border)';
                          
                          return (
                            <div 
                              key={slot.hour}
                              title={`${day.day} at ${slot.hour}:00 - Bookings: ${slot.count}`}
                              style={{ 
                                width: '38px', 
                                height: '38px', 
                                backgroundColor: cellBg, 
                                border: cellBorder,
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: slot.count > 0 && opacity > 0.5 ? 'white' : 'var(--text-secondary)',
                                transition: 'all 0.2s',
                                cursor: 'default'
                              }}
                            >
                              {slot.count > 0 ? slot.count : ''}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'flex-end', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '8px' }}>
                <span>Less Booked</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)' }} />
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: 'rgba(113, 75, 103, 0.25)', border: '1px solid var(--accent-purple)' }} />
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: 'rgba(113, 75, 103, 0.6)', border: '1px solid var(--accent-purple)' }} />
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: 'rgba(113, 75, 103, 1)', border: '1px solid var(--accent-purple)' }} />
                </div>
                <span>Peak Booked</span>
              </div>
            </div>

            {/* Assets Nearing Retirement / Export Report card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              
              {/* Assets Nearing Retirement */}
              <div className="glow-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Assets Nearing Retirement
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {nearingRetirement.map(a => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingBottom: '8px', borderBottom: '1px solid var(--bg-primary)', alignItems: 'center' }}>
                      <div>
                        <strong>{a.id}</strong> — {a.name}
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Acquired: {a.acquisitionDate}</div>
                      </div>
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        padding: '2px 8px', 
                        borderRadius: '12px', 
                        backgroundColor: a.condition === 'Poor' ? 'var(--accent-red-glow)' : 'var(--accent-yellow-glow)', 
                        color: a.condition === 'Poor' ? 'var(--accent-red)' : 'var(--accent-yellow)' 
                      }}>
                        {a.condition} Condition
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Export Reports card */}
              <div className="glow-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Export Operations Reports
                </h3>
                
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Select operational categories and download complete spreadsheets locally as CSV files.
                </p>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <select 
                    value={selectedReportType} 
                    onChange={e => setSelectedReportType(e.target.value)}
                    style={{ flex: 1, padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}
                  >
                    <option value="inventory">Asset Inventory Report</option>
                    <option value="maintenance">Maintenance Requests Log</option>
                    <option value="allocations">Active Allocations Log</option>
                  </select>

                  <button 
                    onClick={handleExportCSV}
                    style={{ 
                      padding: '10px 16px', 
                      backgroundColor: '#14532d', // green background Odoo button
                      color: '#86efac', 
                      border: '1.5px solid #166534',
                      borderRadius: '6px', 
                      fontWeight: 700, 
                      cursor: 'pointer',
                      fontSize: '13px',
                      transition: 'all 0.2s'
                    }}
                  >
                    Export CSV
                  </button>
                </div>
              </div>

            </div>

          </div>

        </main>

      </div>
    </div>
  );
}

// Legend item utility component
interface LegendItemProps {
  color: string;
  label: string;
  count: number;
  total: number;
}

function LegendItem({ color, label, count, total }: LegendItemProps) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: color }} />
        <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <div>
        <strong style={{ color: 'var(--text-primary)' }}>{count}</strong>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>({pct}%)</span>
      </div>
    </div>
  );
}

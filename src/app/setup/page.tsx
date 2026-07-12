'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Department {
  id: string;
  name: string;
  headId: string;
  parentDepartmentId?: string;
  status: 'Active' | 'Inactive';
}

interface AssetCategory {
  id: string;
  name: string;
  fields?: { name: string; type: string; required: boolean }[];
}

interface Employee {
  id: string;
  name: string;
  email: string;
  departmentId: string;
  role: 'Admin' | 'Asset Manager' | 'Department Head' | 'Employee';
  status: 'Active' | 'Inactive';
}

export default function OrganizationSetup() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Tab State: 'departments' | 'categories' | 'employees'
  const [activeTab, setActiveTab] = useState<'departments' | 'categories' | 'employees'>('departments');

  // Modals state
  const [activeModal, setActiveModal] = useState<'create_dept' | 'edit_dept' | 'create_cat' | 'edit_emp' | null>(null);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  // Form states
  const [deptForm, setDeptForm] = useState<{
    name: string;
    headId: string;
    parentDepartmentId: string;
    status: 'Active' | 'Inactive';
  }>({
    name: '',
    headId: '',
    parentDepartmentId: '',
    status: 'Active'
  });

  const [catForm, setCatForm] = useState({
    name: '',
    fields: [] as { name: string; type: string; required: boolean }[]
  });

  const [newField, setNewField] = useState({ name: '', type: 'string', required: false });

  const [empForm, setEmpForm] = useState<{
    role: 'Admin' | 'Asset Manager' | 'Department Head' | 'Employee';
    departmentId: string;
    status: 'Active' | 'Inactive';
  }>({
    role: 'Employee',
    departmentId: '',
    status: 'Active'
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/setup');
      if (!res.ok) throw new Error('Failed to fetch organization setup data');
      const json = await res.json();
      setDepartments(json.departments);
      setCategories(json.categories);
      setEmployees(json.employees);
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

  const handleAction = async (action: string, payload: any) => {
    try {
      setModalLoading(true);
      setModalError(null);
      setModalSuccess(null);

      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to update setup data');

      setModalSuccess('Changes saved successfully!');
      await fetchData();

      setTimeout(() => {
        setActiveModal(null);
        setModalSuccess(null);
        setSelectedDept(null);
        setSelectedEmp(null);
      }, 1200);
    } catch (err: any) {
      setModalError(err.message || 'Action failed');
    } finally {
      setModalLoading(false);
    }
  };

  // Open Edit Department Modal
  const openEditDept = (dept: Department) => {
    setSelectedDept(dept);
    setDeptForm({
      name: dept.name,
      headId: dept.headId,
      parentDepartmentId: dept.parentDepartmentId || '',
      status: dept.status
    });
    setActiveModal('edit_dept');
  };

  // Open Edit Employee Role/Status Modal
  const openEditEmp = (emp: Employee) => {
    setSelectedEmp(emp);
    setEmpForm({
      role: emp.role,
      departmentId: emp.departmentId,
      status: emp.status
    });
    setActiveModal('edit_emp');
  };

  // Add custom field to category form
  const addFieldToCategory = () => {
    if (!newField.name) return;
    setCatForm(prev => ({
      ...prev,
      fields: [...prev.fields, { ...newField }]
    }));
    setNewField({ name: '', type: 'string', required: false });
  };

  // Remove custom field from category form
  const removeFieldFromCategory = (index: number) => {
    setCatForm(prev => ({
      ...prev,
      fields: prev.fields.filter((_, idx) => idx !== index)
    }));
  };

  if (loading && departments.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="loader"></span>
          <p style={{ marginTop: '16px', fontWeight: 500 }}>Loading Setup Portal...</p>
        </div>
      </div>
    );
  }

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
            Organization setup
          </div>

          <Link href="/assets" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>Assets</div>
          </Link>
          <Link href="/allocation" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500, borderRadius: '6px', cursor: 'pointer' }}>Allocation & Transfer</div>
          </Link>
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
        <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Organization Setup</h2>
            <div style={{ fontSize: '11px', color: 'var(--accent-purple)', background: 'var(--accent-purple-glow)', border: '1px solid var(--accent-purple)', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' }}>
              Admin View Mode
            </div>
          </div>

          {/* HORIZONTAL TAB BAR */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '24px', flexShrink: 0 }}>
            <button 
              onClick={() => setActiveTab('departments')} 
              style={{ 
                background: 'none', 
                border: 'none', 
                borderBottom: activeTab === 'departments' ? '2.5px solid var(--accent-purple)' : '2.5px solid transparent', 
                color: activeTab === 'departments' ? 'var(--accent-purple)' : 'var(--text-secondary)',
                paddingBottom: '12px',
                fontWeight: activeTab === 'departments' ? 700 : 500,
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              Department Management
            </button>
            <button 
              onClick={() => setActiveTab('categories')} 
              style={{ 
                background: 'none', 
                border: 'none', 
                borderBottom: activeTab === 'categories' ? '2.5px solid var(--accent-purple)' : '2.5px solid transparent', 
                color: activeTab === 'categories' ? 'var(--accent-purple)' : 'var(--text-secondary)',
                paddingBottom: '12px',
                fontWeight: activeTab === 'categories' ? 700 : 500,
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              Asset Category Management
            </button>
            <button 
              onClick={() => setActiveTab('employees')} 
              style={{ 
                background: 'none', 
                border: 'none', 
                borderBottom: activeTab === 'employees' ? '2.5px solid var(--accent-purple)' : '2.5px solid transparent', 
                color: activeTab === 'employees' ? 'var(--accent-purple)' : 'var(--text-secondary)',
                paddingBottom: '12px',
                fontWeight: activeTab === 'employees' ? 700 : 500,
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              Employee Directory
            </button>
          </div>

          {/* TAB CONTENT A - DEPARTMENTS */}
          {activeTab === 'departments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Manage corporate departments, assign parent nodes for organizational structure, and appoint managers.</div>
                <button 
                  onClick={() => {
                    setDeptForm({ name: '', headId: employees[0]?.id || '', parentDepartmentId: '', status: 'Active' });
                    setActiveModal('create_dept');
                  }}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--accent-purple)', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(113, 75, 103, 0.15)' }}
                >
                  + Add Department
                </button>
              </div>

              {/* Table */}
              <div className="glow-card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: '#fcfcfd' }}>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>ID</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Department Name</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Department Head</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Parent Department</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((dept) => {
                      const head = employees.find(e => e.id === dept.headId);
                      const parent = departments.find(d => d.id === dept.parentDepartmentId);
                      return (
                        <tr key={dept.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{dept.id}</td>
                          <td style={{ padding: '14px 16px', fontWeight: 600 }}>{dept.name}</td>
                          <td style={{ padding: '14px 16px' }}>{head ? head.name : <em style={{ color: 'var(--text-muted)' }}>None Assigned</em>}</td>
                          <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>{parent ? parent.name : '-'}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ 
                              fontSize: '11px', 
                              fontWeight: 700, 
                              color: dept.status === 'Active' ? 'var(--accent-green)' : 'var(--accent-red)', 
                              backgroundColor: dept.status === 'Active' ? 'var(--accent-green-glow)' : 'var(--accent-red-glow)',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              {dept.status}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <button 
                              onClick={() => openEditDept(dept)}
                              style={{ border: 'none', background: 'none', color: 'var(--accent-purple)', fontWeight: 600, cursor: 'pointer', marginRight: '12px' }}
                            >
                              Edit Details
                            </button>
                            {dept.status === 'Active' && (
                              <button 
                                onClick={() => handleAction('UPDATE_DEPARTMENT', { ...dept, status: 'Inactive' })}
                                style={{ border: 'none', background: 'none', color: 'var(--accent-red)', fontWeight: 600, cursor: 'pointer' }}
                              >
                                Deactivate
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB CONTENT B - CATEGORIES */}
          {activeTab === 'categories' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Maintain asset groupings (Electronics, Furniture) and custom metadata specifications for warranty, plates, etc.</div>
                <button 
                  onClick={() => {
                    setCatForm({ name: '', fields: [] });
                    setActiveModal('create_cat');
                  }}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--accent-purple)', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(113, 75, 103, 0.15)' }}
                >
                  + Add Category
                </button>
              </div>

              {/* Table */}
              <div className="glow-card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: '#fcfcfd' }}>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>ID</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Category Name</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Custom Specifications (Fields)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr key={cat.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{cat.id}</td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>{cat.name}</td>
                        <td style={{ padding: '14px 16px' }}>
                          {cat.fields && cat.fields.length > 0 ? (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {cat.fields.map((f, i) => (
                                <span key={i} style={{ fontSize: '11px', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-primary)' }}>
                                  {f.name} ({f.type}){f.required ? '*' : ''}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>None defined</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB CONTENT C - EMPLOYEES & PROMOTIONS */}
          {activeTab === 'employees' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Assign roles (Admin, Asset Manager, Department Head) to employees. Note: this is the only authority point for role assignment.</div>
              
              {/* Table */}
              <div className="glow-card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: '#fcfcfd' }}>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Name</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Email Address</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Department</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Role</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => {
                      const dept = departments.find(d => d.id === emp.departmentId);
                      return (
                        <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '14px 16px', fontWeight: 600 }}>{emp.name}</td>
                          <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>{emp.email}</td>
                          <td style={{ padding: '14px 16px' }}>{dept ? dept.name : '-'}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ 
                              fontSize: '11px', 
                              fontWeight: 700, 
                              color: emp.role === 'Admin' ? 'var(--accent-purple)' : emp.role === 'Asset Manager' ? 'var(--accent-blue)' : emp.role === 'Department Head' ? 'var(--accent-orange)' : 'var(--text-secondary)',
                              backgroundColor: emp.role === 'Admin' ? 'var(--accent-purple-glow)' : emp.role === 'Asset Manager' ? 'var(--accent-blue-glow)' : emp.role === 'Department Head' ? 'var(--accent-orange-glow)' : 'var(--border)',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              {emp.role}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ 
                              fontSize: '11px', 
                              fontWeight: 700, 
                              color: emp.status === 'Active' ? 'var(--accent-green)' : 'var(--accent-red)', 
                              backgroundColor: emp.status === 'Active' ? 'var(--accent-green-glow)' : 'var(--accent-red-glow)',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              {emp.status}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <button 
                              onClick={() => openEditEmp(emp)}
                              style={{ border: 'none', background: 'none', color: 'var(--accent-purple)', fontWeight: 600, cursor: 'pointer' }}
                            >
                              Assign Role / Status
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>

      </div>

      {/* ==================== CREATE DEPARTMENT MODAL ==================== */}
      {activeModal === 'create_dept' && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ width: '460px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Create Department</h3>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              {modalError && <div style={{ padding: '10px', backgroundColor: 'var(--accent-red-glow)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', borderRadius: '6px', marginBottom: '14px', fontSize: '12px' }}>{modalError}</div>}
              {modalSuccess && <div style={{ padding: '10px', backgroundColor: 'var(--accent-green-glow)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', borderRadius: '6px', marginBottom: '14px', fontSize: '12px' }}>{modalSuccess}</div>}
              
              <form onSubmit={(e) => { e.preventDefault(); handleAction('CREATE_DEPARTMENT', deptForm); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Department Name *</label>
                  <input type="text" required placeholder="e.g. Design Studio" value={deptForm.name} onChange={(e) => setDeptForm(prev => ({ ...prev, name: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Department Head</label>
                  <select value={deptForm.headId} onChange={(e) => setDeptForm(prev => ({ ...prev, headId: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}>
                    <option value="">-- Choose Head --</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Parent Department (For Hierarchy)</label>
                  <select value={deptForm.parentDepartmentId} onChange={(e) => setDeptForm(prev => ({ ...prev, parentDepartmentId: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}>
                    <option value="">-- None --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                  <button type="button" onClick={() => setActiveModal(null)} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                  <button type="submit" disabled={modalLoading} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--accent-purple)', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>{modalLoading ? 'Saving...' : 'Create'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==================== EDIT DEPARTMENT MODAL ==================== */}
      {activeModal === 'edit_dept' && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ width: '460px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Edit Department</h3>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              {modalError && <div style={{ padding: '10px', backgroundColor: 'var(--accent-red-glow)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', borderRadius: '6px', marginBottom: '14px', fontSize: '12px' }}>{modalError}</div>}
              {modalSuccess && <div style={{ padding: '10px', backgroundColor: 'var(--accent-green-glow)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', borderRadius: '6px', marginBottom: '14px', fontSize: '12px' }}>{modalSuccess}</div>}
              
              <form onSubmit={(e) => { e.preventDefault(); handleAction('UPDATE_DEPARTMENT', { ...deptForm, id: selectedDept?.id }); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Department Name *</label>
                  <input type="text" required placeholder="e.g. Design Studio" value={deptForm.name} onChange={(e) => setDeptForm(prev => ({ ...prev, name: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Department Head</label>
                  <select value={deptForm.headId} onChange={(e) => setDeptForm(prev => ({ ...prev, headId: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}>
                    <option value="">-- Choose Head --</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Parent Department</label>
                  <select value={deptForm.parentDepartmentId} onChange={(e) => setDeptForm(prev => ({ ...prev, parentDepartmentId: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}>
                    <option value="">-- None --</option>
                    {departments.filter(d => d.id !== selectedDept?.id).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</label>
                  <select value={deptForm.status} onChange={(e) => setDeptForm(prev => ({ ...prev, status: e.target.value as any }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                  <button type="button" onClick={() => setActiveModal(null)} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                  <button type="submit" disabled={modalLoading} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--accent-purple)', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>{modalLoading ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CREATE ASSET CATEGORY MODAL ==================== */}
      {activeModal === 'create_cat' && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ width: '480px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Create Category</h3>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              {modalError && <div style={{ padding: '10px', backgroundColor: 'var(--accent-red-glow)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', borderRadius: '6px', marginBottom: '14px', fontSize: '12px' }}>{modalError}</div>}
              {modalSuccess && <div style={{ padding: '10px', backgroundColor: 'var(--accent-green-glow)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', borderRadius: '6px', marginBottom: '14px', fontSize: '12px' }}>{modalSuccess}</div>}
              
              <form onSubmit={(e) => { e.preventDefault(); handleAction('CREATE_CATEGORY', catForm); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Category Name *</label>
                  <input type="text" required placeholder="e.g. Lab Machinery" value={catForm.name} onChange={(e) => setCatForm(prev => ({ ...prev, name: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                </div>
                
                {/* Specifications List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid var(--border)', padding: '12px', borderRadius: '6px', backgroundColor: 'var(--bg-primary)' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>Custom Specifications (Optional Fields)</label>
                  
                  {catForm.fields.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                      {catForm.fields.map((f, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', border: '1px solid var(--border)' }}>
                          <span>{f.name} ({f.type}){f.required ? ' *' : ''}</span>
                          <button type="button" onClick={() => removeFieldFromCategory(i)} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontWeight: 600 }}>Remove</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                    <input type="text" placeholder="Field name" value={newField.name} onChange={(e) => setNewField(prev => ({ ...prev, name: e.target.value }))} style={{ padding: '6px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }} />
                    <select value={newField.type} onChange={(e) => setNewField(prev => ({ ...prev, type: e.target.value }))} style={{ padding: '6px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}>
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                    </select>
                    <button type="button" onClick={addFieldToCategory} style={{ padding: '6px 10px', backgroundColor: 'var(--accent-purple)', border: 'none', borderRadius: '4px', color: 'white', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>Add Field</button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                  <button type="button" onClick={() => setActiveModal(null)} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                  <button type="submit" disabled={modalLoading} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--accent-purple)', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>{modalLoading ? 'Saving...' : 'Create Category'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==================== EDIT EMPLOYEE ROLE MODAL ==================== */}
      {activeModal === 'edit_emp' && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ width: '460px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Assign Role & Department</h3>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              {modalError && <div style={{ padding: '10px', backgroundColor: 'var(--accent-red-glow)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', borderRadius: '6px', marginBottom: '14px', fontSize: '12px' }}>{modalError}</div>}
              {modalSuccess && <div style={{ padding: '10px', backgroundColor: 'var(--accent-green-glow)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', borderRadius: '6px', marginBottom: '14px', fontSize: '12px' }}>{modalSuccess}</div>}
              
              <div style={{ marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedEmp?.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{selectedEmp?.email}</div>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleAction('UPDATE_EMPLOYEE', { ...empForm, id: selectedEmp?.id }); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Assign System Role *</label>
                  <select value={empForm.role} onChange={(e) => setEmpForm(prev => ({ ...prev, role: e.target.value as any }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}>
                    <option value="Employee">Employee</option>
                    <option value="Department Head">Department Head</option>
                    <option value="Asset Manager">Asset Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Department *</label>
                  <select value={empForm.departmentId} onChange={(e) => setEmpForm(prev => ({ ...prev, departmentId: e.target.value }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</label>
                  <select value={empForm.status} onChange={(e) => setEmpForm(prev => ({ ...prev, status: e.target.value as any }))} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                  <button type="button" onClick={() => setActiveModal(null)} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                  <button type="submit" disabled={modalLoading} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--accent-purple)', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>{modalLoading ? 'Saving...' : 'Apply Promotion'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

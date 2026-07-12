import fs from 'fs';
import path from 'path';

export interface Department {
  id: string;
  name: string;
  headId: string; // Employee ID
  parentDepartmentId?: string;
  status: 'Active' | 'Inactive';
}

export interface AssetCategory {
  id: string;
  name: string;
  fields?: { name: string; type: string; required: boolean }[];
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  departmentId: string;
  role: 'Admin' | 'Asset Manager' | 'Department Head' | 'Employee';
  status: 'Active' | 'Inactive';
}

export interface Asset {
  id: string; // e.g. AF-0001
  name: string;
  categoryId: string;
  serialNumber: string;
  acquisitionDate: string; // YYYY-MM-DD
  acquisitionCost: number;
  condition: 'New' | 'Good' | 'Fair' | 'Poor';
  location: string;
  status: 'Available' | 'Allocated' | 'Reserved' | 'Under Maintenance' | 'Lost' | 'Retired' | 'Disposed';
  isBookable: boolean;
  currentHolderId: string | null; // Employee ID
  currentDepartmentId: string | null; // Department ID
  expectedReturnDate: string | null; // YYYY-MM-DD
}

export interface Booking {
  id: string;
  assetId: string;
  employeeId: string;
  startTime: string; // ISO string or YYYY-MM-DD HH:MM
  endTime: string;
  status: 'Upcoming' | 'Ongoing' | 'Completed' | 'Cancelled';
  notes?: string;
}

export interface TransferRequest {
  id: string;
  assetId: string;
  requestedById: string; // Employee ID
  targetEmployeeId: string; // Employee ID
  requestDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  notes?: string;
}

export interface MaintenanceRequest {
  id: string;
  assetId: string;
  issueDescription: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Pending' | 'Approved' | 'Rejected' | 'Technician Assigned' | 'In Progress' | 'Resolved';
  requestedById: string; // Employee ID
  requestDate: string;
  notes?: string;
}

export interface AuditCycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Closed';
  auditors: string[]; // Employee IDs
  assetChecks: Record<string, { status: 'Verified' | 'Missing' | 'Damaged'; notes?: string; checkedAt: string }>;
  discrepancyCount: number;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  isRead: boolean;
  timestamp: string;
}

export interface DbSchema {
  departments: Department[];
  categories: AssetCategory[];
  employees: Employee[];
  assets: Asset[];
  bookings: Booking[];
  transfers: TransferRequest[];
  maintenance: MaintenanceRequest[];
  audits: AuditCycle[];
  logs: ActivityLog[];
  notifications: AppNotification[];
}

const DB_FILE_PATH = path.join(process.cwd(), 'db.json');

const generateSeedData = (): DbSchema => {
  const departments: Department[] = [
    { id: 'dep-1', name: 'Engineering', headId: 'emp-1', status: 'Active' },
    { id: 'dep-2', name: 'Marketing', headId: 'emp-2', status: 'Active' },
    { id: 'dep-3', name: 'Operations', headId: 'emp-3', status: 'Active' }
  ];

  const categories: AssetCategory[] = [
    { id: 'cat-1', name: 'Electronics' },
    { id: 'cat-2', name: 'Furniture' },
    { id: 'cat-3', name: 'Vehicles' },
    { id: 'cat-4', name: 'Shared Spaces' }
  ];

  const employees: Employee[] = [
    { id: 'emp-1', name: 'Priya Shah', email: 'priya@assetflow.com', departmentId: 'dep-1', role: 'Department Head', status: 'Active' },
    { id: 'emp-2', name: 'Raj Sharma', email: 'raj@assetflow.com', departmentId: 'dep-2', role: 'Asset Manager', status: 'Active' },
    { id: 'emp-3', name: 'Kabir Peswani', email: 'kabir@assetflow.com', departmentId: 'dep-3', role: 'Admin', status: 'Active' }
  ];

  const assets: Asset[] = [];
  
  // Available loop: 1 to 129
  for (let i = 1; i <= 129; i++) {
    if (i === 3) {
      assets.push({
        id: 'AF-0003',
        name: 'ac unit',
        categoryId: 'cat-1',
        serialNumber: 'SN-AC-0003',
        acquisitionDate: '2025-01-10',
        acquisitionCost: 850,
        condition: 'Fair',
        location: 'HQ Floor 2',
        status: 'Available',
        isBookable: false,
        currentHolderId: null,
        currentDepartmentId: null,
        expectedReturnDate: null
      });
    } else if (i === 12) {
      // Mockup item: Dell Laptop, Allocated, bengaluru
      assets.push({
        id: 'AF-0012',
        name: 'Dell Laptop',
        categoryId: 'cat-1',
        serialNumber: 'SN-DELL-0012',
        acquisitionDate: '2025-03-10',
        acquisitionCost: 1100,
        condition: 'Good',
        location: 'bengaluru',
        status: 'Allocated',
        isBookable: false,
        currentHolderId: 'emp-1', // Priya Shah
        currentDepartmentId: 'dep-1',
        expectedReturnDate: '2026-08-15'
      });
    } else if (i === 62) {
      // Mockup item: Projector, Under Maintenance, HQ floor 2
      assets.push({
        id: 'AF-0062',
        name: 'Projector',
        categoryId: 'cat-1',
        serialNumber: 'SN-PROJ-0062',
        acquisitionDate: '2024-05-20',
        acquisitionCost: 1500,
        condition: 'Fair',
        location: 'HQ floor 2',
        status: 'Under Maintenance',
        isBookable: false,
        currentHolderId: null,
        currentDepartmentId: null,
        expectedReturnDate: null
      });
    } else if (i === 78) {
      assets.push({
        id: 'AF-0078',
        name: 'forklift',
        categoryId: 'cat-3',
        serialNumber: 'SN-FORK-0078',
        acquisitionDate: '2023-09-12',
        acquisitionCost: 15000,
        condition: 'Fair',
        location: 'Warehouse A',
        status: 'Under Maintenance',
        isBookable: false,
        currentHolderId: null,
        currentDepartmentId: 'dep-3',
        expectedReturnDate: null
      });
    } else if (i === 114) {
      assets.push({
        id: 'AF-0114',
        name: 'Dell laptop',
        categoryId: 'cat-1',
        serialNumber: 'SN-DELL-0114',
        acquisitionDate: '2025-01-10',
        acquisitionCost: 1200,
        condition: 'Good',
        location: 'HQ Floor 2',
        status: 'Allocated',
        isBookable: false,
        currentHolderId: 'emp-1', // Priya Shah
        currentDepartmentId: 'dep-1',
        expectedReturnDate: '2026-08-15'
      });
    } else {
      assets.push({
        id: `AF-${i.toString().padStart(4, '0')}`,
        name: i % 2 === 0 ? 'Ergonomic Task Chair' : 'UltraWide Monitor 34"',
        categoryId: i % 2 === 0 ? 'cat-2' : 'cat-1',
        serialNumber: `SN-AVAIL-${i}`,
        acquisitionDate: '2025-01-10',
        acquisitionCost: 350,
        condition: 'Good',
        location: 'HQ Floor 2',
        status: 'Available',
        isBookable: i <= 5, // make first 5 bookable (shared)
        currentHolderId: null,
        currentDepartmentId: null,
        expectedReturnDate: null
      });
    }
  }

  // Allocated loop: 130 to 205
  for (let i = 130; i <= 205; i++) {
    if (i === 201) {
      // Mockup item: Office chair, Available, Warehouse
      assets.push({
        id: 'AF-0201',
        name: 'Office chair',
        categoryId: 'cat-2',
        serialNumber: 'SN-CHAIR-0201',
        acquisitionDate: '2024-09-12',
        acquisitionCost: 200,
        condition: 'Good',
        location: 'Warehouse',
        status: 'Available',
        isBookable: false,
        currentHolderId: null,
        currentDepartmentId: null,
        expectedReturnDate: null
      });
    } else {
      let returnDate: string | null = null;
      
      // We want 3 overdue returns (due in June 2026, assuming today is July 12, 2026)
      if (i === 130) {
        returnDate = '2026-06-25'; // Overdue 1
      } else if (i === 131) {
        returnDate = '2026-06-30'; // Overdue 2
      } else if (i === 132) {
        returnDate = '2026-07-05'; // Overdue 3
      } 
      // We want 12 upcoming returns total (due in next 7 days, let's say between July 12 and July 19, 2026)
      else if (i >= 133 && i <= 144) {
        const dayOffset = (i - 133) % 7; // due in 0 to 6 days
        returnDate = `2026-07-${(12 + dayOffset).toString().padStart(2, '0')}`;
      }

      assets.push({
        id: `AF-${i.toString().padStart(4, '0')}`,
        name: i % 3 === 0 ? 'ThinkPad Laptop' : i % 3 === 1 ? 'MacBook Pro' : 'Dell Monitor',
        categoryId: 'cat-1',
        serialNumber: `SN-ALLOC-${i}`,
        acquisitionDate: '2024-11-15',
        acquisitionCost: 1200,
        condition: 'Good',
        location: 'Remote Work',
        status: 'Allocated',
        isBookable: false,
        currentHolderId: 'emp-1',
        currentDepartmentId: 'dep-1',
        expectedReturnDate: returnDate
      });
    }
  }

  // Maintenance loop: 206 to 208
  for (let i = 206; i <= 208; i++) {
    assets.push({
      id: `AF-${i.toString().padStart(4, '0')}`,
      name: 'Office Shuttle Van',
      categoryId: 'cat-3',
      serialNumber: `SN-MAINT-${i}`,
      acquisitionDate: '2022-08-11',
      acquisitionCost: 45000,
      condition: 'Fair',
      location: 'Service Garage',
      status: 'Under Maintenance',
      isBookable: false,
      currentHolderId: null,
      currentDepartmentId: 'dep-3',
      expectedReturnDate: null
    });
  }

  // Conference room B2 - Shared Space
  assets.push({
    id: 'AF-0210',
    name: 'Conference room B2',
    categoryId: 'cat-4',
    serialNumber: 'SN-ROOM-B2',
    acquisitionDate: '2024-01-10',
    acquisitionCost: 10000,
    condition: 'Good',
    location: 'HQ Floor 2',
    status: 'Available',
    isBookable: true,
    currentHolderId: null,
    currentDepartmentId: null,
    expectedReturnDate: null
  });

  // Mockup maintenance assets
  assets.push({
    id: 'AF-0897',
    name: 'Printer',
    categoryId: 'cat-1',
    serialNumber: 'SN-PRINT-0897',
    acquisitionDate: '2025-02-18',
    acquisitionCost: 450,
    condition: 'Fair',
    location: 'HQ Floor 2',
    status: 'Under Maintenance',
    isBookable: false,
    currentHolderId: null,
    currentDepartmentId: null,
    expectedReturnDate: null
  });

  assets.push({
    id: 'AF-0873',
    name: 'Chair',
    categoryId: 'cat-2',
    serialNumber: 'SN-CHAIR-0873',
    acquisitionDate: '2025-01-10',
    acquisitionCost: 150,
    condition: 'Good',
    location: 'Office Room 1',
    status: 'Available',
    isBookable: false,
    currentHolderId: null,
    currentDepartmentId: null,
    expectedReturnDate: null
  });

  // Bookings: 9 total (active/upcoming)
  const bookings: Booking[] = [];
  for (let i = 1; i <= 9; i++) {
    bookings.push({
      id: `bk-${i}`,
      assetId: `AF-000${(i % 5) + 1}`, // refers to bookable assets
      employeeId: 'emp-1',
      startTime: `2026-07-12T${(10 + i).toString().padStart(2, '0')}:00`,
      endTime: `2026-07-12T${(11 + i).toString().padStart(2, '0')}:00`,
      status: i === 1 ? 'Ongoing' : 'Upcoming'
    });
  }

  // Seed mockup booking for Conference room B2 on July 7, 2026 from 9:00 AM to 10:00 AM
  bookings.push({
    id: 'bk-mockup-b2',
    assetId: 'AF-0210',
    employeeId: 'emp-1',
    startTime: '2026-07-07T09:00:00',
    endTime: '2026-07-07T10:00:00',
    status: 'Completed',
    notes: 'Booked - Procurement Team - 9 to 10'
  });

  // Seed mockup booking for Conference room B2 on July 12, 2026 from 9:00 AM to 10:00 AM (for current date testing)
  bookings.push({
    id: 'bk-mockup-b2-today',
    assetId: 'AF-0210',
    employeeId: 'emp-1',
    startTime: '2026-07-12T09:00:00',
    endTime: '2026-07-12T10:00:00',
    status: 'Ongoing',
    notes: 'Booked - Procurement Team - 9 to 10'
  });

  // Transfers: 3 pending
  const transfers: TransferRequest[] = [];
  for (let i = 1; i <= 3; i++) {
    transfers.push({
      id: `tr-${i}`,
      assetId: `AF-000${i}`,
      requestedById: 'emp-2',
      targetEmployeeId: 'emp-1',
      requestDate: '2026-07-12',
      status: 'Pending'
    });
  }

  // Maintenance Requests
  const maintenance: MaintenanceRequest[] = [
    {
      id: 'mt-1',
      assetId: 'AF-0062',
      issueDescription: 'Projector bulb not turning on',
      priority: 'High',
      status: 'Pending',
      requestedById: 'emp-1',
      requestDate: '2026-07-10'
    },
    {
      id: 'mt-2',
      assetId: 'AF-0003',
      issueDescription: 'ac unit noisy compressor',
      priority: 'Medium',
      status: 'Approved',
      requestedById: 'emp-1',
      requestDate: '2026-07-08'
    },
    {
      id: 'mt-3',
      assetId: 'AF-0078',
      issueDescription: 'forklift',
      priority: 'High',
      status: 'Technician Assigned',
      requestedById: 'emp-2',
      requestDate: '2026-07-06',
      notes: 'tech: R varma'
    },
    {
      id: 'mt-4',
      assetId: 'AF-0897',
      issueDescription: 'Printer Jam',
      priority: 'Low',
      status: 'In Progress',
      requestedById: 'emp-1',
      requestDate: '2026-07-05',
      notes: 'parts ordered'
    },
    {
      id: 'mt-5',
      assetId: 'AF-0873',
      issueDescription: 'Chair repair',
      priority: 'Low',
      status: 'Resolved',
      requestedById: 'emp-2',
      requestDate: '2026-07-04',
      notes: 'resolved 7 Jul'
    }
  ];

  const audits: AuditCycle[] = [];

  // Recent logs matching mockup EXACTLY:
  // Laptop AF-0114 - allocated to Priya shah - Engineering
  // Room B2 - booking confirmed - 2:00 to 3:00 PM
  // Projector AF-0062 - maintenance resolved
  const logs: ActivityLog[] = [
    {
      id: 'log-1',
      userId: 'emp-1',
      userName: 'System',
      action: 'ALLOCATE',
      details: 'Laptop AF-0114 - allocated to Priya shah - Engineering',
      timestamp: '2026-07-12T14:15:00Z'
    },
    {
      id: 'log-2',
      userId: 'emp-1',
      userName: 'System',
      action: 'CONFIRM_BOOKING',
      details: 'Room B2 - booking confirmed - 2:00 to 3:00 PM',
      timestamp: '2026-07-12T14:10:00Z'
    },
    {
      id: 'log-3',
      userId: 'emp-2',
      userName: 'System',
      action: 'RESOLVE_MAINTENANCE',
      details: 'Projector AF-0062 - maintenance resolved',
      timestamp: '2026-07-12T14:05:00Z'
    },
    {
      id: 'log-alloc-114',
      userId: 'emp-2',
      userName: 'Raj Sharma',
      action: 'ALLOCATE',
      details: 'Laptop AF-0114 - allocated to Priya shah - Engineering',
      timestamp: '2026-03-12T10:00:00Z'
    },
    {
      id: 'log-ret-114',
      userId: 'emp-1',
      userName: 'System',
      action: 'RETURN',
      details: 'Laptop AF-0114 - returned by Arjun Nair - condition: good',
      timestamp: '2026-01-04T15:30:00Z'
    }
  ];

  const notifications: AppNotification[] = [];

  return {
    departments,
    categories,
    employees,
    assets,
    bookings,
    transfers,
    maintenance,
    audits,
    logs,
    notifications
  };
};

export function getDb(): DbSchema {
  if (!fs.existsSync(DB_FILE_PATH)) {
    const data = generateSeedData();
    saveDb(data);
    return data;
  }
  try {
    const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    return JSON.parse(raw) as DbSchema;
  } catch (err) {
    const data = generateSeedData();
    saveDb(data);
    return data;
  }
}

export function saveDb(data: DbSchema): void {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save database file', err);
  }
}

export function resetDb(): void {
  const data = generateSeedData();
  saveDb(data);
}

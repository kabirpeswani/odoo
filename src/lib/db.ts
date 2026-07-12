import fs from 'fs';
import path from 'path';

export interface Department {
  id: string;
  name: string;
  headId: string; // Employee ID
  status: 'Active' | 'Inactive';
}

export interface AssetCategory {
  id: string;
  name: string;
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
    { id: 'dep-1', name: 'IT Department', headId: 'emp-2', status: 'Active' },
    { id: 'dep-2', name: 'Marketing', headId: 'emp-3', status: 'Active' },
    { id: 'dep-3', name: 'Operations', headId: 'emp-4', status: 'Active' }
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
  
  // Seed assets to match mockup counts:
  // Available: 128 (minus bookable ones if they are counted separately, let's make total available exactly 128)
  for (let i = 1; i <= 128; i++) {
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
      isBookable: i <= 5 // make first 5 bookable (shared)
    });
  }

  // Allocated: 76 total (including 3 overdue ones and 12 upcoming returns)
  // Let's seed 76 allocated assets
  for (let i = 129; i <= 204; i++) {
    let returnDate: string | null = null;
    
    // We want 3 overdue returns (due in June 2026, assuming today is July 12, 2026)
    if (i === 129) {
      returnDate = '2026-06-25'; // Overdue 1
    } else if (i === 130) {
      returnDate = '2026-06-30'; // Overdue 2
    } else if (i === 131) {
      returnDate = '2026-07-05'; // Overdue 3
    } 
    // We want 12 upcoming returns total (due in next 7 days, let's say between July 12 and July 19, 2026)
    // Overdue returns are excluded from upcoming returns
    else if (i >= 132 && i <= 143) {
      const dayOffset = (i - 132) % 7; // due in 0 to 6 days
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

  // Maintenance: 4 assets
  for (let i = 205; i <= 208; i++) {
    assets.push({
      id: `AF-${i.toString().padStart(4, '0')}`,
      name: i === 205 ? 'Projector AF-0062' : 'Office Shuttle Van',
      categoryId: i === 205 ? 'cat-1' : 'cat-3',
      serialNumber: `SN-MAINT-${i}`,
      acquisitionDate: '2023-05-12',
      acquisitionCost: 25000,
      condition: 'Fair',
      location: 'Service Garage',
      status: 'Under Maintenance',
      isBookable: false,
      currentHolderId: null,
      currentDepartmentId: 'dep-3',
      expectedReturnDate: null
    });
  }

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
      assetId: 'AF-205',
      issueDescription: 'Bulb burned out',
      priority: 'High',
      status: 'Resolved',
      requestedById: 'emp-1',
      requestDate: '2026-07-10'
    }
  ];

  const audits: AuditCycle[] = [];

  // Recent logs matching mockup EXACTLY:
  // Laptop AF-0114 - allocated to Priya shah - IT dept
  // Room B2 - booking confirmed - 2:00 to 3:00 PM
  // Projector AF-0062 - maintenance resolved
  const logs: ActivityLog[] = [
    {
      id: 'log-1',
      userId: 'emp-2',
      userName: 'System',
      action: 'ALLOCATE',
      details: 'Laptop AF-0114 - allocated to Priya shah - IT dept',
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

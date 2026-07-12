import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb, Department, AssetCategory, Employee, ActivityLog } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    return NextResponse.json({
      departments: db.departments,
      categories: db.categories,
      employees: db.employees
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();
    const { action, payload, userId = 'emp-3' } = body; // Simulated Admin user Kabir

    const user = db.employees.find(e => e.id === userId) || { id: 'emp-3', name: 'Kabir Peswani' };
    const timestamp = new Date().toISOString();

    if (action === 'CREATE_DEPARTMENT') {
      const { name, headId, parentDepartmentId, status } = payload;
      const nextId = `dep-${db.departments.length + 1}`;

      const newDept: Department = {
        id: nextId,
        name,
        headId: headId || '',
        parentDepartmentId: parentDepartmentId || undefined,
        status: status || 'Active'
      };

      db.departments.push(newDept);

      // Log action
      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        action: 'CREATE_DEPARTMENT',
        details: `Created department "${newDept.name}"`,
        timestamp
      };
      db.logs.push(log);

      saveDb(db);
      return NextResponse.json({ success: true, department: newDept });
    }

    if (action === 'UPDATE_DEPARTMENT') {
      const { id, name, headId, parentDepartmentId, status } = payload;
      const index = db.departments.findIndex(d => d.id === id);

      if (index === -1) {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 });
      }

      db.departments[index] = {
        ...db.departments[index],
        name,
        headId,
        parentDepartmentId: parentDepartmentId || undefined,
        status
      };

      // Log action
      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        action: 'UPDATE_DEPARTMENT',
        details: `Updated department "${name}" (ID: ${id})`,
        timestamp
      };
      db.logs.push(log);

      saveDb(db);
      return NextResponse.json({ success: true, department: db.departments[index] });
    }

    if (action === 'CREATE_CATEGORY') {
      const { name, fields } = payload;
      const nextId = `cat-${db.categories.length + 1}`;

      const newCat: AssetCategory = {
        id: nextId,
        name,
        fields: fields || []
      };

      db.categories.push(newCat);

      // Log action
      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        action: 'CREATE_CATEGORY',
        details: `Created asset category "${newCat.name}"`,
        timestamp
      };
      db.logs.push(log);

      saveDb(db);
      return NextResponse.json({ success: true, category: newCat });
    }

    if (action === 'UPDATE_EMPLOYEE') {
      const { id, role, departmentId, status } = payload;
      const index = db.employees.findIndex(e => e.id === id);

      if (index === -1) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }

      const prevRole = db.employees[index].role;
      db.employees[index] = {
        ...db.employees[index],
        role,
        departmentId,
        status
      };

      // Log action
      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        action: 'PROMOTE_EMPLOYEE',
        details: `Updated employee ${db.employees[index].name} role from ${prevRole} to ${role} and status to ${status}`,
        timestamp
      };
      db.logs.push(log);

      saveDb(db);
      return NextResponse.json({ success: true, employee: db.employees[index] });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

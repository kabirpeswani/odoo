import { NextRequest, NextResponse } from 'next/server';
import { getDb, Asset, Booking, MaintenanceRequest } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    
    // 1. Asset status distribution
    const statusCounts = {
      Available: db.assets.filter(a => a.status === 'Available').length,
      Allocated: db.assets.filter(a => a.status === 'Allocated').length,
      Reserved: db.assets.filter(a => a.status === 'Reserved').length,
      UnderMaintenance: db.assets.filter(a => a.status === 'Under Maintenance').length,
      Lost: db.assets.filter(a => a.status === 'Lost').length,
      Retired: db.assets.filter(a => a.status === 'Retired' || a.status === 'Disposed').length,
    };

    // 2. Department allocation counts
    const deptAllocations = db.departments.map(d => {
      const count = db.assets.filter(a => a.currentDepartmentId === d.id).length;
      return {
        departmentName: d.name,
        count
      };
    });

    // 3. Maintenance frequency by category
    const maintenanceByCategory = db.categories.map(c => {
      const count = db.maintenance.filter(m => {
        const asset = db.assets.find(a => a.id === m.assetId);
        return asset && asset.categoryId === c.id;
      }).length;
      return {
        categoryName: c.name,
        count
      };
    });

    // 4. Assets nearing retirement (older than 1 year or condition Poor)
    const nearingRetirement = db.assets.filter(a => {
      const acqDate = new Date(a.acquisitionDate);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      return acqDate < oneYearAgo || a.condition === 'Poor';
    }).slice(0, 5).map(a => {
      const category = db.categories.find(c => c.id === a.categoryId)?.name || 'Unknown';
      return {
        id: a.id,
        name: a.name,
        category,
        condition: a.condition,
        acquisitionDate: a.acquisitionDate
      };
    });

    // 5. Booking Heatmap data (peak usage by weekday and hour slot)
    // Weekdays: Mon(1) to Fri(5). Hours: 9 to 17
    const heatmap: Record<string, Record<number, number>> = {
      'Mon': {}, 'Tue': {}, 'Wed': {}, 'Thu': {}, 'Fri': {}
    };

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Initialize
    Object.keys(heatmap).forEach(day => {
      for (let h = 9; h <= 17; h++) {
        heatmap[day][h] = 0;
      }
    });

    db.bookings.forEach(b => {
      if (b.status === 'Cancelled') return;
      const start = new Date(b.startTime);
      const dayName = days[start.getDay()];
      const hour = start.getHours();
      
      if (heatmap[dayName] && hour >= 9 && hour <= 17) {
        heatmap[dayName][hour] += 1;
      }
    });

    // Format heatmap for response
    const formattedHeatmap = Object.entries(heatmap).map(([day, hours]) => {
      return {
        day,
        slots: Object.entries(hours).map(([hour, count]) => ({
          hour: parseInt(hour),
          count
        }))
      };
    });

    // 6. General KPIs
    const totalAssetsVal = db.assets.reduce((sum, a) => sum + (a.acquisitionCost || 0), 0);
    const utilizationRate = db.assets.length > 0 
      ? Math.round((db.assets.filter(a => a.status === 'Allocated' || a.status === 'Reserved').length / db.assets.length) * 100) 
      : 0;

    return NextResponse.json({
      statusCounts,
      deptAllocations,
      maintenanceByCategory,
      nearingRetirement,
      heatmap: formattedHeatmap,
      kpis: {
        totalAssetsCount: db.assets.length,
        totalAssetsVal,
        utilizationRate,
        maintenanceCount: db.maintenance.length
      },
      assets: db.assets,
      maintenance: db.maintenance
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

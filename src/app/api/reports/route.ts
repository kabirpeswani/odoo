import { NextResponse } from 'next/server';
import { odooGet } from '@/lib/odooClient';

export async function GET() {
  try {
    const data = await odooGet('/api/assetflow/reports');
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

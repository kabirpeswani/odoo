import { NextRequest, NextResponse } from 'next/server';
import { odooGet, odooPost } from '@/lib/odooClient';

export async function GET() {
  try {
    const data = await odooGet('/api/assetflow/dashboard');
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, payload, userId = 'emp-1' } = body;
    const result = await odooPost('/api/assetflow/dashboard', { action, payload, userId });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

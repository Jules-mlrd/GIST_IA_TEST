import { NextResponse } from 'next/server';
import { getPreanalysisStatus } from '@/lib/utils';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get('file');
  if (!file) return NextResponse.json({ error: 'Paramètre file requis' }, { status: 400 });
  const status = await getPreanalysisStatus(file);
  return NextResponse.json({ file, status });
} 
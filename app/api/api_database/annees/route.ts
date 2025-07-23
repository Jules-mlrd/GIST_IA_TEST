import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const dates = await prisma.affaires.findMany({
      where: {
        date_demande_client: { not: null }
      },
      select: { date_demande_client: true },
      distinct: ['date_demande_client']
    });
    const anneesSet = new Set<string>();
    for (const d of dates) {
      if (d.date_demande_client) {
        anneesSet.add(d.date_demande_client.getFullYear().toString());
      }
    }
    const annees = Array.from(anneesSet).sort();
    return NextResponse.json({ success: true, annees });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
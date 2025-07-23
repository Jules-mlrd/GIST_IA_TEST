import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const etatsRaw = await prisma.affaires.findMany({
      where: {
        etat: {
          not: null,
          notIn: [""]
        }
      },
      select: { etat: true },
      distinct: ['etat'],
      orderBy: { etat: 'asc' }
    });
    const etats = etatsRaw.map(r => r.etat);
    return NextResponse.json({ success: true, etats });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
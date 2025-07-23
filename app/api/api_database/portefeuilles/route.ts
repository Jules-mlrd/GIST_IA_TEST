import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const portefeuillesRaw = await prisma.affaires.findMany({
      where: {
        portefeuille_projet: {
          not: null,
          notIn: [""]
        }
      },
      select: { portefeuille_projet: true },
      distinct: ['portefeuille_projet'],
      orderBy: { portefeuille_projet: 'asc' }
    });
    const portefeuilles = portefeuillesRaw.map(r => r.portefeuille_projet);
    return NextResponse.json({ success: true, portefeuilles });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
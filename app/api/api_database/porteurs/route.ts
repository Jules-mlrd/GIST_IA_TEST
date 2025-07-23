import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const porteursRaw = await prisma.affaires.findMany({
      where: {
        porteur: {
          not: null,
          notIn: [""]
        }
      },
      select: { porteur: true },
      distinct: ['porteur'],
      orderBy: { porteur: 'asc' }
    });
    const porteurs = porteursRaw.map(r => r.porteur);
    return NextResponse.json({ success: true, porteurs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
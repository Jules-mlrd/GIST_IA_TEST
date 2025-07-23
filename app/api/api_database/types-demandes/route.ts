import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const typesRaw = await prisma.affaires.findMany({
      where: {
        type_demande: {
          not: null,
          notIn: [""]
        }
      },
      select: { type_demande: true },
      distinct: ['type_demande'],
      orderBy: { type_demande: 'asc' }
    });
    const types = typesRaw.map(r => r.type_demande);
    return NextResponse.json({ success: true, types });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
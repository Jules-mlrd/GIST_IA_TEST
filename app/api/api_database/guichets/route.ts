import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const guichetsRaw = await prisma.affaires.findMany({
      where: {
        guichet: {
          not: null,
          notIn: [""]
        }
      },
      select: { guichet: true },
      distinct: ['guichet'],
      orderBy: { guichet: 'asc' }
    });
    const guichets = guichetsRaw.map(r => r.guichet);
    return NextResponse.json({ success: true, guichets });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
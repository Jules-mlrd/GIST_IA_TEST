import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const referentsRaw = await prisma.affaires.findMany({
      where: {
        referent: {
          not: null,
          notIn: [""]
        }
      },
      select: { referent: true },
      distinct: ['referent'],
      orderBy: { referent: 'asc' }
    });
    const referents = referentsRaw.map(r => r.referent);
    return NextResponse.json({ success: true, referents });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
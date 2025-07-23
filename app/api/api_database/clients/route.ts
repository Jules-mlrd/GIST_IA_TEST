import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const clientsRaw = await prisma.affaires.findMany({
      where: {
        client: {
          not: null,
          notIn: [""]
        }
      },
      select: { client: true },
      distinct: ['client'],
      orderBy: { client: 'asc' }
    });
    const clients = clientsRaw.map(r => r.client);
    return NextResponse.json({ success: true, clients });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const contactsRaw = await prisma.affaires.findMany({
      where: {
        contact_moa_moeg: {
          not: null,
          notIn: [""]
        }
      },
      select: { contact_moa_moeg: true },
      distinct: ['contact_moa_moeg'],
      orderBy: { contact_moa_moeg: 'asc' }
    });
    const contacts = contactsRaw.map(r => r.contact_moa_moeg);
    return NextResponse.json({ success: true, contacts });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
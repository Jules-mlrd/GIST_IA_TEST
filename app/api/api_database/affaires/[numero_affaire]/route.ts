import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET(req: NextRequest, { params }: { params: Promise<{ numero_affaire: string }> }) {
  try {
    const { numero_affaire } = await params;
    if (!numero_affaire) {
      return NextResponse.json({ success: false, error: 'numero_affaire manquant dans l\'URL.' }, { status: 400 });
    }
    const affaire = await prisma.affaires.findFirst({ where: { numero_affaire } });
    if (!affaire) {
      return NextResponse.json({ success: false, error: 'Aucune affaire trouvée pour ce numéro.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, affaire });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
} 
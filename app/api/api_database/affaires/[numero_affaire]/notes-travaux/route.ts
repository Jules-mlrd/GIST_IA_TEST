import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET(req: NextRequest, { params }: { params: Promise<{ numero_affaire: string }> }) {
  try {
    const { numero_affaire } = await params;
    if (!numero_affaire) {
      return NextResponse.json({ success: false, error: 'numero_affaire manquant dans l\'URL.' }, { status: 400 });
    }
    // On récupère l'affaire pour obtenir son id
    const affaire = await prisma.affaires.findFirst({ where: { numero_affaire } });
    if (!affaire) {
      return NextResponse.json({ success: false, error: 'Affaire non trouvée.' }, { status: 404 });
    }
    // On récupère toutes les notes travaux liées à cette affaire
    const notes = await prisma.notes_travaux.findMany({
      where: { affaire_id: affaire.id },
      select: {
        id: true,
        note: true,
        affaire_id: true,
        libelle: true,
        date_creation: true,
        etat: true,
      },
      orderBy: { date_creation: 'desc' },
    });
    return NextResponse.json({ success: true, notes });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
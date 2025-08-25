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
    // On récupère le devis id=1 pour cette affaire
    const devis = await prisma.devis.findFirst({
      where: { affaire_id: affaire.id, id: 1 },
      select: {
        id: true,
        numero_devis: true,
        affaire_id: true,
        demande_id: true,
        objet: true,
        table_etablissement: true,
        etat: true,
      },
    });
    if (!devis) {
      return NextResponse.json({ success: false, error: 'Aucun devis trouvé pour cette affaire (id=1).' }, { status: 404 });
    }
    return NextResponse.json({ success: true, devis });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
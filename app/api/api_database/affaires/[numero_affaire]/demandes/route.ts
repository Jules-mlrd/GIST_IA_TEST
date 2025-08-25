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
    // On récupère toutes les demandes liées à cette affaire
    const demandes = await prisma.demande.findMany({
      where: { affaire_id: affaire.id },
      select: {
        id: true,
        numero_demande: true,
        demandeur: true,
        etat: true,
        compte_projet: true,
        titre: true,
        date_demande: true,
        statut: true,
        affaire_id: true,
      },
      orderBy: { date_demande: 'desc' },
    });
    return NextResponse.json({ success: true, demandes });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
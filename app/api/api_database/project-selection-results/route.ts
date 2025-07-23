import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const filters = await req.json();
    const where: any = {};
    if (filters.libelle && filters.libelle !== "") {
      where.OR = [
        { numero_affaire: { contains: filters.libelle } },
        { titre: { contains: filters.libelle } }
      ];
    }
    if (filters.etat && filters.etat !== "") {
      where.etat = { equals: filters.etat, mode: 'insensitive' };
    }
    if (filters.referent && filters.referent !== "") {
      where.referent = filters.referent;
    }
    if (filters.guichet && filters.guichet !== "") {
      where.guichet = filters.guichet;
    }
    if (filters.portefeuille && filters.portefeuille !== "") {
      where.portefeuille_projet = filters.portefeuille;
    }
    if (filters.client && filters.client !== "") {
      where.client = filters.client;
    }
    if (filters.contact && filters.contact !== "") {
      where.contact_moa_moeg = filters.contact;
    }
    if (filters.porteur && filters.porteur !== "") {
      where.porteur = filters.porteur;
    }
    if (filters.typeDemande && Array.isArray(filters.typeDemande) && filters.typeDemande.length > 0) {
      where.type_demande = { in: filters.typeDemande };
    }
    if (filters.annee && filters.annee !== "") {
      where.date_demande_client = {
        gte: new Date(`${filters.annee}-01-01`),
        lte: new Date(`${filters.annee}-12-31`)
      };
    }
    // Les filtres rechCommentaire, rechAbrev, sites, affaireNonAffectee, portefeuilleVide, affaireSansDevis, femEsti, sansSitesAffectes, compteProjet sont ignorés si non mappés dans Prisma
    if (filters.rechAbrev && filters.rechAbrev !== "") {
      where.reference_client = { contains: filters.rechAbrev };
    }
    if (filters.sites && filters.sites !== "") {
      where.site = { contains: filters.sites };
    }
    if (filters.affaireNonAffectee) {
      where.affecte = { in: [null, 0] };
    }
    if (filters.portefeuilleVide) {
      where.portefeuille_projet = { in: [null, ""] };
    }
    if (filters.affaireSansDevis) {
      where.devis_associe = { in: [null, ""] };
    }
    if (filters.femEsti) {
      where.fem_esti = "1";
    }
    if (filters.sansSitesAffectes) {
      where.site = { in: [null, ""] };
    }
    if (filters.compteProjet && filters.compteProjet !== "") {
      where.compte_projet = { contains: filters.compteProjet };
    }
    // rechCommentaire et commentaire ne semblent pas exister dans le modèle Prisma
    const data = await prisma.affaires.findMany({
      where,
      select: {
        numero_affaire: true,
        titre: true,
        etat: true,
        referent: true,
        porteur: true,
        type_demande: true,
        portefeuille_projet: true,
        priorite: true,
        date_demande_client: true,
        date_rea_souhaitee: true,
        compte_projet: true,
        reference_client: true
      },
      take: 100
    });
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
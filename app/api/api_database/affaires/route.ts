import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import s3 from '@/lib/s3Client';
import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

function generateNumeroAffaire(annee: string | number | undefined, lastId: number): string {
  // Exemple : A24-0001 (A + 2 derniers chiffres année + - + id sur 4 chiffres)
  const year = (annee || new Date().getFullYear()).toString().slice(-2);
  const idStr = String(lastId).padStart(4, '0');
  return `A${year}-${idStr}`;
}

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Récupère le prochain id auto-incrément (Postgres : on utilise la séquence)
    const lastAffaire = await prisma.affaires.findFirst({
      orderBy: { id: 'desc' },
    });
    const nextId = lastAffaire ? lastAffaire.id + 1 : 1;
    const numero_affaire = generateNumeroAffaire(body.annee, nextId);
    const s3Prefix = `affaires/${numero_affaire}/`;
    // Insertion
    await prisma.affaires.create({
      data: {
        numero_affaire,
        titre: body.libelle,
        etat: body.etat,
        referent: body.referent,
        porteur: body.porteur,
        type_demande: Array.isArray(body.typeDemande) ? body.typeDemande.join(', ') : body.typeDemande,
        portefeuille_projet: body.portefeuille,
        priorite: body.priorite || '',
        date_demande_client: body.date_demande_client || null,
        date_rea_souhaitee: body.date_rea_souhaitee || null,
        compte_projet: body.compteProjet,
        reference_client: body.reference_client || '',
        client: body.client,
        guichet: body.guichet,
        contact_moa_moeg: body.contact,
        s3_folder: s3Prefix,
        // annee retiré car non présent dans le modèle
      },
    });
    // Création du dossier S3 et du fichier metadata.json
    // Crée un objet vide pour le dossier (optionnel, S3 gère les dossiers virtuellement)
    await s3.send(new PutObjectCommand({
      Bucket: 'gism-documents',
      Key: s3Prefix
    }));
    // Crée le fichier metadata.json avec les infos de l'affaire
    await s3.send(new PutObjectCommand({
      Bucket: 'gism-documents',
      Key: `${s3Prefix}metadata.json`,
      Body: JSON.stringify({
        numero_affaire,
        titre: body.libelle,
        etat: body.etat,
        referent: body.referent,
        porteur: body.porteur,
        type_demande: Array.isArray(body.typeDemande) ? body.typeDemande.join(', ') : body.typeDemande,
        portefeuille_projet: body.portefeuille,
        priorite: body.priorite || '',
        date_demande_client: body.date_demande_client || null,
        date_rea_souhaitee: body.date_rea_souhaitee || null,
        compte_projet: body.compteProjet,
        reference_client: body.reference_client || '',
        client: body.client,
        guichet: body.guichet,
        contact_moa_moeg: body.contact,
        annee: body.annee
      }),
      ContentType: 'application/json'
    }));

    return NextResponse.json({ success: true, numero_affaire });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.numero_affaire) return NextResponse.json({ success: false, error: 'numero_affaire requis' });
    // Trouver l'affaire par numero_affaire
    const affaire = await prisma.affaires.findFirst({ where: { numero_affaire: body.numero_affaire } });
    if (!affaire) return NextResponse.json({ success: false, error: 'Affaire non trouvée' });
    await prisma.affaires.update({
      where: { id: affaire.id },
      data: {
        titre: body.libelle,
        etat: body.etat,
        referent: body.referent,
        porteur: body.porteur,
        type_demande: Array.isArray(body.typeDemande) ? body.typeDemande.join(', ') : body.typeDemande,
        portefeuille_projet: body.portefeuille,
        priorite: body.priorite || '',
        date_demande_client: body.date_demande_client || null,
        date_rea_souhaitee: body.date_rea_souhaitee || null,
        compte_projet: body.compteProjet,
        reference_client: body.reference_client || '',
        client: body.client,
        guichet: body.guichet,
        contact_moa_moeg: body.contact,
        s3_folder: `affaires/${body.numero_affaire}/`,
        // annee retiré car non présent dans le modèle
      },
    });
    // Update metadata.json sur S3
    const s3Prefix = `affaires/${body.numero_affaire}/`;
    await s3.send(new PutObjectCommand({
      Bucket: 'gism-documents',
      Key: `${s3Prefix}metadata.json`,
      Body: JSON.stringify({
        numero_affaire: body.numero_affaire,
        titre: body.libelle,
        etat: body.etat,
        referent: body.referent,
        porteur: body.porteur,
        type_demande: Array.isArray(body.typeDemande) ? body.typeDemande.join(', ') : body.typeDemande,
        portefeuille_projet: body.portefeuille,
        priorite: body.priorite || '',
        date_demande_client: body.date_demande_client || null,
        date_rea_souhaitee: body.date_rea_souhaitee || null,
        compte_projet: body.compteProjet,
        reference_client: body.reference_client || '',
        client: body.client,
        guichet: body.guichet,
        contact_moa_moeg: body.contact,
        annee: body.annee
      }),
      ContentType: 'application/json'
    }));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { numero_affaire } = await req.json();
    if (!numero_affaire) return NextResponse.json({ success: false, error: 'numero_affaire requis' });
    // Trouver l'affaire par numero_affaire
    const affaire = await prisma.affaires.findFirst({ where: { numero_affaire } });
    if (!affaire) return NextResponse.json({ success: false, error: 'Affaire non trouvée' });
    await prisma.affaires.delete({ where: { id: affaire.id } });
    // Suppression du dossier S3 (tous les objets sous le préfixe)
    const s3Prefix = `affaires/${numero_affaire}/`;
    // Liste tous les objets à supprimer
    const list = await s3.send(new ListObjectsV2Command({ Bucket: 'gism-documents', Prefix: s3Prefix }));
    if (list.Contents && list.Contents.length > 0) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: 'gism-documents',
        Delete: { Objects: list.Contents.map(obj => ({ Key: obj.Key! })) }
      }));
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
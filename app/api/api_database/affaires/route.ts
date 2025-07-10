import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import s3 from '@/lib/s3Client';
import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

function generateNumeroAffaire(annee: string | number | undefined, lastId: number): string {
  // Exemple : A24-0001 (A + 2 derniers chiffres année + - + id sur 4 chiffres)
  const year = (annee || new Date().getFullYear()).toString().slice(-2);
  const idStr = String(lastId).padStart(4, '0');
  return `A${year}-${idStr}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'DevMySQL2024!',
      database: 'gestion_affaires',
    });
    // Récupère le prochain id auto-incrément
    const [idRows] = await connection.execute('SELECT AUTO_INCREMENT as nextId FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', ['gestion_affaires', 'affaires']);
    const nextId = Array.isArray(idRows) && idRows.length > 0 ? (idRows[0] as any).nextId || 1 : 1;
    const numero_affaire = generateNumeroAffaire(body.annee, nextId);
    // Création du dossier S3 et du fichier metadata.json
    const s3Prefix = `affaires/${numero_affaire}/`;
    // Insertion (ajoute s3_folder)
    const [result] = await connection.execute(
      `INSERT INTO affaires (numero_affaire, titre, etat, referent, porteur, type_demande, portefeuille_projet, priorite, date_demande_client, date_rea_souhaitee, compte_projet, reference_client, client, guichet, contact_moa_moeg, s3_folder)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      , [
        numero_affaire,
        body.libelle,
        body.etat,
        body.referent,
        body.porteur,
        Array.isArray(body.typeDemande) ? body.typeDemande.join(', ') : body.typeDemande,
        body.portefeuille,
        body.priorite || '',
        body.date_demande_client || null,
        body.date_rea_souhaitee || null,
        body.compteProjet,
        body.reference_client || '',
        body.client,
        body.guichet,
        body.contact,
        s3Prefix
      ]
    );
    await connection.end();

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
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'DevMySQL2024!',
      database: 'gestion_affaires',
    });
    // Update SQL
    await connection.execute(
      `UPDATE affaires SET titre=?, etat=?, referent=?, porteur=?, type_demande=?, portefeuille_projet=?, priorite=?, date_demande_client=?, date_rea_souhaitee=?, compte_projet=?, reference_client=?, client=?, guichet=?, contact_moa_moeg=?, annee=?, s3_folder=? WHERE numero_affaire=?`,
      [
        body.libelle,
        body.etat,
        body.referent,
        body.porteur,
        Array.isArray(body.typeDemande) ? body.typeDemande.join(', ') : body.typeDemande,
        body.portefeuille,
        body.priorite || '',
        body.date_demande_client || null,
        body.date_rea_souhaitee || null,
        body.compteProjet,
        body.reference_client || '',
        body.client,
        body.guichet,
        body.contact,
        body.annee,
        `affaires/${body.numero_affaire}/`,
        body.numero_affaire
      ]
    );
    await connection.end();
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
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'DevMySQL2024!',
      database: 'gestion_affaires',
    });
    await connection.execute('DELETE FROM affaires WHERE numero_affaire=?', [numero_affaire]);
    await connection.end();
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
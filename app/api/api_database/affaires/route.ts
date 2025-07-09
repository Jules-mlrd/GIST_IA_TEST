import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

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
    // Insertion
    const [result] = await connection.execute(
      `INSERT INTO affaires (numero_affaire, titre, etat, referent, porteur, type_demande, portefeuille_projet, priorite, date_demande_client, date_rea_souhaitee, compte_projet, reference_client, client, guichet, contact_moa_moeg)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      ]
    );
    await connection.end();
    return NextResponse.json({ success: true, numero_affaire });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
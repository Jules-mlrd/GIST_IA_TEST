import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function POST(req: NextRequest) {
  try {
    const filters = await req.json();
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'DevMySQL2024!',
      database: 'gestion_affaires',
    });

    let query = `SELECT numero_affaire, titre, etat, referent, porteur, type_demande, portefeuille_projet, priorite, date_demande_client, date_rea_souhaitee, compte_projet, reference_client FROM affaires`;
    const where = [];
    const params = [];
    if (filters.libelle && filters.libelle !== "") {
      where.push('(numero_affaire LIKE ? OR titre LIKE ?)');
      params.push(`%${filters.libelle}%`, `%${filters.libelle}%`);
    }
    if (filters.etat && filters.etat !== "") {
      where.push('LOWER(etat) = LOWER(?)');
      params.push(filters.etat);
    }
    if (filters.referent && filters.referent !== "") {
      where.push('referent = ?');
      params.push(filters.referent);
    }
    if (filters.guichet && filters.guichet !== "") {
      where.push('guichet = ?');
      params.push(filters.guichet);
    }
    if (filters.portefeuille && filters.portefeuille !== "") {
      where.push('portefeuille_projet = ?');
      params.push(filters.portefeuille);
    }
    if (filters.client && filters.client !== "") {
      where.push('client = ?');
      params.push(filters.client);
    }
    if (filters.contact && filters.contact !== "") {
      where.push('contact = ?');
      params.push(filters.contact);
    }
    if (filters.porteur && filters.porteur !== "") {
      where.push('porteur = ?');
      params.push(filters.porteur);
    }
    if (filters.typeDemande && Array.isArray(filters.typeDemande) && filters.typeDemande.length > 0) {
      where.push(`type_demande IN (${filters.typeDemande.map(() => '?').join(',')})`);
      params.push(...filters.typeDemande);
    }
    if (filters.annee && filters.annee !== "") {
      where.push('YEAR(date_demande_client) = ?');
      params.push(filters.annee);
    }
    if (filters.rechCommentaire && filters.rechCommentaire !== "") {
      where.push('commentaire LIKE ?');
      params.push(`%${filters.rechCommentaire}%`);
    }
    if (filters.rechAbrev && filters.rechAbrev !== "") {
      where.push('reference_client LIKE ?');
      params.push(`%${filters.rechAbrev}%`);
    }
    if (filters.sites && filters.sites !== "") {
      where.push('sites LIKE ?');
      params.push(`%${filters.sites}%`);
    }
    if (filters.affaireNonAffectee) {
      where.push('(affecte IS NULL OR affecte = 0)');
    }
    if (filters.portefeuilleVide) {
      where.push('(portefeuille_projet IS NULL OR portefeuille_projet = "")');
    }
    if (filters.affaireSansDevis) {
      where.push('(devis IS NULL OR devis = "")');
    }
    if (filters.femEsti) {
      where.push('fem_esti = 1');
    }
    if (filters.sansSitesAffectes) {
      where.push('(sites IS NULL OR sites = "")');
    }
    if (filters.compteProjet && filters.compteProjet !== "") {
      where.push('compte_projet LIKE ?');
      params.push(`%${filters.compteProjet}%`);
    }
    if (where.length > 0) {
      query += ' WHERE ' + where.join(' AND ');
    }
    query += ' LIMIT 100';
    console.log('Requête SQL générée:', query);
    console.log('Paramètres SQL:', params);

    const [rows] = await connection.execute(query, params);
    await connection.end();
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
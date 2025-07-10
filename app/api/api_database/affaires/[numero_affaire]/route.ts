import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function GET(req: NextRequest, { params }: { params: { numero_affaire: string } }) {
  let connection;
  try {
    const { numero_affaire } = params;
    if (!numero_affaire) {
      return NextResponse.json({ success: false, error: 'numero_affaire manquant dans l’URL.' }, { status: 400 });
    }
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'DevMySQL2024!',
      database: 'gestion_affaires',
    });
    const [rows] = await connection.execute('SELECT * FROM affaires WHERE numero_affaire = ?', [numero_affaire]);
    await connection.end();
    const affaires = Array.isArray(rows) ? (rows as any[]) : [];
    if (affaires.length === 0) {
      return NextResponse.json({ success: false, error: 'Aucune affaire trouvée pour ce numéro.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, affaire: affaires[0] });
  } catch (error: any) {
    if (connection) await connection.end();
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
} 
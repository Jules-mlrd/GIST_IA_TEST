import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function GET(req: NextRequest) {
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'DevMySQL2024!',
      database: 'gestion_affaires',
    });
    const [rows] = await connection.execute('SELECT DISTINCT portefeuille_projet FROM affaires WHERE portefeuille_projet IS NOT NULL AND portefeuille_projet != "" ORDER BY portefeuille_projet ASC');
    await connection.end();
    const portefeuilles = (rows as any[]).map(r => r.portefeuille_projet);
    return NextResponse.json({ success: true, portefeuilles });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
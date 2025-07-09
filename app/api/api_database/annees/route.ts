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
    const [rows] = await connection.execute('SELECT DISTINCT YEAR(date_demande_client) as annee FROM affaires WHERE date_demande_client IS NOT NULL ORDER BY annee ASC');
    await connection.end();
    const annees = (rows as any[]).map(r => r.annee?.toString()).filter(Boolean);
    return NextResponse.json({ success: true, annees });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
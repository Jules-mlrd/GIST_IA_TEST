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
    const [rows] = await connection.execute('SELECT DISTINCT etat FROM affaires WHERE etat IS NOT NULL AND etat != "" ORDER BY etat ASC');
    await connection.end();
    const etats = (rows as any[]).map(r => r.etat);
    return NextResponse.json({ success: true, etats });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
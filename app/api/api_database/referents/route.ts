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
    const [rows] = await connection.execute('SELECT DISTINCT referent FROM affaires WHERE referent IS NOT NULL AND referent != "" ORDER BY referent ASC');
    await connection.end();
    const referents = (rows as any[]).map(r => r.referent);
    return NextResponse.json({ success: true, referents });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
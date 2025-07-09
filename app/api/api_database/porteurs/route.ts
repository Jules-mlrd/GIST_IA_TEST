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
    const [rows] = await connection.execute('SELECT DISTINCT porteur FROM affaires WHERE porteur IS NOT NULL AND porteur != "" ORDER BY porteur ASC');
    await connection.end();
    const porteurs = (rows as any[]).map(r => r.porteur);
    return NextResponse.json({ success: true, porteurs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
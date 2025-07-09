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
    const [rows] = await connection.execute('SELECT DISTINCT type_demande FROM affaires WHERE type_demande IS NOT NULL AND type_demande != "" ORDER BY type_demande ASC');
    await connection.end();
    const types = (rows as any[]).map(r => r.type_demande);
    return NextResponse.json({ success: true, types });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
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
    const [rows] = await connection.execute('SELECT DISTINCT client FROM affaires WHERE client IS NOT NULL AND client != "" ORDER BY client ASC');
    await connection.end();
    const clients = (rows as any[]).map(r => r.client);
    return NextResponse.json({ success: true, clients });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
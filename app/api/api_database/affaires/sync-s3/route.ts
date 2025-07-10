import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import s3 from '@/lib/s3Client';

const BUCKET_NAME = 'gism-documents';

export async function GET(req: NextRequest) {
  let connection;
  const report: any[] = [];
  try {
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'DevMySQL2024!',
      database: 'gestion_affaires',
    });
    const [rows] = await connection.execute('SELECT * FROM affaires');
    const affaires = Array.isArray(rows) ? (rows as any[]) : [];
    for (const affaire of affaires) {
      const numero_affaire = affaire.numero_affaire;
      if (!numero_affaire) {
        report.push({ numero_affaire: null, error: 'numero_affaire manquant' });
        continue;
      }
      const s3Prefix = `affaires/${numero_affaire}/`;
      const s3FolderUrl = `https://s3.console.aws.amazon.com/s3/buckets/${BUCKET_NAME}?prefix=${s3Prefix}`;
      let createdFolder = false;
      try {
        // Vérifie si le dossier existe (au moins un objet sous ce préfixe)
        const list = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: s3Prefix, MaxKeys: 1 }));
        if (!list.Contents || list.Contents.length === 0) {
          await s3.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: s3Prefix, Body: '' }));
          createdFolder = true;
        }
        // Mets à jour s3_folder si absent ou incorrect
        if (!affaire.s3_folder || affaire.s3_folder !== s3FolderUrl) {
          await connection.execute('UPDATE affaires SET s3_folder=? WHERE numero_affaire=?', [s3FolderUrl, numero_affaire]);
        }
        report.push({ numero_affaire, s3_folder: s3FolderUrl, created: createdFolder });
      } catch (err: any) {
        report.push({ numero_affaire, error: err.message || err.toString() });
      }
    }
    await connection.end();
    return NextResponse.json({ success: true, total: affaires.length, report });
  } catch (error: any) {
    if (connection) await connection.end();
    return NextResponse.json({ success: false, error: error.message });
  }
} 
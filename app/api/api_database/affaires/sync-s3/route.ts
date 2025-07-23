import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';
import { PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import s3 from '@/lib/s3Client';

const BUCKET_NAME = 'gism-documents';
const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const report: any[] = [];
  try {
    const affaires = await prisma.affaires.findMany();
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
        const list = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: s3Prefix, MaxKeys: 1 }));
        if (!list.Contents || list.Contents.length === 0) {
          await s3.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: s3Prefix, Body: '' }));
          createdFolder = true;
        }
        if (!affaire.s3_folder || affaire.s3_folder !== s3FolderUrl) {
          await prisma.affaires.update({ where: { id: affaire.id }, data: { s3_folder: s3FolderUrl } });
        }
        report.push({ numero_affaire, s3_folder: s3FolderUrl, created: createdFolder });
      } catch (err: any) {
        report.push({ numero_affaire, error: err.message || err.toString() });
      }
    }
    return NextResponse.json({ success: true, total: affaires.length, report });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
} 
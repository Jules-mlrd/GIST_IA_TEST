import { NextRequest, NextResponse } from 'next/server';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import s3 from '@/lib/s3Client';

const BUCKET_NAME = 'gism-documents';

export async function GET(req: NextRequest, { params }: { params: { numero_affaire: string } }) {
  try {
    const { numero_affaire } = params;
    if (!numero_affaire) {
      return NextResponse.json({ success: false, error: 'numero_affaire manquant dans l’URL.' }, { status: 400 });
    }
    const s3Prefix = `affaires/${numero_affaire}/`;
    const list = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: s3Prefix }));
    const files = (list.Contents || [])
      .filter(obj => obj.Key && obj.Key !== s3Prefix) // exclure le dossier lui-même
      .map(obj => ({
        key: obj.Key!,
        url: `https://${BUCKET_NAME}.s3.amazonaws.com/${obj.Key}`,
        size: obj.Size,
        lastModified: obj.LastModified
      }));
    return NextResponse.json({ success: true, files, debug: (list.Contents || []).map(obj => obj.Key) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
} 
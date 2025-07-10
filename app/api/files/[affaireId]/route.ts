import { NextRequest, NextResponse } from 'next/server';
import s3 from '@/lib/s3Client';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';

export async function GET(req: NextRequest, context: { params: { affaireId: string } }) {
  const affaireId = context.params.affaireId;
  const bucket = process.env.AWS_BUCKET_NAME || '';
  if (!bucket) return NextResponse.json({ error: 'AWS_BUCKET_NAME manquant' }, { status: 500 });
  try {
    const prefix = `affaires/${affaireId}/`;
    const data = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
    const files = (data.Contents || [])
      .filter(f => f.Key && f.Key !== prefix)
      .map(f => ({
        key: f.Key!,
        name: f.Key!.split('/').pop()!,
        type: f.Key!.split('.').pop()!,
        size: f.Size,
        lastModified: f.LastModified,
        downloadUrl: `/api/download/affaires/${affaireId}/${encodeURIComponent(f.Key!.split('/').pop()!)}`
      }));
    return NextResponse.json({ affaireId, files });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
} 
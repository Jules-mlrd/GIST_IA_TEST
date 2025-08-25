import { NextRequest } from 'next/server';
import s3 from '@/lib/s3Client';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export async function GET(req: NextRequest, { params }: { params: Promise<{ affaireId: string, fileKey: string }> }) {
  const { affaireId, fileKey } = await params;
  const bucket = process.env.AWS_BUCKET_NAME || '';
  if (!bucket) return new Response('AWS_BUCKET_NAME manquant', { status: 500 });
  try {
    const key = `affaires/${affaireId}/${fileKey}`;
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const data = await s3.send(command);
    if (!data.Body) throw new Error('Fichier non trouvé');
    const filename = encodeURIComponent(fileKey);
    return new Response(data.Body as any, {
      status: 200,
      headers: {
        'Content-Type': data.ContentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    return new Response(e.message, { status: 404 });
  }
} 
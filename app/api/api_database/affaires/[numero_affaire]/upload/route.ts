import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import s3 from '@/lib/s3Client';

export async function POST(req: NextRequest, { params }: { params: { numero_affaire: string } }) {
  try {
    const { numero_affaire } = params;
    if (!numero_affaire) {
      return NextResponse.json({ success: false, error: 'numero_affaire manquant dans l’URL.' }, { status: 400 });
    }
    // Parse le form-data
    const formData = await req.formData();
    const files = formData.getAll('file');
    if (!files || files.length === 0) {
      return NextResponse.json({ success: false, error: 'Aucun fichier reçu.' }, { status: 400 });
    }
    const uploaded: string[] = [];
    for (const file of files) {
      if (typeof file === 'object' && 'arrayBuffer' in file && file.name) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const s3Key = `affaires/${numero_affaire}/${file.name}`;
        await s3.send(new PutObjectCommand({
          Bucket: 'gism-documents',
          Key: s3Key,
          Body: buffer,
          ContentType: file.type || undefined,
        }));
        uploaded.push(file.name);
      }
    }
    return NextResponse.json({ success: true, uploaded });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Erreur inconnue' }, { status: 500 });
  }
} 
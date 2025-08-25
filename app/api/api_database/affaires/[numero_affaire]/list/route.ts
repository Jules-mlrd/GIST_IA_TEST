import { NextRequest, NextResponse } from 'next/server';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import s3 from '@/lib/s3Client';

export async function GET(req: NextRequest, context: { params: { numero_affaire: string } }) {
  try {
    const numero_affaire = context.params.numero_affaire;
    if (!numero_affaire) {
      return NextResponse.json({ success: false, error: 'numero_affaire manquant dans l\'URL.' }, { status: 400 });
    }
    const bucket = process.env.AWS_BUCKET_NAME || '';
    if (!bucket) return NextResponse.json({ success: false, error: 'AWS_BUCKET_NAME manquant' }, { status: 500 });
    
    const s3Prefix = `affaires/${numero_affaire}/`;
    console.log('API list - Numero affaire:', numero_affaire);
    console.log('API list - Prefix:', s3Prefix);
    console.log('API list - Bucket:', bucket);
    
    const list = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: s3Prefix }));
    console.log('API list - Données brutes S3:', list.Contents?.map(obj => obj.Key));
    
    const files = (list.Contents || [])
      .filter(obj => obj.Key && obj.Key !== s3Prefix) // exclure le dossier lui-même
      .map(obj => ({
        key: obj.Key!,
        url: `https://${bucket}.s3.amazonaws.com/${obj.Key}`,
        size: obj.Size,
        lastModified: obj.LastModified
      }));
    
    console.log('API list - Fichiers filtrés:', files.map(f => f.key));
    return NextResponse.json({ success: true, files, debug: (list.Contents || []).map(obj => obj.Key) });
  } catch (error: any) {
    console.error('API list - Erreur:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
} 
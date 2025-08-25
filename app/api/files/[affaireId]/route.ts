import { NextRequest, NextResponse } from 'next/server';
import s3 from '@/lib/s3Client';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';

export async function GET(req: NextRequest, context: { params: Promise<{ affaireId: string }> }) {
  const { affaireId } = await context.params;
  const bucket = process.env.AWS_BUCKET_NAME || '';
  if (!bucket) return NextResponse.json({ error: 'AWS_BUCKET_NAME manquant' }, { status: 500 });
  try {
    const prefix = `affaires/${affaireId}/`;
    console.log('API files - AffaireId:', affaireId);
    console.log('API files - Prefix:', prefix);
    console.log('API files - Bucket:', bucket);
    
    const data = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
    console.log('API files - Données brutes S3:', data.Contents?.map(f => f.Key));
    
    const files = (data.Contents || [])
      .filter(f => {
        // Filtrer les fichiers qui appartiennent vraiment à cette affaire
        if (!f.Key) return false;
        
        // Exclure le dossier lui-même
        if (f.Key === prefix) return false;
        
        // Exclure les sous-dossiers (qui se terminent par /)
        if (f.Key.endsWith('/')) return false;
        
        // Vérifier que le fichier est bien dans le dossier de l'affaire
        const keyParts = f.Key.split('/');
        if (keyParts.length < 3) return false; // doit avoir au moins: affaires/[numero]/[fichier]
        if (keyParts[0] !== 'affaires') return false;
        if (keyParts[1] !== affaireId) return false;
        
        return true;
      })
      .map(f => {
        const fileName = f.Key!.split('/').pop()!;
        const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
        
        return {
          key: f.Key!,
          name: fileName,
          type: fileExtension,
          size: f.Size || 0,
          lastModified: f.LastModified?.toISOString() || new Date().toISOString(),
          downloadUrl: `/api/download/affaires/${affaireId}/${encodeURIComponent(fileName)}`
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)); // Trier par nom de fichier
    
    console.log('API files - Fichiers filtrés:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));
    return NextResponse.json({ affaireId, files });
  } catch (e: any) {
    console.error('API files - Erreur:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
} 
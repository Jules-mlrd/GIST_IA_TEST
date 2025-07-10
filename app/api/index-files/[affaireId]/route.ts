import { NextRequest, NextResponse } from 'next/server';
import { fetchPdfTextFromS3 } from '@/lib/readPdf';
import { fetchTxtContentFromS3 } from '@/lib/readTxt';
import s3 from '@/lib/s3Client';
import redis from '@/lib/redisClient';

async function extractDocxTextFromS3(bucket: string, key: string): Promise<string> {
  // TODO: Utiliser une lib type mammoth pour extraire le texte du buffer
  return '[Extraction DOCX non implémentée]';
}

async function getEmbeddingOpenAI(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });
  if (!response.ok) throw new Error('Erreur OpenAI embedding');
  const data = await response.json();
  return data.data[0].embedding;
}

export async function POST(req: NextRequest, context: { params: { affaireId: string } }) {
  const { affaireId } = context.params;
  const bucket = process.env.AWS_BUCKET_NAME || '';
  if (!bucket) return NextResponse.json({ error: 'AWS_BUCKET_NAME manquant' }, { status: 500 });
  try {
    const { files } = await req.json(); // files: string[]
    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'Aucun fichier à indexer.' }, { status: 400 });
    }
    const results: any[] = [];
    for (const fileKey of files) {
      let text = '';
      let fileType = fileKey.split('.').pop()?.toLowerCase();
      try {
        if (fileType === 'pdf') {
          text = await fetchPdfTextFromS3(bucket, fileKey);
        } else if (fileType === 'txt') {
          text = await fetchTxtContentFromS3(bucket, fileKey);
        } else if (fileType === 'docx') {
          text = await extractDocxTextFromS3(bucket, fileKey);
        } else {
          throw new Error('Type de fichier non supporté.');
        }
        // Découpage en chunks si besoin (ici, chunk unique)
        const embedding = await getEmbeddingOpenAI(text.slice(0, 2000));
        // Stockage Redis : clé affaireId:fileKey
        await redis.set(`affaire:${affaireId}:file:${fileKey}`, JSON.stringify({ text, embedding }));
        results.push({ fileKey, status: 'success' });
      } catch (e: any) {
        results.push({ fileKey, status: 'error', error: e.message });
      }
    }
    return NextResponse.json({ affaireId, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
} 
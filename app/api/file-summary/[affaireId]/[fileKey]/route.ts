import { NextRequest, NextResponse } from 'next/server';
import { fetchPdfTextFromS3 } from '@/lib/readPdf';
import { fetchTxtContentFromS3 } from '@/lib/readTxt';
import s3 from '@/lib/s3Client';
import { GetObjectCommand } from '@aws-sdk/client-s3';

async function extractDocxTextFromS3(bucket: string, key: string): Promise<string> {
  // TODO: Utiliser une lib type mammoth ou docx pour extraire le texte du buffer
  // Pour l'instant, retourne un message d'erreur
  return '[Extraction DOCX non implémentée]';
}

async function summarizeWithOpenAI(text: string): Promise<string> {
  const prompt = `Voici le contenu d'un fichier. Résume de façon synthétique et structurée les points importants, objectifs, risques, et informations clés pour un chef de projet.\n\nCONTENU:\n${text}`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Tu es un assistant qui résume des documents projet SNCF.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 400,
    }),
  });
  if (!response.ok) throw new Error('Erreur OpenAI');
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ affaireId: string, fileKey: string }> }) {
  const { affaireId, fileKey } = await params;
  const bucket = process.env.AWS_BUCKET_NAME || '';
  if (!bucket) return NextResponse.json({ error: 'AWS_BUCKET_NAME manquant' }, { status: 500 });
  try {
    const key = `affaires/${affaireId}/${fileKey}`;
    let text = '';
    let fileType = fileKey.split('.').pop()?.toLowerCase();
    if (fileType === 'pdf') {
      text = await fetchPdfTextFromS3(bucket, key);
    } else if (fileType === 'txt') {
      text = await fetchTxtContentFromS3(bucket, key);
    } else if (fileType === 'docx') {
      text = await extractDocxTextFromS3(bucket, key);
    } else {
      return NextResponse.json({ error: 'Type de fichier non supporté.' }, { status: 400 });
    }
    const summary = await summarizeWithOpenAI(text);
    return NextResponse.json({ affaireId, fileKey: key, summary, fileType });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
} 
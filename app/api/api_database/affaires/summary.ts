import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';
import { listPdfFilesInS3, fetchPdfTextFromS3 } from '@/lib/readPdf';
import { listTxtFilesInS3, fetchTxtContentFromS3 } from '@/lib/readTxt';

const BUCKET_NAME = 'gism-documents';
const SUPPORTED_EXTENSIONS = ['.pdf', '.txt'];
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const prisma = new PrismaClient();

async function askOpenAISummary(text: string) {
  const messages = [
    { role: 'user', content: text }
  ];
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.2,
      max_tokens: 1000
    })
  });
  if (!response.ok) {
    let errorBody = '';
    try { errorBody = await response.text(); } catch {}
    throw new Error(`Erreur OpenAI (status: ${response.status}) - ${errorBody}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
}

export async function GET(req: NextRequest) {
  try {
    const numero_affaire = req.nextUrl.searchParams.get('numero_affaire');
    if (!numero_affaire) return NextResponse.json({ error: "Paramètre numero_affaire requis" }, { status: 400 });

    // 1. Lecture de la base
    const affaire = await prisma.affaires.findFirst({ where: { numero_affaire } });
    if (!affaire) {
      return NextResponse.json({ error: "Affaire non trouvée" }, { status: 404 });
    }

    let allTexts: string[] = [];

    let baseText = `Titre: ${affaire.titre || ''}\nDescription: ${affaire.description_technique || ''}\nEtat: ${affaire.etat || ''}\nClient: ${affaire.client || ''}\nPorteur: ${affaire.porteur || ''}\nType de demande: ${affaire.type_demande || ''}\n...`;
    const fullText = [baseText, ...allTexts].join('\n\n');

    const summary = await askOpenAISummary(fullText.slice(0, 9000)); // Limite la taille

    return NextResponse.json({ summary, affaire });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || e.toString() }, { status: 500 });
  }
} 
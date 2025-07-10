import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { listPdfFilesInS3, fetchPdfTextFromS3 } from '@/lib/readPdf';
import { listTxtFilesInS3, fetchTxtContentFromS3 } from '@/lib/readTxt';
import type { RowDataPacket } from 'mysql2';

const BUCKET_NAME = 'gism-documents';
const SUPPORTED_EXTENSIONS = ['.pdf', '.txt'];
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

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
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'DevMySQL2024!',
      database: 'gestion_affaires',
    });
    const [rows] = await connection.execute('SELECT * FROM affaires WHERE numero_affaire = ?', [numero_affaire]);
    await connection.end();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Affaire non trouvée" }, { status: 404 });
    }
    const affaire = rows[0] as any;

    // 2. Récupération des documents S3 associés (optionnel)
    // (Suppression du traitement S3 : on ne traite que la base de données)
    let allTexts: string[] = [];

    // 3. Concatène les champs pertinents de la base
    let baseText = `Titre: ${affaire.titre || ''}\nDescription: ${affaire.description || ''}\nEtat: ${affaire.etat || ''}\nClient: ${affaire.client || ''}\nPorteur: ${affaire.porteur || ''}\nType de demande: ${affaire.type_demande || ''}\n...`;
    // Ajoute d'autres champs si besoin
    const fullText = [baseText, ...allTexts].join('\n\n');

    // 4. Appel IA pour résumé
    const summary = await askOpenAISummary(fullText.slice(0, 9000)); // Limite la taille

    return NextResponse.json({ summary, affaire });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || e.toString() }, { status: 500 });
  }
} 
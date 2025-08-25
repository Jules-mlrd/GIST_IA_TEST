import { NextResponse } from 'next/server';
import { listPdfFilesInS3, fetchPdfTextFromS3 } from '@/lib/readPdf';
import { listTxtFilesInS3, fetchTxtContentFromS3 } from '@/lib/readTxt';
import { extractRisksWithLLM } from '@/lib/utils';

const BUCKET_NAME = 'gism-documents';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url!);
    const affaire = url.searchParams.get('affaire');
    if (!affaire) {
      return NextResponse.json({ risks: [], error: 'Paramètre affaire requis.' }, { status: 400 });
    }
    // Lister les fichiers PDF et TXT de l'affaire
    const [pdfFiles, txtFiles] = await Promise.all([
      listPdfFilesInS3(BUCKET_NAME, `affaires/${affaire}/`),
      listTxtFilesInS3(BUCKET_NAME, `affaires/${affaire}/`),
    ]);
    const allFiles = [
      ...pdfFiles.map((key) => ({ key, type: 'pdf' })),
      ...txtFiles.map((key) => ({ key, type: 'txt' })),
    ];
    // Extraire le texte de chaque fichier
    const texts = await Promise.all(
      allFiles.map(async ({ key, type }) => {
        try {
          if (type === 'pdf') {
            return await fetchPdfTextFromS3(BUCKET_NAME, key);
          } else {
            return await fetchTxtContentFromS3(BUCKET_NAME, key);
          }
        } catch (e) {
          return '';
        }
      })
    );
    // Appeler OpenAI pour extraire les risques de chaque texte
    const risksArrays = await Promise.all(
      texts.map(async (text) => {
        if (!text || text.length < 30) return [];
        try {
          return await extractRisksWithLLM(text);
        } catch {
          return [];
        }
      })
    );
    // Ajouter le numéro d'affaire à chaque risque
    const risks = risksArrays.flat().map((risk: any) => ({ ...risk, numero_affaire: affaire }));
    return NextResponse.json({ risks });
  } catch (error) {
    return NextResponse.json({ risks: [], error: 'Erreur serveur lors de la récupération des risques.' }, { status: 500 });
  }
}

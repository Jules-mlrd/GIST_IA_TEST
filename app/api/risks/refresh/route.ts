import { NextResponse } from 'next/server';
import { listPdfFilesInS3, fetchPdfTextFromS3 } from '@/lib/readPdf';
import { listTxtFilesInS3, fetchTxtContentFromS3 } from '@/lib/readTxt';
import { extractRisksWithLLM } from '@/lib/utils';
import fs from 'fs';
import path from 'path';

const BUCKET_NAME = 'gism-documents';
const EXTRACTED_RISKS_FILE = path.join(process.cwd(), 'extracted-risks.json');

function writeExtractedRisks(risks: any[]) {
  fs.writeFileSync(EXTRACTED_RISKS_FILE, JSON.stringify(risks, null, 2), 'utf-8');
}

export async function POST(req: Request) {
  try {
    let affaire = null;
    try {
      const body = await req.json();
      affaire = body.affaire;
    } catch {}
    const [pdfFiles, txtFiles] = await Promise.all([
      listPdfFilesInS3(BUCKET_NAME),
      listTxtFilesInS3(BUCKET_NAME),
    ]);
    // Filtrer par affaire si précisé
    const filteredPdfFiles = affaire ? pdfFiles.filter(key => key.includes(affaire)) : pdfFiles;
    const filteredTxtFiles = affaire ? txtFiles.filter(key => key.includes(affaire)) : txtFiles;
    const allFiles = [
      ...filteredPdfFiles.map((key) => ({ key, type: 'pdf' })),
      ...filteredTxtFiles.map((key) => ({ key, type: 'txt' })),
    ];
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
    const risks = risksArrays.flat();
    writeExtractedRisks(risks);
    return NextResponse.json({ success: true, count: risks.length });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors du rafraîchissement du cache IA.' }, { status: 500 });
  }
} 
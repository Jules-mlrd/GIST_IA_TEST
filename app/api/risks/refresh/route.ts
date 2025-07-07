import { NextResponse } from 'next/server';
import { listPdfFilesInS3, fetchPdfTextFromS3 } from '@/lib/readPdf';
import { listTxtFilesInS3, fetchTxtContentFromS3, fetchHtmlTextFromS3 } from '@/lib/readTxt';
import { extractRisksWithLLM } from '@/lib/utils';
import fs from 'fs';
import path from 'path';

const BUCKET_NAME = 'gism-documents';
const EXTRACTED_RISKS_FILE = path.join(process.cwd(), 'extracted-risks.json');

function writeExtractedRisks(risks: any[]) {
  fs.writeFileSync(EXTRACTED_RISKS_FILE, JSON.stringify(risks, null, 2), 'utf-8');
}

export async function POST() {
  try {
    // Extraction IA forcée
    const [pdfFiles, txtFiles, htmlFiles] = await Promise.all([
      listPdfFilesInS3(BUCKET_NAME),
      listTxtFilesInS3(BUCKET_NAME),
      listTxtFilesInS3(BUCKET_NAME.replace(/txt$/, 'html'))
    ]);
    const allFiles = [
      ...pdfFiles.map((key) => ({ key, type: 'pdf' })),
      ...txtFiles.map((key) => ({ key, type: 'txt' })),
      ...htmlFiles.map((key) => ({ key, type: 'html' })),
    ];
    const texts = await Promise.all(
      allFiles.map(async ({ key, type }) => {
        try {
          if (type === 'pdf') {
            return await fetchPdfTextFromS3(BUCKET_NAME, key);
          } else if (type === 'txt') {
            return await fetchTxtContentFromS3(BUCKET_NAME, key);
          } else if (type === 'html') {
            return await fetchHtmlTextFromS3(BUCKET_NAME, key);
          } else {
            return '';
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
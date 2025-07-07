import { NextResponse } from 'next/server';
import { listPdfFilesInS3, fetchPdfTextFromS3 } from '@/lib/readPdf';
import { listTxtFilesInS3, fetchTxtContentFromS3, fetchHtmlTextFromS3 } from '@/lib/readTxt';
import { extractRisksWithLLM } from '@/lib/utils';
import fs from 'fs';
import path from 'path';

const BUCKET_NAME = 'gism-documents';
const EXTRACTED_RISKS_FILE = path.join(process.cwd(), 'extracted-risks.json');
const MANUAL_RISKS_FILE = path.join(process.cwd(), 'manual-risks.json');

function readExtractedRisks(): any[] {
  try {
    if (!fs.existsSync(EXTRACTED_RISKS_FILE)) return [];
    const data = fs.readFileSync(EXTRACTED_RISKS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeExtractedRisks(risks: any[]) {
  fs.writeFileSync(EXTRACTED_RISKS_FILE, JSON.stringify(risks, null, 2), 'utf-8');
}

function readManualRisks(): any[] {
  try {
    if (!fs.existsSync(MANUAL_RISKS_FILE)) return [];
    const data = fs.readFileSync(MANUAL_RISKS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeManualRisks(risks: any[]) {
  fs.writeFileSync(MANUAL_RISKS_FILE, JSON.stringify(risks, null, 2), 'utf-8');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.description) {
      return NextResponse.json({ error: 'Description requise.' }, { status: 400 });
    }
    const risks = readManualRisks();
    const id = Date.now() + '-' + Math.floor(Math.random() * 10000);
    const newRisk = { ...body, id };
    risks.push(newRisk);
    writeManualRisks(risks);
    return NextResponse.json({ success: true, risk: newRisk });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de l\'ajout du risque.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id, description } = await req.json();
    let risks = readManualRisks();
    const before = risks.length;
    if (id) {
      risks = risks.filter((r: any) => r.id !== id);
    } else if (description) {
      risks = risks.filter((r: any) => r.description !== description);
    }
    if (risks.length === before) {
      return NextResponse.json({ error: 'Risque non trouvé.' }, { status: 404 });
    }
    writeManualRisks(risks);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la suppression du risque.' }, { status: 500 });
  }
}

export async function POST_refresh(_: Request) {
  try {
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

export async function GET() {
  try {
    let risks = readExtractedRisks();
    const manualRisks = readManualRisks();
    const allRisks = [...manualRisks, ...risks];
    return NextResponse.json({ risks: allRisks });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de l\'extraction des risques.' }, { status: 500 });
  }
} 
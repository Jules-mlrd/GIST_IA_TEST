import { NextResponse } from 'next/server';
import { listPdfFilesInS3, fetchPdfTextFromS3 } from '@/lib/readPdf';
import { listTxtFilesInS3, fetchTxtContentFromS3, fetchHtmlTextFromS3 } from '@/lib/readTxt';
import { extractRisksWithLLM } from '@/lib/utils';
import fs from 'fs';
import path from 'path';
import redis from '@/lib/redisClient';

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
    // Suppression du cache IA et manuel
    if (fs.existsSync(EXTRACTED_RISKS_FILE)) fs.unlinkSync(EXTRACTED_RISKS_FILE);
    if (fs.existsSync(MANUAL_RISKS_FILE)) fs.unlinkSync(MANUAL_RISKS_FILE);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la suppression du cache.' }, { status: 500 });
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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url || '', 'http://localhost');
    const affaire = url.searchParams.get('affaire');
    const refresh = url.searchParams.get('refresh') === '1';

    let risks = readExtractedRisks();
    const manualRisks = readManualRisks();
    const allRisks = [...manualRisks, ...risks];
    // Filtrage par affaire si paramètre présent
    let filteredRisks = allRisks;
    if (affaire) {
      const cacheKey = `affaire:${affaire}:risks`;
      let cacheTimestamp = Date.now();
      if (!refresh) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            cacheTimestamp = parsed.cacheTimestamp || cacheTimestamp;
            const etag = `"${cacheTimestamp}"`;
            if (req.headers.get('if-none-match') === etag) {
              return new Response(null, { status: 304 });
            }
            const response = NextResponse.json(parsed);
            response.headers.set('ETag', etag);
            return response;
          } catch {}
        }
      }
      filteredRisks = allRisks.filter(r =>
        (r.affaire && r.affaire === affaire) ||
        (r.key && r.key.includes(affaire))
      );
      const cacheTimestampNew = Date.now();
      const result = { risks: filteredRisks, cacheTimestamp: cacheTimestampNew };
      await redis.set(cacheKey, JSON.stringify(result), { ex: 3600 });
      const etag = `"${cacheTimestampNew}"`;
      if (req.headers.get('if-none-match') === etag) {
        return new Response(null, { status: 304 });
      }
      const response = NextResponse.json(result);
      response.headers.set('ETag', etag);
      return response;
    }
    return NextResponse.json({ risks: filteredRisks });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de l\'extraction des risques.' }, { status: 500 });
  }
}

// Endpoint de diagnostic : liste les fichiers S3 pour une affaire
export async function GET_s3_files(req: Request) {
  try {
    const url = new URL(req.url || '', 'http://localhost');
    const affaire = url.searchParams.get('affaire');
    if (!affaire) {
      return NextResponse.json({ error: 'Paramètre affaire requis.' }, { status: 400 });
    }
    const pdfFiles = await listPdfFilesInS3(BUCKET_NAME);
    const txtFiles = await listTxtFilesInS3(BUCKET_NAME);
    const matchingPdf = pdfFiles.filter(key => key.includes(affaire));
    const matchingTxt = txtFiles.filter(key => key.includes(affaire));
    return NextResponse.json({ pdf: matchingPdf, txt: matchingTxt });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la lecture des fichiers S3.' }, { status: 500 });
  }
} 
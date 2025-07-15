import { NextRequest, NextResponse } from 'next/server';
import { listPdfFilesInS3, fetchPdfTextFromS3 } from '@/lib/readPdf';
import { listTxtFilesInS3, fetchTxtContentFromS3 } from '@/lib/readTxt';
import { extractTimelineWithLLM, extractTasksWithLLM, extractGanttWithLLM } from '@/app/api/ai-analyze/route';
import { readJsonFromS3, writeJsonToS3 } from '@/lib/s3Client';

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'gism-documents';
const CACHE_PREFIX = 'timeline-cache/affaire-';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

async function readTimelineCacheS3(numero_affaire: string): Promise<any | null> {
  const key = `${CACHE_PREFIX}${numero_affaire}.json`;
  const data = await readJsonFromS3(BUCKET_NAME, key);
  if (data && data.cachedAt) {
    const age = Date.now() - new Date(data.cachedAt).getTime();
    if (age < CACHE_TTL_MS) {
      return data;
    }
  }
  return null;
}

async function writeTimelineCacheS3(numero_affaire: string, timeline: any[], tasks: any[], gantt: any[]) {
  const key = `${CACHE_PREFIX}${numero_affaire}.json`;
  await writeJsonToS3(BUCKET_NAME, key, { timeline, tasks, gantt, cachedAt: new Date().toISOString() });
}

export async function GET(req: NextRequest, { params }: { params: { numero_affaire: string } }) {
  const { numero_affaire } = params;
  const url = new URL(req.url || '', 'http://localhost');
  const refresh = url.searchParams.get('refresh') === '1';
  let timeline = null, tasks = null, gantt = null;
  if (!refresh) {
    const cached = await readTimelineCacheS3(numero_affaire);
    if (cached) {
      timeline = cached.timeline;
      tasks = cached.tasks;
      gantt = cached.gantt;
    }
  }
  if (!timeline || !tasks || !gantt) {
    // Récupérer tous les fichiers S3 de l'affaire
    const prefix = `affaires/${numero_affaire}/`;
    const [pdfFiles, txtFiles] = await Promise.all([
      listPdfFilesInS3(BUCKET_NAME, prefix),
      listTxtFilesInS3(BUCKET_NAME, prefix),
    ]);
    if (pdfFiles.length === 0 && txtFiles.length === 0) {
      return NextResponse.json({ error: `Aucun fichier PDF ou TXT trouvé dans le dossier S3 ${prefix}` }, { status: 404 });
    }
    const allFiles = [
      ...pdfFiles.map((key) => ({ key, type: 'pdf' })),
      ...txtFiles.map((key) => ({ key, type: 'txt' })),
    ];
    const texts = await Promise.all(
      allFiles.map(async ({ key, type }) => {
        try {
          if (type === 'pdf') {
            return await fetchPdfTextFromS3(BUCKET_NAME, key);
          } else if (type === 'txt') {
            return await fetchTxtContentFromS3(BUCKET_NAME, key);
          } else {
            return '';
          }
        } catch (e) {
          return '';
        }
      })
    );
    const globalText = texts.filter(Boolean).join('\n\n');
    timeline = await extractTimelineWithLLM(globalText);
    tasks = await extractTasksWithLLM(globalText);
    gantt = await extractGanttWithLLM(globalText);
    await writeTimelineCacheS3(numero_affaire, timeline, tasks, gantt);
  }
  return NextResponse.json({ timeline, tasks, gantt });
} 
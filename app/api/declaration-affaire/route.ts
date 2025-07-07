import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import s3 from "@/lib/s3Client";
import pdfParse from "pdf-parse";
import OpenAI from "openai";
import path from "path";
import { readPdfFromS3Robust } from "@/lib/readPdfRobust";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

async function getS3FileBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME!,
    Key: key,
  });
  const response = await s3.send(command);
  const stream = response.Body;
  if (!stream) throw new Error("S3 stream non disponible pour " + key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function readTxtFromS3(key: string) {
  const buffer = await getS3FileBuffer(key);
  return buffer.toString("utf-8");
}

async function readPdfFromS3(key: string) {
  return await readPdfFromS3Robust(key);
}

async function readDocxFromS3(key: string) {
  return '[Lecture DOCX non implémentée dans cette démo]';
}

const FILE_HANDLERS: Record<string, (key: string) => Promise<string | Buffer>> = {
  pdf: readPdfFromS3,
  txt: readTxtFromS3,
  docx: readDocxFromS3,
  doc: readDocxFromS3,
};

function truncateText(text: string, max: number = 8000) {
  return text.length > max ? text.slice(0, max) : text;
}

const PROJECT_PROMPT_MULTI = (text: string, docCount: number) => `Tu es un assistant expert en gestion de projets SNCF. Tu vas analyser le contenu de ${docCount} documents de projet (PDF, TXT, etc.), parfois redondants ou contradictoires :

"""
${text}
"""

Consignes :
- Croise, fusionne et synthétise toutes les informations pertinentes pour pré-remplir une fiche projet SNCF.
- Si des informations sont contradictoires, choisis la plus fiable ou la plus fréquente, et signale les incohérences dans le champ "comments".
- Si une information est absente, remplis avec une valeur par défaut ou une estimation.
- Utilise les noms, dates, montants, emails, etc. trouvés dans le texte.
- Structure attendue :
{
  "projectName": string,
  "projectId": string,
  "startDate": string,
  "endDate": string,
  "summary": string,
  "objectives": string[],
  "projectManager": { "name": string, "contact": string },
  "teamMembers": [{ "name": string, "role": string, "contact": string }],
  "partners": string[],
  "budget": {
    "total": string,
    "used": string,
    "remaining": string,
    "mainExpenses": [{ "label": string, "amount": string }],
    "alerts": string[]
  },
  "milestones": [{ "date": string, "label": string }],
  "progress": string,
  "scheduleAlerts": string[],
  "risks": [{ "description": string, "level": string, "owner": string }],
  "deliverables": [{ "label": string, "status": string }],
  "contacts": [{ "name": string, "role": string, "contact": string }],
  "legal": string,
  "comments": string
}

Réponds uniquement en JSON strictement valide, sans texte autour.`;

const RESUME_PROMPT = (text: string) => `Voici un document de projet SNCF :
"""
${text}
"""
Fais un résumé détaillé et exhaustif de toutes les informations importantes (noms, dates, montants, objectifs, risques, contacts, etc.) en 2000 caractères maximum. N'invente rien.`;

async function askOpenAI(prompt: string, maxRetries = 2): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let lastError: any = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      });
      return completion.choices[0].message?.content || "";
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = 500 * Math.pow(2, attempt);
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }
  throw lastError;
}

export async function POST(req: Request) {
  let keys: string[] = [];
  let currentFields: any = undefined;
  try {
    const body = await req.json();
    keys = body.keys;
    currentFields = body.currentFields;
  } catch {
    return NextResponse.json({ error: "Clés de fichiers manquantes" }, { status: 400 });
  }
  if (!keys || keys.length === 0) {
    return NextResponse.json({ error: "Aucune clé de fichier reçue" }, { status: 400 });
  }

  let globalText = "";
  let docCount = keys.length;
  let docSummaries: string[] = [];
  let totalLength = 0;
  let summarizationUsed = false;

  for (const key of keys) {
    const ext = key.split(".").pop()?.toLowerCase() || "";
    if (FILE_HANDLERS[ext]) {
      const result = await FILE_HANDLERS[ext](key);
      const text = typeof result === "string" ? result : "";
      totalLength += text.length;
      docSummaries.push(text);
    } else {
      docSummaries.push(`[Type de fichier non supporté: ${key}]`);
    }
  }

  if (docSummaries.map(t => t.length).reduce((a, b) => a + b, 0) > 12000) {
    summarizationUsed = true;
    const summarizedDocs: string[] = [];
    for (const docText of docSummaries) {
      const prompt = RESUME_PROMPT(truncateText(docText, 8000));
      try {
        const summary = await askOpenAI(prompt);
        summarizedDocs.push(summary);
      } catch (e) {
        summarizedDocs.push("[Erreur lors du résumé IA]");
      }
    }
    globalText = summarizedDocs.join("\n\n");
  } else {
    globalText = docSummaries.join("\n\n");
  }

  if (globalText.trim().length === 0) {
    return NextResponse.json({ error: "Aucun texte exploitable extrait des fichiers." }, { status: 400 });
  }

  const fusionPrompt = (text: string, docCount: number, currentFields: any) => `Tu es un assistant expert en gestion de projets SNCF. Tu vas analyser le contenu de ${docCount} nouveaux documents de projet (PDF, TXT, etc.) :
"""
${text}
"""

Voici les informations déjà extraites et présentes dans le formulaire utilisateur (JSON) :
${JSON.stringify(currentFields, null, 2)}

Consignes :
- Complète et enrichis ce JSON avec toutes les nouvelles informations trouvées dans les documents.
- Ne remplace une information existante que si tu trouves une version plus fiable ou plus précise dans les nouveaux documents.
- Ajoute toute information manquante ou nouvelle.
- Si des informations sont contradictoires, choisis la plus fiable ou la plus fréquente, et signale les incohérences dans le champ "comments".
- Structure attendue : même format JSON que ci-dessus.
- Réponds uniquement en JSON strictement valide, sans texte autour.`;

  try {
    let prompt;
    if (currentFields) {
      prompt = fusionPrompt(truncateText(globalText, 12000), docCount, currentFields);
    } else {
      prompt = PROJECT_PROMPT_MULTI(truncateText(globalText, 12000), docCount);
    }
    console.log('[DECLARATION AFFAIRE][PROMPT]', prompt);
    const aiResponse = await askOpenAI(prompt);
    console.log('[DECLARATION AFFAIRE][RAW IA RESPONSE]', aiResponse);
    const jsonStart = aiResponse.indexOf("{");
    const jsonEnd = aiResponse.lastIndexOf("}") + 1;
    const jsonString = aiResponse.slice(jsonStart, jsonEnd);
    const data = JSON.parse(jsonString);
    if (summarizationUsed || currentFields) {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (summarizationUsed) {
        headers["x-summarization-notice"] = "Certains fichiers volumineux ont été résumés automatiquement avant analyse IA pour respecter la limite de taille. Les informations principales ont été conservées.";
      }
      if (currentFields) {
        headers["x-fusion-notice"] = "Les nouvelles informations extraites ont été fusionnées avec les données déjà présentes dans le formulaire. Seules les informations plus fiables ou nouvelles ont été ajoutées ou remplacées.";
      }
      return new NextResponse(JSON.stringify(data), {
        status: 200,
        headers
      });
    }
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: "Erreur IA ou parsing: " + e?.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let y = 800;
  const left = 50;
  const lineHeight = 20;

  function drawText(label: string, value: string) {
    page.drawText(label + ':', { x: left, y, size: 12, font, color: rgb(0,0,0) });
    y -= 16;
    page.drawText(value || '-', { x: left + 120, y, size: 12, font, color: rgb(0.2,0.2,0.2) });
    y -= lineHeight;
  }

  page.drawText('Déclaration d\'affaire SNCF', { x: left, y, size: 18, font, color: rgb(0,0,0.7) });
  y -= 2*lineHeight;

  drawText('Nom du projet', data.projectName);
  drawText('ID projet', data.projectId);
  drawText('Résumé', data.summary);
  drawText('Objectifs', (data.objectives||[]).join(', '));
  drawText('Chef de projet', data.projectManager?.name || '');
  drawText('Contact chef de projet', data.projectManager?.contact || '');
  drawText('Budget total', data.budget?.total || '');
  drawText('Budget utilisé', data.budget?.used || '');
  drawText('Budget restant', data.budget?.remaining || '');
  drawText('Début', data.startDate);
  drawText('Fin', data.endDate);

  // Milestones
  if (data.milestones?.length) {
    page.drawText('Jalons :', { x: left, y, size: 13, font, color: rgb(0,0,0) });
    y -= lineHeight;
    for (const m of data.milestones) {
      drawText('  - ' + (m.label || ''), m.date || '');
    }
  }

  if (data.risks?.length) {
    page.drawText('Risques :', { x: left, y, size: 13, font, color: rgb(0.5,0,0) });
    y -= lineHeight;
    for (const r of data.risks) {
      drawText('  - ' + (r.description || ''), (r.level ? 'Niveau: ' + r.level : ''));
    }
  }

  if (data.deliverables?.length) {
    page.drawText('Livrables :', { x: left, y, size: 13, font, color: rgb(0,0.3,0) });
    y -= lineHeight;
    for (const d of data.deliverables) {
      drawText('  - ' + (d.label || ''), d.status || '');
    }
  }

  if (data.contacts?.length) {
    page.drawText('Contacts :', { x: left, y, size: 13, font, color: rgb(0,0,0.3) });
    y -= lineHeight;
    for (const c of data.contacts) {
      drawText('  - ' + (c.name || ''), (c.role ? 'Rôle: ' + c.role : '')); y -= 2;
      drawText('    Contact', c.contact || '');
    }
  }

  drawText('Mentions légales', data.legal);
  drawText('Commentaires', data.comments);

  const pdfBytes = await pdfDoc.save();
  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="declaration-affaire.pdf"',
    },
  });
} 
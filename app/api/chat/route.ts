import { fetchPdfTextFromS3, listPdfFilesInS3 } from '@/lib/readPdf';
import { listTxtFilesInS3, fetchTxtContentFromS3 } from '@/lib/readTxt';
import { parseStructuredFile } from '@/lib/readCsv';
import fs from 'fs';
import path from 'path';
import { NextResponse } from "next/server";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import s3 from "@/lib/s3Client";

// --- Persistent Memory Layer with File Context Tracking ---
type FileReference = { name: string; type: string; key: string; lastReferenced: number };
type MemoryContext = {
  lastDoc?: string;
  lastTxt?: string;
  lastCode?: string;
  lastVariable?: string;
  userGoals?: string[];
  recentOutputs?: string[];
  history: { role: "user" | "assistant", content: string }[];
  currentFile?: FileReference; // Track the last active file
  referencedFiles?: FileReference[]; // Track all referenced files in session
};
const memoryStore: Map<string, MemoryContext> = new Map();
/**
 * Get or initialize memory for a session/user.
 */
function getMemory(userId: string): MemoryContext {
  if (!memoryStore.has(userId)) memoryStore.set(userId, { history: [], referencedFiles: [] });
  return memoryStore.get(userId)!;
}
/**
 * Update memory for a session/user.
 */
function updateMemory(userId: string, update: Partial<MemoryContext>) {
  const ctx = getMemory(userId);
  memoryStore.set(userId, { ...ctx, ...update });
}
/**
 * Add or update a referenced file in memory.
 */
function addOrUpdateReferencedFile(userId: string, file: FileReference) {
  const ctx = getMemory(userId);
  const now = Date.now();
  file.lastReferenced = now;
  let files = ctx.referencedFiles || [];
  const idx = files.findIndex(f => f.name === file.name && f.type === file.type && f.key === file.key);
  if (idx >= 0) {
    files[idx].lastReferenced = now;
  } else {
    files.push(file);
  }
  updateMemory(userId, { referencedFiles: files, currentFile: file });
}
/**
 * Clear memory for a session/user.
 */
function clearMemory(userId: string) {
  memoryStore.delete(userId);
}

/**
 * Attempts to resolve implicit references in the user's message.
 * If the message contains pronouns or vague references, substitute with the last referenced document.
 * Now supports multiple files and context-aware resolution.
 */
function resolveImplicitReferences(userId: string, message: string): string {
  const ctx = getMemory(userId);
  // Simple French/English pronoun patterns
  const pronounPatterns = [
    { pattern: /\b(ce document|le document|celui-ci|celui|le fichier|ce fichier|that file|this file|the previous file|the above document)\b/gi, ref: ctx.currentFile?.name },
    { pattern: /\b(cette fonction|that function|the previous function)\b/gi, ref: ctx.lastCode },
    { pattern: /\b(cette variable|that variable|the previous variable)\b/gi, ref: ctx.lastVariable },
  ];
  let resolved = message;
  for (const { pattern, ref } of pronounPatterns) {
    if (pattern.test(message) && ref) {
      resolved = resolved.replace(pattern, `"${ref}"`);
    }
  }
  return resolved;
}

/**
 * Checks if the message is a memory reset command.
 */
function isMemoryResetCommand(message: string) {
  return /^(reset|clear) (memory|context|state)$/i.test(message.trim());
}

// Detects if the user is asking for a summary, explanation, or key points
function detectSummaryIntent(message: string) {
  const keywords = [
    "résume", "résumé", "résumer", "summary", "summarize", "synthèse",
    "expliquer", "explanation", "explain", "points clés", "key points", "principaux points"
  ];
  const lowerMsg = message.toLowerCase();
  return keywords.some((kw) => lowerMsg.includes(kw));
}

// System prompt to guide the assistant's behavior
const SYSTEM_PROMPT = `
Vous êtes un assistant IA expert en compréhension et synthèse de documents. 
Votre objectif est d'aider l'utilisateur à comprendre, résumer ou extraire les points clés d'un document, 
en répondant toujours de façon claire, concise et pédagogique, sans jamais restituer le document complet.
Si l'utilisateur demande un résumé, une explication ou les points clés, fournissez une synthèse structurée et accessible.
`;

// Simple in-memory context tracker (for demo; use a persistent/session store in production)
const conversationContext: Record<string, { lastDoc?: string, lastTxt?: string }> = {};

export async function POST(req: Request) {
  try {
    const { message, userId = "default" } = await req.json();
    // Memory reset support
    if (isMemoryResetCommand(message)) {
      clearMemory(userId);
      return NextResponse.json({ reply: "La mémoire de la session a été réinitialisée." });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ reply: 'Clé API manquante.' }, { status: 500 });
    }

    const bucketName = process.env.AWS_BUCKET_NAME || '';
    if (!bucketName) {
      throw new Error('AWS_BUCKET_NAME is not defined in environment variables.');
    }

    // --- Conversation History Management ---
    const memory = getMemory(userId);
    // Resolve implicit references
    const resolvedMessage = resolveImplicitReferences(userId, message);
    // Handle file-related queries
    const pdfKeys = await listPdfFilesInS3(bucketName);
    const txtKeys = await listTxtFilesInS3(bucketName);
    // Add CSV/XLSX/XLS support
    const csvKeys = (await s3.send(new ListObjectsV2Command({ Bucket: bucketName }))).Contents
      ?.filter(f => /\.(csv|xlsx|xls)$/i.test(f.Key || ''))
      .map(f => f.Key!) || [];
    let foundFile: { name: string; type: string; key: string } | null = null;
    for (const key of pdfKeys) {
      const docName = key.split('/').pop()?.replace('.pdf', '') || '';
      if (normalize(resolvedMessage).includes(normalize(docName))) {
        foundFile = { name: docName, type: 'pdf', key };
        break;
      }
    }
    for (const key of txtKeys) {
      const txtName = key.split('/').pop()?.replace('.txt', '') || '';
      if (normalize(resolvedMessage).includes(normalize(txtName))) {
        foundFile = { name: txtName, type: 'txt', key };
        break;
      }
    }
    // CSV/XLSX/XLS detection
    for (const key of csvKeys) {
      const csvName = key.split('/').pop()?.replace(/\.(csv|xlsx|xls)$/i, '') || '';
      if (normalize(resolvedMessage).includes(normalize(csvName))) {
        foundFile = { name: csvName, type: 'csv', key };
        break;
      }
    }
    if (foundFile) {
      addOrUpdateReferencedFile(userId, { ...foundFile, lastReferenced: Date.now() });
    } else if (/\b(ce fichier|this file|that file|le fichier)\b/gi.test(message)) {
      const ambiguityMessage = handleFileAmbiguity(userId, message);
      if (ambiguityMessage) {
        return NextResponse.json({ reply: ambiguityMessage });
      }
    }
    // Add the resolved message to the conversation history
    memory.history.push({ role: "user", content: resolvedMessage });
    // --- Ambiguity Handling ---
    const pronounPattern = /\b(ce document|le document|celui-ci|celui|le fichier|ce fichier|that file|this file|the previous file|the above document)\b/gi;
    if (
      pronounPattern.test(message) &&
      !foundFile &&
      !(memory.lastDoc || memory.lastTxt)
    ) {
      memory.history.push({
        role: "assistant",
        content: "À quel document ou fichier faites-vous référence ? Veuillez préciser le nom ou le contexte.",
      });
      return NextResponse.json({
        reply: "À quel document ou fichier faites-vous référence ? Veuillez préciser le nom ou le contexte.",
      });
    }
    // --- Compose OpenAI messages with full history ---
    const openaiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...memory.history.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    ];
    if (foundFile) {
      let text = '';
      if (foundFile.type === 'pdf') {
        text = await fetchPdfTextFromS3(bucketName, foundFile.key);
      } else if (foundFile.type === 'txt') {
        text = await fetchTxtContentFromS3(bucketName, foundFile.key);
      } else if (foundFile.type === 'csv') {
        // Fetch file buffer from S3 (robust stream-to-buffer handling)
        const fileBuffer = await (async function fetchFileBufferFromS3(bucket: string, key: string): Promise<Buffer> {
          const command = new GetObjectCommand({ Bucket: bucket, Key: key });
          const response = await s3.send(command);
          // AWS SDK v3: response.Body can be a Readable stream (Node.js)
          const stream = response.Body as NodeJS.ReadableStream | undefined;
          if (!stream) throw new Error('Le flux du fichier S3 est indéfini.');
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          return Buffer.concat(chunks);
        })(bucketName, foundFile.key);
        const parsed = await parseStructuredFile(fileBuffer, foundFile.key);
        if (parsed.error) {
          return NextResponse.json({ reply: parsed.error });
        }
        text = parsed.summary + "\n\nExtrait des données :\n" + JSON.stringify(parsed.data.slice(0, 5), null, 2);
      }
      const userIntent = detectSummaryIntent(resolvedMessage)
        ? resolvedMessage
        : `Merci de résumer, expliquer ou extraire les points clés du document suivant en fonction de la question de l'utilisateur :\n"${resolvedMessage}"`;
      openaiMessages.push({
        role: "user",
        content: `\n${userIntent}\n\nContenu du document :\n${text}\n\nRépondez uniquement à la demande de l'utilisateur en extrayant la section ou l'information pertinente, \nen synthétisant et expliquant si nécessaire, sans inclure le document complet. Soyez concis, structuré et précis.`.trim(),
      });
    }
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: openaiMessages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });
    if (!response.ok) {
      console.error('OpenAI API error:', await response.text());
      return NextResponse.json({ reply: 'Erreur OpenAI.' }, { status: 500 });
    }
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Aucune réponse générée.";
    memory.history.push({ role: "assistant", content: reply });
    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Erreur serveur:', error);
    return NextResponse.json({ reply: 'Erreur serveur inattendue.' }, { status: 500 });
  }
}

function normalize(str: string) {
  return str.toLowerCase().replace(/[-_.]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Add missing function declarations for `updateCurrentFile` and `handleFileAmbiguity`
function updateCurrentFile(userId: string, file: { name: string; type: string; key: string }) {
  addOrUpdateReferencedFile(userId, { ...file, lastReferenced: Date.now() });
}

function handleFileAmbiguity(userId: string, message: string): string | null {
  const ctx = getMemory(userId);
  const files = ctx.referencedFiles || [];
  if (files.length === 0) {
    return "Aucun fichier n'a été référencé dans cette session. Veuillez préciser le nom du fichier.";
  }
  if (files.length === 1) {
    updateMemory(userId, { currentFile: files[0] });
    return null;
  }
  // Try to infer from context (e.g., file type in message)
  const isTxt = /txt|texte|text/i.test(message);
  const isPdf = /pdf/i.test(message);
  const filtered = files.filter(f => (isTxt && f.type === 'txt') || (isPdf && f.type === 'pdf'));
  if (filtered.length === 1) {
    updateMemory(userId, { currentFile: filtered[0] });
    return null;
  }
  // If still ambiguous, ask user
  return `Plusieurs fichiers ont été référencés : ${files.map(f => f.name).join(', ')}. Lequel souhaitez-vous utiliser ?`;
}

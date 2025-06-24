import { fetchPdfTextFromS3, listPdfFilesInS3 } from '@/lib/readPdf';
import { listTxtFilesInS3, fetchTxtContentFromS3 } from '@/lib/readTxt';
import { parseStructuredFile } from '@/lib/readCsv';
import fs from 'fs';
import path from 'path';
import { NextResponse } from "next/server";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import s3 from "@/lib/s3Client";
import redis from '@/lib/redisClient';
import { getEmbeddingOpenAI } from '@/lib/utils';

// --- Persistent Memory Layer with File Context Tracking ---
type FileReference = { name: string; type: string; key: string; lastReferenced: number };
type MessageHistory = { role: "user" | "assistant", content: string, embedding?: number[], timestamp?: number };
type MemoryContext = {
  lastDoc?: string;
  lastTxt?: string;
  lastCode?: string;
  lastVariable?: string;
  userGoals?: string[];
  keyEntities?: { type: string; value: string }[]; // entités clés
  recentOutputs?: string[];
  history: MessageHistory[];
  currentFile?: (FileReference & { activeCount?: number }); // Track the last active file
  referencedFiles?: FileReference[]; // Track all referenced files in session
  contextSummary?: string; // Résumé synthétique de la session
  multiFilesActive?: (FileReference & { activeCount?: number })[]; // fichiers actifs pour le multi-fichier
};

/**
 * Get or initialize memory for a session/user (Redis version).
 */
async function getMemory(userId: string): Promise<MemoryContext> {
  const data = await redis.get(`memory:${userId}`);
  if (data) return JSON.parse(data);
  const initial: MemoryContext = { history: [], referencedFiles: [] };
  await redis.set(`memory:${userId}`, JSON.stringify(initial));
  return initial;
}
/**
 * Update memory for a session/user (Redis version).
 */
async function updateMemory(userId: string, update: Partial<MemoryContext>) {
  const ctx = await getMemory(userId);
  const newCtx = { ...ctx, ...update };
  await redis.set(`memory:${userId}`, JSON.stringify(newCtx));
}
/**
 * Add or update a referenced file in memory (Redis version).
 */
async function addOrUpdateReferencedFile(userId: string, file: FileReference) {
  const ctx = await getMemory(userId);
  const now = Date.now();
  file.lastReferenced = now;
  let files = ctx.referencedFiles || [];
  const idx = files.findIndex(f => f.name === file.name && f.type === file.type && f.key === file.key);
  if (idx >= 0) {
    files[idx].lastReferenced = now;
  } else {
    files.push(file);
  }
  await updateMemory(userId, { referencedFiles: files, currentFile: file });
}
/**
 * Clear memory for a session/user (Redis version).
 */
async function clearMemory(userId: string) {
  await redis.del(`memory:${userId}`);
}

/**
 * Attempts to resolve implicit references in the user's message.
 * If the message contains pronouns or vague references, substitute with the last referenced document.
 * Now supports multiple files and context-aware resolution.
 */
async function resolveImplicitReferences(userId: string, message: string): Promise<string> {
  const ctx = await getMemory(userId);
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

// Fonction pour résumer l'historique si trop long
async function summarizeHistory(history: { role: string, content: string }[]): Promise<string> {
  // On ne résume que si >10 échanges
  if (history.length <= 10) return "";
  const prompt = `Voici l'historique d'une conversation entre un utilisateur et un assistant IA. Résume de façon synthétique et structurée les points importants, objectifs, fichiers mentionnés, et questions clés.\n\nHISTORIQUE:\n${history.map(m => m.role+": "+m.content).join("\n")}`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Tu es un assistant IA qui résume des conversations pour garder le contexte.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 400,
    }),
  });
  if (!response.ok) return "";
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// Extraction d'intention et d'entités clés
async function extractIntentAndEntities(message: string): Promise<{ intent?: string, entities?: { type: string, value: string }[] }> {
  const prompt = `Voici un message utilisateur dans un contexte de gestion de projet SNCF.\nMessage : "${message}"\n\n1. Déduis l'intention principale de l'utilisateur (ex: résumer, comparer, expliquer, demander un risque, etc).\n2. Liste les entités clés mentionnées (ex: nom de projet, nom de fichier, date, personne, etc) sous forme de tableau JSON [{type, value}].\n\nRéponds uniquement avec un objet JSON de la forme : { "intent": ..., "entities": [...] }`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Tu es un assistant qui extrait l\'intention et les entités clés d\'un message utilisateur.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 300,
    }),
  });
  if (!response.ok) return {};
  const data = await response.json();
  try {
    const json = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    return json;
  } catch {
    return {};
  }
}

// Détection d'intention ambiguë ou relance floue
function isAmbiguousIntent(message: string, intent?: string) {
  // Mots ou intentions typiques de relance floue
  const ambiguousPatterns = [
    /\b(suivant|autre|encore|pareil|idem|le même|la même|refais|refaire|continue|continuer|prochain|next|again|same)\b/i,
    /^\s*(et|aussi|ok|d'accord|continue|encore)\s*$/i,
  ];
  if (intent && /suivant|autre|encore|pareil|idem|prochain|next|again|same/i.test(intent)) return true;
  return ambiguousPatterns.some((p) => p.test(message));
}

// Génération de suggestions proactives
async function generateSuggestions(context: string, lastReply: string, userMessage: string): Promise<string[]> {
  const prompt = `Tu es un assistant IA SNCF. Propose 2 suggestions d'actions ou de questions pertinentes à proposer à l'utilisateur, en fonction du contexte suivant et de la dernière réponse de l'IA. Les suggestions doivent être courtes, utiles, et adaptées à la gestion de projet/document. Réponds uniquement avec un tableau JSON de suggestions (ex: ["Suggestion 1", "Suggestion 2"]).\n\nCONTEXTE:\n${context}\n\nDernière réponse IA:\n${lastReply}\n\nDernier message utilisateur:\n${userMessage}`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Tu es un assistant qui génère des suggestions proactives pour aider l\'utilisateur.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 200,
    }),
  });
  if (!response.ok) return [];
  const data = await response.json();
  try {
    const suggestions = JSON.parse(data.choices?.[0]?.message?.content || '[]');
    if (Array.isArray(suggestions)) return suggestions;
    return [];
  } catch {
    return [];
  }
}

// Fonction utilitaire pour la similarité cosinus
function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Recherche sémantique sur tous les fichiers (démo, à la volée)
async function semanticSearchInFiles(question: string, pdfKeys: string[], txtKeys: string[], bucketName: string): Promise<{ file: string, passage: string, score: number }[]> {
  const passages: { file: string, passage: string }[] = [];
  // TXT
  for (const key of txtKeys) {
    const text = await fetchTxtContentFromS3(bucketName, key);
    const paras = text.split(/\n\n+/).filter(p => p.trim().length > 30);
    for (const para of paras) {
      passages.push({ file: key, passage: para });
    }
  }
  // PDF
  for (const key of pdfKeys) {
    const text = await fetchPdfTextFromS3(bucketName, key);
    const paras = text.split(/\n\n+/).filter(p => p.trim().length > 30);
    for (const para of paras) {
      passages.push({ file: key, passage: para });
    }
  }
  // Embedding de la question
  const qEmbed = await getEmbeddingOpenAI(question);
  // Embedding des passages
  const scored = [];
  for (const p of passages) {
    try {
      const pEmbed = await getEmbeddingOpenAI(p.passage);
      const score = cosineSimilarity(qEmbed, pEmbed);
      scored.push({ ...p, score });
    } catch {}
  }
  // Trie et retourne les 2 meilleurs
  return scored.sort((a, b) => b.score - a.score).slice(0, 2);
}

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
    const memory = await getMemory(userId);
    // Resolve implicit references
    const resolvedMessage = await resolveImplicitReferences(userId, message);
    // Handle file-related queries
    const pdfKeys = await listPdfFilesInS3(bucketName);
    const txtKeys = await listTxtFilesInS3(bucketName);
    // Add CSV/XLSX/XLS support
    const csvKeys = (await s3.send(new ListObjectsV2Command({ Bucket: bucketName }))).Contents
      ?.filter(f => /\.(csv|xlsx|xls)$/i.test(f.Key || ''))
      .map(f => f.Key!) || [];
    // --- Système avancé de détection de contexte fichier avec fenêtre active ---
    let shouldUseCurrentFile = false;
    const intentEntities = await extractIntentAndEntities(message);
    // 1. Si une entité de type 'file'/'document' est détectée dans le message, on l'utilise (et on met à jour currentFile)
    if (intentEntities.entities?.some(e => e.type === 'file' || e.type === 'document')) {
      shouldUseCurrentFile = true;
    }
    // 2. Si le message contient un pronom ou une relance floue ET qu'il y a un currentFile
    const pronounPattern = /\b(ce document|le document|celui-ci|celui|le fichier|ce fichier|that file|this file|the previous file|the above document)\b/gi;
    if (pronounPattern.test(message) && memory.currentFile) {
      shouldUseCurrentFile = true;
    }
    // 3. Si l'intention est de type 'continuer', 'détail', 'expliquer', etc. ET qu'il y a un currentFile
    if (intentEntities.intent && /(continuer|détail|expliquer|suite|refaire|pareil|idem|encore|prochain|next|again|same)/i.test(intentEntities.intent) && memory.currentFile) {
      shouldUseCurrentFile = true;
    }
    // --- Détection du fichier mentionné explicitement dans le message ---
    let foundFile: (FileReference & { activeCount?: number }) | null = null;
    for (const key of pdfKeys) {
      const docName = key.split('/').pop()?.replace('.pdf', '') || '';
      if (normalize(resolvedMessage).includes(normalize(docName))) {
        foundFile = { name: docName, type: 'pdf', key, activeCount: 2, lastReferenced: Date.now() };
        break;
      }
    }
    for (const key of txtKeys) {
      const txtName = key.split('/').pop()?.replace('.txt', '') || '';
      if (normalize(resolvedMessage).includes(normalize(txtName))) {
        foundFile = { name: txtName, type: 'txt', key, activeCount: 2, lastReferenced: Date.now() };
        break;
      }
    }
    for (const key of csvKeys) {
      const csvName = key.split('/').pop()?.replace(/\.(csv|xlsx|xls)$/i, '') || '';
      if (normalize(resolvedMessage).includes(normalize(csvName))) {
        foundFile = { name: csvName, type: 'csv', key, activeCount: 2, lastReferenced: Date.now() };
        break;
      }
    }
    // Si foundFile détecté, on met à jour la mémoire avec activeCount=2
    if (foundFile) {
      await addOrUpdateReferencedFile(userId, { ...foundFile, lastReferenced: Date.now() });
      await updateMemory(userId, { currentFile: foundFile });
      shouldUseCurrentFile = true;
    }
    // Si pas de fichier trouvé explicitement mais shouldUseCurrentFile vrai et currentFile existe, on l'utilise et on décrémente activeCount
    if (!foundFile && shouldUseCurrentFile && memory.currentFile) {
      foundFile = memory.currentFile;
      foundFile.activeCount = (foundFile.activeCount || 2) - 1;
      if (foundFile.activeCount <= 0) {
        await updateMemory(userId, { currentFile: undefined });
      } else {
        await updateMemory(userId, { currentFile: foundFile });
      }
    }
    // Si l'utilisateur change de sujet (entité non fichier/document ou intention générale), on désactive currentFile
    if (
      !shouldUseCurrentFile &&
      memory.currentFile &&
      (
        (intentEntities.entities && intentEntities.entities.length > 0 && !intentEntities.entities.some(e => e.type === 'file' || e.type === 'document')) ||
        (intentEntities.intent && /(salutation|remerciement|général|general|autre sujet|projet|contact|timeline|risque|risk|merci|bonjour|hello|hi|salut)/i.test(intentEntities.intent))
      )
    ) {
      await updateMemory(userId, { currentFile: undefined });
    }
    // Add the resolved message to the conversation history
    memory.history.push({ role: "user", content: resolvedMessage });
    // --- Ambiguity Handling ---
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
    // --- Résumé automatique du contexte si historique long ---
    if (memory.history.length > 10) {
      const summary = await summarizeHistory(memory.history);
      if (summary) await updateMemory(userId, { contextSummary: summary });
    }
    // --- Extraction d'intention et d'entités clés ---
    if (intentEntities.intent) {
      const userGoals = Array.from(new Set([...(memory.userGoals || []), intentEntities.intent]));
      await updateMemory(userId, { userGoals });
      memory.userGoals = userGoals;
    }
    if (intentEntities.entities) {
      // Ensure all are strings before deduplication
      const allEntities = [...(memory.keyEntities || []).map(e => JSON.stringify(e)), ...intentEntities.entities.map(e => JSON.stringify(e))];
      const keyEntities = Array.from(new Set(allEntities)).map(e => JSON.parse(e));
      await updateMemory(userId, { keyEntities });
      memory.keyEntities = keyEntities;
    }
    // --- Clarification automatique en cas d'ambiguïté ---
    if (isAmbiguousIntent(message, intentEntities.intent)) {
      return NextResponse.json({ reply: "Votre question semble ambiguë ou fait référence à un élément précédent. Pouvez-vous préciser de quel document, projet ou sujet il s'agit ?" });
    }
    // --- Multi-fichier : détection et chargement ---
    let multiFiles: (FileReference & { activeCount?: number })[] = [];
    if (intentEntities.entities) {
      for (const ent of intentEntities.entities) {
        if (ent.type === 'file' || ent.type === 'document') {
          // Cherche le fichier dans les PDF, TXT, CSV
          let file: (FileReference & { activeCount?: number }) | null = null;
          for (const key of pdfKeys) {
            const docName = key.split('/').pop()?.replace('.pdf', '') || '';
            if (normalize(ent.value).includes(normalize(docName))) {
              file = { name: docName, type: 'pdf', key, activeCount: 2, lastReferenced: Date.now() };
              break;
            }
          }
          for (const key of txtKeys) {
            const txtName = key.split('/').pop()?.replace('.txt', '') || '';
            if (normalize(ent.value).includes(normalize(txtName))) {
              file = { name: txtName, type: 'txt', key, activeCount: 2, lastReferenced: Date.now() };
              break;
            }
          }
          for (const key of csvKeys) {
            const csvName = key.split('/').pop()?.replace(/\.(csv|xlsx|xls)$/i, '') || '';
            if (normalize(ent.value).includes(normalize(csvName))) {
              file = { name: csvName, type: 'csv', key, activeCount: 2, lastReferenced: Date.now() };
              break;
            }
          }
          if (file) multiFiles.push(file);
        }
      }
    }
    // Si plusieurs fichiers détectés, on les mémorise pour les relances floues
    if (multiFiles.length > 1) {
      await updateMemory(userId, { multiFilesActive: multiFiles });
      memory.multiFilesActive = multiFiles;
    }
    // --- Recherche sémantique avancée (démo) ---
    const semanticResults = await semanticSearchInFiles(message, pdfKeys, txtKeys, bucketName);
    let semanticContext = '';
    if (semanticResults.length > 0) {
      semanticContext = semanticResults.map(r => `Extrait pertinent du fichier ${r.file} :\n${r.passage}`).join('\n\n');
    }
    // --- Compose OpenAI messages with full history ---
    const openaiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      semanticContext ? { role: "system", content: `Contexte extrait par recherche sémantique :\n${semanticContext}` } : undefined,
      memory.contextSummary ? { role: "system", content: `Résumé du contexte : ${memory.contextSummary}` } : undefined,
      memory.userGoals && memory.userGoals.length ? { role: "system", content: `Objectifs utilisateur détectés : ${memory.userGoals.join(", ")}` } : undefined,
      memory.keyEntities && memory.keyEntities.length ? { role: "system", content: `Entités clés détectées : ${memory.keyEntities.map(e => `${e.type}: ${e.value}`).join("; ")}` } : undefined,
      ...memory.history.slice(-10).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    ].filter(Boolean);
    // --- Injection multi-fichier dans le prompt ---
    if (multiFiles.length > 1) {
      let docsText = '';
      for (const file of multiFiles) {
        let text = '';
        if (file.type === 'pdf') {
          text = await fetchPdfTextFromS3(bucketName, file.key);
        } else if (file.type === 'txt') {
          text = await fetchTxtContentFromS3(bucketName, file.key);
        } else if (file.type === 'csv') {
          const fileBuffer = await (async function fetchFileBufferFromS3(bucket: string, key: string): Promise<Buffer> {
            const command = new GetObjectCommand({ Bucket: bucket, Key: key });
            const response = await s3.send(command);
            const stream = response.Body as NodeJS.ReadableStream | undefined;
            if (!stream) throw new Error('Le flux du fichier S3 est indéfini.');
            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            return Buffer.concat(chunks);
          })(bucketName, file.key);
          const parsed = await parseStructuredFile(fileBuffer, file.key);
          if (parsed.error) {
            docsText += `\n[${file.name}] : Erreur de lecture du fichier.`;
            continue;
          }
          text = parsed.summary + "\n\nExtrait des données :\n" + JSON.stringify(parsed.data.slice(0, 5), null, 2);
        }
        docsText += `\n\nDocument : ${file.name} (${file.type})\n${text}`;
      }
      openaiMessages.push({
        role: "user",
        content: `Voici plusieurs documents à comparer ou analyser :${docsText}\n\nQuestion utilisateur : ${resolvedMessage}\n\nRéponds en comparant, synthétisant ou extrayant les informations demandées à partir de ces documents. Sois structuré, précis et synthétique.`
      });
    } else if (foundFile && shouldUseCurrentFile) {
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

    // --- Génération des suggestions proactives ---
    let contextForSuggestions = '';
    if (memory.contextSummary) contextForSuggestions += `Résumé du contexte : ${memory.contextSummary}\n`;
    if (memory.userGoals && memory.userGoals.length) contextForSuggestions += `Objectifs utilisateur : ${memory.userGoals.join(", ")}\n`;
    if (memory.keyEntities && memory.keyEntities.length) contextForSuggestions += `Entités clés : ${memory.keyEntities.map(e => `${e.type}: ${e.value}`).join("; ")}\n`;
    const suggestions = await generateSuggestions(contextForSuggestions, reply, message);

    // --- Calcul embedding de la question utilisateur ---
    const userEmbedding = await getEmbeddingOpenAI(message);
    // Recherche de similarité sur l'historique utilisateur
    let similarPast = null;
    if (memory.history && memory.history.length > 0) {
      let bestScore = 0;
      let bestIdx = -1;
      for (let i = 0; i < memory.history.length; i++) {
        const h = memory.history[i];
        if (h.role === 'user' && h.embedding) {
          const score = cosineSimilarity(userEmbedding, h.embedding);
          if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        }
      }
      if (bestScore > 0.90 && bestIdx !== -1) {
        // On propose la réponse associée
        // Cherche la prochaine réponse IA après la question similaire
        let answer = null;
        for (let j = bestIdx + 1; j < memory.history.length; j++) {
          if (memory.history[j].role === 'assistant') {
            answer = memory.history[j].content;
            break;
          }
        }
        similarPast = {
          date: memory.history[bestIdx].timestamp ? new Date(Number(memory.history[bestIdx].timestamp)).toLocaleString() : '',
          question: memory.history[bestIdx].content,
          answer: answer,
          score: bestScore,
        };
      }
    }
    // Ajoute le message utilisateur avec embedding à l'historique
    memory.history.push({ role: "user", content: message, embedding: userEmbedding, timestamp: Date.now() });

    return NextResponse.json({ 
      reply, 
      suggestions, 
      explicability: {
        currentFile: memory.currentFile || null,
        multiFilesActive: memory.multiFilesActive || [],
        keyEntities: memory.keyEntities || [],
        userGoals: memory.userGoals || [],
        contextSummary: memory.contextSummary || '',
      },
      similarPast
    });
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

async function handleFileAmbiguity(userId: string, message: string): Promise<string | null> {
  const ctx = await getMemory(userId);
  const files = ctx.referencedFiles || [];
  if (files.length === 0) {
    return "Aucun fichier n'a été référencé dans cette session. Veuillez préciser le nom du fichier.";
  }
  if (files.length === 1) {
    await updateMemory(userId, { currentFile: files[0] });
    return null;
  }
  // Try to infer from context (e.g., file type in message)
  const isTxt = /txt|texte|text/i.test(message);
  const isPdf = /pdf/i.test(message);
  const filtered = files.filter((f: any) => (isTxt && f.type === 'txt') || (isPdf && f.type === 'pdf'));
  if (filtered.length === 1) {
    await updateMemory(userId, { currentFile: filtered[0] });
    return null;
  }
  // If still ambiguous, ask user
  return `Plusieurs fichiers ont été référencés : ${files.map((f: any) => f.name).join(', ')}. Lequel souhaitez-vous utiliser ?`;
}

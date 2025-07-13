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

type FileReference = { name: string; type: string; key: string; lastReferenced: number };
type MessageHistory = { role: "user" | "assistant", content: string, embedding?: number[], timestamp?: number };
type MemoryContext = {
  lastDoc?: string;
  lastTxt?: string;
  lastCode?: string;
  lastVariable?: string;
  userGoals?: string[];
  keyEntities?: { type: string; value: string }[]; 
  recentOutputs?: string[];
  history: MessageHistory[];
  currentFile?: (FileReference & { activeCount?: number });
  referencedFiles?: FileReference[]; 
  contextSummary?: string; 
  multiFilesActive?: (FileReference & { activeCount?: number })[];
};


async function getMemory(userId: string): Promise<MemoryContext> {
  const data = await redis.get(`memory:${userId}`);
  if (data) return JSON.parse(data);
  const initial: MemoryContext = { history: [], referencedFiles: [] };
  await redis.set(`memory:${userId}`, JSON.stringify(initial));
  return initial;
}

async function updateMemory(userId: string, update: Partial<MemoryContext>) {
  const ctx = await getMemory(userId);
  const newCtx = { ...ctx, ...update };
  await redis.set(`memory:${userId}`, JSON.stringify(newCtx));
}

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

async function clearMemory(userId: string) {
  await redis.del(`memory:${userId}`);
}


async function resolveImplicitReferences(userId: string, message: string): Promise<string> {
  const ctx = await getMemory(userId);
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

function isMemoryResetCommand(message: string) {
  return /^(reset|clear) (memory|context|state)$/i.test(message.trim());
}

function detectSummaryIntent(message: string) {
  const keywords = [
    "résume", "résumé", "résumer", "summary", "summarize", "synthèse",
    "expliquer", "explanation", "explain", "points clés", "key points", "principaux points"
  ];
  const lowerMsg = message.toLowerCase();
  return keywords.some((kw) => lowerMsg.includes(kw));
}

const SYSTEM_PROMPT = `
Vous êtes un assistant IA expert en compréhension et synthèse de documents. 
Votre objectif est d'aider l'utilisateur à comprendre, résumer ou extraire les points clés d'un document, 
en répondant toujours de façon claire, concise et pédagogique, sans jamais restituer le document complet.
Si l'utilisateur demande un résumé, une explication ou les points clés, fournissez une synthèse structurée et accessible.
`;

const conversationContext: Record<string, { lastDoc?: string, lastTxt?: string }> = {};

async function summarizeHistory(history: { role: string, content: string }[]): Promise<string> {
  if (history.length <= 10) return "";
  const prompt = `Voici l'historique d'une conversation entre un utilisateur et un assistant IA. Résume de façon synthétique et structurée les points importants, objectifs, fichiers mentionnés, et questions clés.\n\nHISTORIQUE:\n${history.map(m => m.role+": "+m.content).join("\n")}`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
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

async function extractIntentAndEntities(message: string): Promise<{ intent?: string, entities?: { type: string, value: string }[] }> {
  const prompt = `Voici un message utilisateur dans un contexte de gestion de projet SNCF.\nMessage : "${message}"\n\n1. Déduis l'intention principale de l'utilisateur (ex: résumer, comparer, expliquer, demander un risque, etc).\n2. Liste les entités clés mentionnées (ex: nom de projet, nom de fichier, date, personne, etc) sous forme de tableau JSON [{type, value}].\n\nRéponds uniquement avec un objet JSON de la forme : { "intent": ..., "entities": [...] }`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
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

function isAmbiguousIntent(message: string, intent?: string) {
  const ambiguousPatterns = [
    /\b(suivant|autre|encore|pareil|idem|le même|la même|refais|refaire|continue|continuer|prochain|next|again|same)\b/i,
    /^\s*(et|aussi|ok|d'accord|continue|encore)\s*$/i,
  ];
  if (intent && /suivant|autre|encore|pareil|idem|prochain|next|again|same/i.test(intent)) return true;
  return ambiguousPatterns.some((p) => p.test(message));
}

async function generateSuggestions(context: string, lastReply: string, userMessage: string): Promise<string[]> {
  const prompt = `Tu es un assistant IA SNCF. Propose 2 suggestions d'actions ou de questions pertinentes à proposer à l'utilisateur, en fonction du contexte suivant et de la dernière réponse de l'IA. Les suggestions doivent être courtes, utiles, et adaptées à la gestion de projet/document. Réponds uniquement avec un tableau JSON de suggestions (ex: ["Suggestion 1", "Suggestion 2"]).\n\nCONTEXTE:\n${context}\n\nDernière réponse IA:\n${lastReply}\n\nDernier message utilisateur:\n${userMessage}`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
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

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

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

  for (const key of pdfKeys) {
    const text = await fetchPdfTextFromS3(bucketName, key);
    const paras = text.split(/\n\n+/).filter(p => p.trim().length > 30);
    for (const para of paras) {
      passages.push({ file: key, passage: para });
    }
  }
  const qEmbed = await getEmbeddingOpenAI(question);
  const scored = [];
  for (const p of passages) {
    try {
      const pEmbed = await getEmbeddingOpenAI(p.passage);
      const score = cosineSimilarity(qEmbed, pEmbed);
      scored.push({ ...p, score });
    } catch {}
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 2);
}

// Nouvelle fonction : recherche sémantique sur les fichiers indexés
async function semanticSearchInIndexedFiles(question: string, affaireId: string): Promise<{ file: string, passage: string, score: number }[]> {
  // Récupère toutes les clés indexées pour l'affaire
  const keys = await redis.keys(`affaire:${affaireId}:file:*`);
  if (!keys || keys.length === 0) return [];
  const qEmbed = await getEmbeddingOpenAI(question);
  const scored: { file: string, passage: string, score: number }[] = [];
  for (const key of keys) {
    const val = await redis.get(key);
    if (!val) continue;
    try {
      const { text, embedding } = JSON.parse(val);
      const score = cosineSimilarity(qEmbed, embedding);
      scored.push({ file: key.split(':file:')[1], passage: text.slice(0, 2000), score });
    } catch {}
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 2);
}

export async function POST(req: Request) {
  try {
    const { message, userId = "default", affaireId, readFiles = true, contextFiles } = await req.json();
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

    const memory = await getMemory(userId);
    const resolvedMessage = await resolveImplicitReferences(userId, message);
    const pdfKeys = await listPdfFilesInS3(bucketName);
    const txtKeys = await listTxtFilesInS3(bucketName);
    const csvKeys = (await s3.send(new ListObjectsV2Command({ Bucket: bucketName }))).Contents
      ?.filter(f => /\.(csv|xlsx|xls)$/i.test(f.Key || ''))
      .map(f => f.Key!) || [];
    let shouldUseCurrentFile = false;
    const intentEntities = await extractIntentAndEntities(message);
    if (intentEntities.entities?.some(e => e.type === 'file' || e.type === 'document')) {
      shouldUseCurrentFile = true;
    }
    const pronounPattern = /\b(ce document|le document|celui-ci|celui|le fichier|ce fichier|that file|this file|the previous file|the above document)\b/gi;
    if (pronounPattern.test(message) && memory.currentFile) {
      shouldUseCurrentFile = true;
    }
    if (intentEntities.intent && /(continuer|détail|expliquer|suite|refaire|pareil|idem|encore|prochain|next|again|same)/i.test(intentEntities.intent) && memory.currentFile) {
      shouldUseCurrentFile = true;
    }
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
    if (foundFile) {
      await addOrUpdateReferencedFile(userId, { ...foundFile, lastReferenced: Date.now() });
      await updateMemory(userId, { currentFile: foundFile });
      shouldUseCurrentFile = true;
    }
    if (!foundFile && shouldUseCurrentFile && memory.currentFile) {
      foundFile = memory.currentFile;
      foundFile.activeCount = (foundFile.activeCount || 2) - 1;
      if (foundFile.activeCount <= 0) {
        await updateMemory(userId, { currentFile: undefined });
      } else {
        await updateMemory(userId, { currentFile: foundFile });
      }
    }
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
    memory.history.push({ role: "user", content: resolvedMessage });
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
    if (memory.history.length > 10) {
      const summary = await summarizeHistory(memory.history);
      if (summary) await updateMemory(userId, { contextSummary: summary });
    }
    if (intentEntities.intent) {
      const userGoals = Array.from(new Set([...(memory.userGoals || []), intentEntities.intent]));
      await updateMemory(userId, { userGoals });
      memory.userGoals = userGoals;
    }
    if (intentEntities.entities) {
      const allEntities = [...(memory.keyEntities || []).map(e => JSON.stringify(e)), ...intentEntities.entities.map(e => JSON.stringify(e))];
      const keyEntities = Array.from(new Set(allEntities)).map(e => JSON.parse(e));
      await updateMemory(userId, { keyEntities });
      memory.keyEntities = keyEntities;
    }
    if (isAmbiguousIntent(message, intentEntities.intent)) {
      return NextResponse.json({ reply: "Votre question semble ambiguë ou fait référence à un élément précédent. Pouvez-vous préciser de quel document, projet ou sujet il s'agit ?" });
    }
    let multiFiles: (FileReference & { activeCount?: number })[] = [];
    if (intentEntities.entities) {
      for (const ent of intentEntities.entities) {
        if (ent.type === 'file' || ent.type === 'document') {
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
    if (multiFiles.length > 1) {
      await updateMemory(userId, { multiFilesActive: multiFiles });
      memory.multiFilesActive = multiFiles;
    }
    let semanticResults: { file: string, passage: string, score: number }[] = [];
    let semanticContext = '';
    let contextFilesText = '';
    if (Array.isArray(contextFiles) && contextFiles.length > 0) {
      // Charger uniquement les fichiers explicitement sélectionnés
      for (const fileKey of contextFiles) {
        let text = '';
        if (/\.pdf$/i.test(fileKey)) {
          text = await fetchPdfTextFromS3(bucketName, fileKey);
        } else if (/\.txt$/i.test(fileKey)) {
          text = await fetchTxtContentFromS3(bucketName, fileKey);
        }
        if (text) {
          contextFilesText += `\n\n---\nContenu du fichier ${fileKey}:\n${text}`;
        }
      }
      // Ajout : on lit aussi la base de données (recherche sémantique)
      if (affaireId) {
        semanticResults = await semanticSearchInIndexedFiles(message, affaireId);
      } else {
        semanticResults = await semanticSearchInFiles(message, pdfKeys, txtKeys, bucketName);
      }
      if (semanticResults.length > 0) {
        semanticContext = semanticResults.map(r => `Extrait pertinent du fichier ${r.file} :\n${r.passage}`).join('\n\n');
      }
    } else if (readFiles) {
      // Comportement normal : recherche sémantique
      if (affaireId) {
        semanticResults = await semanticSearchInIndexedFiles(message, affaireId);
      } else {
        semanticResults = await semanticSearchInFiles(message, pdfKeys, txtKeys, bucketName);
      }
      if (semanticResults.length > 0) {
        semanticContext = semanticResults.map(r => `Extrait pertinent du fichier ${r.file} :\n${r.passage}`).join('\n\n');
      }
    }
    // Détection d'intention : résumé ou demande sur fichier joint
    const resumeIntentRegex = /résum[ée]|synth[èe]se|extrait|points? clés?|fichier joint|document sélectionné|document joint|fichier sélectionné|ce fichier|ces fichiers|le fichier|les fichiers|document/i;
    const isResumeIntent = resumeIntentRegex.test(message);
    // Si la demande concerne un fichier joint/document sélectionné
    // Gestion des cas multiples/ambigus
    let ambiguousWarning = '';
    if (isResumeIntent && Array.isArray(contextFiles) && contextFiles.length > 1) {
      ambiguousWarning = "Plusieurs fichiers ont été sélectionnés. Propose un résumé global ou un résumé pour chaque fichier, ou demande à l'utilisateur de préciser si besoin.";
    }
    // Gestion des erreurs de lecture de fichiers
    let fileErrorWarning = '';
    if (isResumeIntent && Array.isArray(contextFiles) && contextFiles.length > 0) {
      for (const fileKey of contextFiles) {
        let text = '';
        let error = '';
        try {
          if (/\.pdf$/i.test(fileKey)) {
            text = await fetchPdfTextFromS3(bucketName, fileKey);
          } else if (/\.txt$/i.test(fileKey)) {
            text = await fetchTxtContentFromS3(bucketName, fileKey);
          }
          if (text.length > 20000) {
            error = `Le fichier ${fileKey} est trop volumineux pour être résumé en une seule fois.\n`;
            text = text.slice(0, 20000) + '\n[Texte tronqué]';
          }
        } catch (e) {
          error = `Erreur de lecture du fichier ${fileKey}.\n`;
        }
        if (error) fileErrorWarning += error;
        if (text) {
          contextFilesText += `\n\n---\nContenu du fichier ${fileKey}:\n${text}`;
        }
      }
      const explicitPrompt = `L’utilisateur a explicitement sélectionné les fichiers suivants pour cette question :\n${contextFiles.map(k => k.split('/').pop()).join(', ')}.\nUtilise uniquement leur contenu pour répondre à la demande.`;
      const openaiMessages = [
        { role: "system", content: SYSTEM_PROMPT },
        ambiguousWarning ? { role: "system", content: ambiguousWarning } : undefined,
        fileErrorWarning ? { role: "system", content: fileErrorWarning } : undefined,
        { role: "system", content: explicitPrompt },
        { role: "system", content: `Contexte extrait des fichiers sélectionnés :\n${contextFilesText}` },
        ...memory.history.slice(-10)
          .filter((m): m is { role: "user" | "assistant"; content: string } => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === 'string')
          .map(m => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
      ].filter(Boolean);
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
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
      // Suggestions proactives
      const suggestions = await generateSuggestions(
        `Fichiers utilisés : ${contextFiles.map(k => k.split('/').pop()).join(', ')}\nQuestion : ${message}`,
        reply,
        message
      );
      // Explicabilité
      const explicability = {
        files: contextFiles.map(k => k.split('/').pop()),
        prompt: openaiMessages.map(m => m.content).join('\n---\n'),
      };
      return NextResponse.json({ reply, suggestions, explicability });
    }
    // Après la gestion des fichiers sélectionnés et avant la construction du prompt openaiMessages :
    if (isResumeIntent && (!Array.isArray(contextFiles) || contextFiles.length === 0)) {
      // Résumé global si semanticContext existe, sinon demande de précision
      if (semanticContext) {
        const openaiMessages = [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: "L'utilisateur demande un résumé global des informations disponibles. Ne résume aucun fichier précis, mais synthétise les informations générales pertinentes pour l'affaire ou le contexte." },
          { role: "system", content: `Contexte extrait par recherche sémantique :\n${semanticContext}` },
          ...memory.history.slice(-10)
            .filter((m): m is { role: "user" | "assistant"; content: string } => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === 'string')
            .map(m => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
            })),
        ].filter(Boolean);
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
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
        const suggestions = await generateSuggestions(
          `Résumé global demandé.\nQuestion : ${message}`,
          reply,
          message
        );
        const explicability = {
          files: [],
          prompt: openaiMessages.map(m => m.content).join('\n---\n'),
        };
        return NextResponse.json({ reply, suggestions, explicability });
      } else {
        return NextResponse.json({ reply: "Pour quel(s) fichier(s) souhaitez-vous un résumé ? Veuillez sélectionner un ou plusieurs fichiers ou préciser votre demande." });
      }
    }
    const openaiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      contextFilesText ? { role: "system", content: `Contexte extrait des fichiers sélectionnés :\n${contextFilesText}` } : undefined,
      semanticContext ? { role: "system", content: `Contexte extrait par recherche sémantique :\n${semanticContext}` } : undefined,
      memory.contextSummary ? { role: "system", content: `Résumé du contexte : ${memory.contextSummary}` } : undefined,
      memory.userGoals && memory.userGoals.length ? { role: "system", content: `Objectifs utilisateur détectés : ${memory.userGoals.join(", ")}` } : undefined,
      memory.keyEntities && memory.keyEntities.length ? { role: "system", content: `Entités clés détectées : ${memory.keyEntities.map(e => `${e.type}: ${e.value}`).join("; ")}` } : undefined,
      ...memory.history.slice(-10)
        .filter((m): m is { role: "user" | "assistant"; content: string } => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === 'string')
        .map(m => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
    ].filter(Boolean);
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
        model: 'gpt-3.5-turbo',
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

    let contextForSuggestions = '';
    if (memory.contextSummary) contextForSuggestions += `Résumé du contexte : ${memory.contextSummary}\n`;
    if (memory.userGoals && memory.userGoals.length) contextForSuggestions += `Objectifs utilisateur : ${memory.userGoals.join(", ")}\n`;
    if (memory.keyEntities && memory.keyEntities.length) contextForSuggestions += `Entités clés : ${memory.keyEntities.map(e => `${e.type}: ${e.value}`).join("; ")}\n`;
    const suggestions = await generateSuggestions(contextForSuggestions, reply, message);

    const userEmbedding = await getEmbeddingOpenAI(message);
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
  const isTxt = /txt|texte|text/i.test(message);
  const isPdf = /pdf/i.test(message);
  const filtered = files.filter((f: any) => (isTxt && f.type === 'txt') || (isPdf && f.type === 'pdf'));
  if (filtered.length === 1) {
    await updateMemory(userId, { currentFile: filtered[0] });
    return null;
  }
  return `Plusieurs fichiers ont été référencés : ${files.map((f: any) => f.name).join(', ')}. Lequel souhaitez-vous utiliser ?`;
}

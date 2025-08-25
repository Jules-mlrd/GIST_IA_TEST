import { fetchPdfTextFromS3, listPdfFilesInS3 } from '@/lib/readPdf';
import { listTxtFilesInS3, fetchTxtContentFromS3 } from '@/lib/readTxt';
import { parseStructuredFile } from '@/lib/readCsv';
import fs from 'fs';
import path from 'path';
import { NextResponse } from "next/server";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import s3 from "@/lib/s3Client";
import redis from '@/lib/redisClient';
import { getEmbeddingOpenAI, getCache, setCache, logMetric, logTiming, logCacheHit, logCacheMiss } from '@/lib/utils';
import { PrismaClient } from '@/lib/generated/prisma';
const prisma = new PrismaClient();

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
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      // Valeur corrompue : on reset la mémoire
      const initial: MemoryContext = { history: [], referencedFiles: [] };
      await redis.set(`memory:${userId}`, JSON.stringify(initial));
      return initial;
    }
  }
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
  if (typeof message !== 'string') return false;
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

// Nouvelle fonction pour détecter le type de question et adapter la réponse
function detectQuestionType(message: string): { type: string, context: string } {
  const lowerMsg = message.toLowerCase();
  
  // Questions sur les risques
  if (lowerMsg.includes('risque') || lowerMsg.includes('danger') || lowerMsg.includes('problème') || lowerMsg.includes('alerte')) {
    return { type: 'risk_analysis', context: 'Analyse de risques et points d\'attention' };
  }
  
  // Questions sur les coûts/budgets
  if (lowerMsg.includes('coût') || lowerMsg.includes('prix') || lowerMsg.includes('budget') || lowerMsg.includes('montant') || lowerMsg.includes('devis')) {
    return { type: 'cost_analysis', context: 'Analyse financière et budgétaire' };
  }
  
  // Questions sur les délais/planning
  if (lowerMsg.includes('délai') || lowerMsg.includes('date') || lowerMsg.includes('planning') || lowerMsg.includes('échéance') || lowerMsg.includes('calendrier')) {
    return { type: 'timeline_analysis', context: 'Analyse des délais et planning' };
  }
  
  // Questions sur les personnes/contacts
  if (lowerMsg.includes('qui') || lowerMsg.includes('contact') || lowerMsg.includes('personne') || lowerMsg.includes('responsable') || lowerMsg.includes('référent')) {
    return { type: 'contact_analysis', context: 'Identification des parties prenantes' };
  }
  
  // Questions techniques
  if (lowerMsg.includes('technique') || lowerMsg.includes('spécification') || lowerMsg.includes('méthode') || lowerMsg.includes('procédure')) {
    return { type: 'technical_analysis', context: 'Analyse technique et méthodologique' };
  }
  
  // Questions de comparaison
  if (lowerMsg.includes('comparer') || lowerMsg.includes('différence') || lowerMsg.includes('similaire') || lowerMsg.includes('versus')) {
    return { type: 'comparison_analysis', context: 'Analyse comparative' };
  }
  
  return { type: 'general', context: 'Analyse générale' };
}

const SYSTEM_PROMPT = `
Vous êtes un assistant IA spécialisé dans la gestion de projets SNCF et l'analyse de documents techniques.

CONTEXTE MÉTIER SNCF :
- Vous travaillez dans un environnement de gestion de projets ferroviaires
- Vous connaissez les termes techniques : affaires, devis, notes de travaux, risques, contacts MOA, etc.
- Vous comprenez les enjeux de sécurité, de réglementation et de maintenance ferroviaire
- Vous savez identifier les parties prenantes : clients, porteurs, référents, contacts MOA

RÈGLES DE RÉPONSE :
1. Répondez de façon précise et adaptée au contexte SNCF
2. Structurez vos réponses avec des points clés quand c'est pertinent
3. Identifiez les risques, alertes ou points d'attention importants
4. Mentionnez les dates, montants, personnes et références techniques
5. Si vous n'avez pas assez d'information, demandez des précisions
6. Évitez les réponses génériques - soyez spécifique au contexte
7. Utilisez un ton professionnel mais accessible

TYPES DE QUESTIONS FRÉQUENTES :
- Résumés de documents : synthétisez les points essentiels
- Analyse de risques : identifiez les dangers et recommandations
- Comparaisons : mettez en évidence les différences et similitudes
- Recherche d'informations : localisez et extrayez les données demandées
- Questions techniques : expliquez avec précision les aspects techniques

IMPORTANT : Adaptez toujours votre réponse au type de document (devis, note de travaux, rapport technique, etc.) et au contexte de l'affaire.
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
      max_tokens: 4096,
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
      max_tokens: 4096,
    }),
  });
  if (!response.ok) return { intent: '', entities: [] };
  const data = await response.json();
  try {
    const json = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    return json;
  } catch {
    return { intent: '', entities: [] };
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

// --- Ajout pour la mise en cache des analyses de documents ---
async function getOrCacheDocumentAnalysis(bucketName: string, fileKey: string, type: 'pdf' | 'txt' | 'csv') {
  const cacheKey = `doc:${fileKey}:analysis`;
  let analysis = await getCache(cacheKey);
  if (analysis) {
    console.log(`[CACHE HIT] Analyse document ${fileKey}`);
    return analysis;
  }
  let text = '';
  if (type === 'pdf') {
    text = await fetchPdfTextFromS3(bucketName, fileKey);
  } else if (type === 'txt') {
    text = await fetchTxtContentFromS3(bucketName, fileKey);
  } else {
    // CSV: handled elsewhere
    return null;
  }
  const embedding = await getEmbeddingOpenAI(text.slice(0, 2000));
  analysis = { text, embedding };
  await setCache(cacheKey, analysis, 60 * 60 * 24); // 24h TTL
  return analysis;
}

// --- Ajout pour la mise en cache des réponses IA ---
async function getSimilarCachedResponse(userId: string, message: string, threshold = 0.85) {
  const cacheKey = `user:${userId}:qa-history`;
  let history = await getCache(cacheKey);
  if (!history) return null;
  const userEmbedding = await getEmbeddingOpenAI(message);
  let bestScore = 0;
  let bestIdx = -1;
  for (let i = 0; i < history.length; i++) {
    const h = history[i];
    if (h.embedding) {
      const score = cosineSimilarity(userEmbedding, h.embedding);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
  }
  if (bestScore > threshold && bestIdx !== -1) {
    console.log(`[CACHE HIT] Réponse IA similaire trouvée (score: ${bestScore})`);
    return history[bestIdx].reply;
  }
  return null;
}
async function cacheUserResponse(userId: string, message: string, embedding: number[], reply: string) {
  const cacheKey = `user:${userId}:qa-history`;
  let history = await getCache(cacheKey);
  if (!Array.isArray(history)) history = [];
  history.push({ message, embedding, reply, timestamp: Date.now() });
  // Limiter la taille de l'historique
  if (history.length > 50) history = history.slice(-50);
  await setCache(cacheKey, history, 60 * 60 * 24); // 24h TTL
}

const getChatKey = (affaireId: string) => `chat:affaire:${affaireId}`;

// Fonction utilitaire pour sauvegarder les messages dans Redis
async function saveToRedisHistory(affaireId: string, userMessage: string, botReply: string) {
  if (!affaireId) return;
  const key = getChatKey(affaireId);
  console.log('saveToRedisHistory - Clé:', key);
  const existingHistory = await redis.get(key);
  let history = [];
  try {
    history = existingHistory ? JSON.parse(existingHistory) : [];
  } catch {}
  
  console.log('saveToRedisHistory - Historique existant:', history);
  
  // Ajouter le message utilisateur et la réponse IA
  const userMsg = {
    id: `user-${Date.now()}`,
    content: userMessage,
    sender: "user",
    timestamp: new Date().toISOString()
  };
  const botMsg = {
    id: `bot-${Date.now()}`,
    content: botReply,
    sender: "bot",
    timestamp: new Date().toISOString()
  };
  
  history.push(userMsg);
  history.push(botMsg);
  
  console.log('saveToRedisHistory - Nouvel historique:', history);
  
  await redis.set(key, JSON.stringify(history), { ex: 60 * 60 * 24 * 7 }); // 7 jours
  console.log('saveToRedisHistory - Sauvegarde terminée');
}

export async function GET(req: Request) {
  const url = new URL(req.url || '', 'http://localhost');
  const affaireId = url.searchParams.get('affaireId');
  if (!affaireId) return NextResponse.json({ error: 'affaireId requis' }, { status: 400 });
  const key = getChatKey(affaireId);
  console.log('API GET - Clé Redis:', key);
  const history = await redis.get(key);
  console.log('API GET - Données brutes Redis:', history);
  try {
    // Redis retourne déjà des objets, pas des chaînes JSON
    const parsedHistory = Array.isArray(history) ? history : [];
    console.log('API GET - Historique parsé:', parsedHistory);
    return NextResponse.json({ history: parsedHistory });
  } catch (error) {
    console.error('API GET - Erreur parsing:', error);
    return NextResponse.json({ history: [] });
  }
}



export async function DELETE(req: Request) {
  const url = new URL(req.url || '', 'http://localhost');
  const affaireId = url.searchParams.get('affaireId');
  if (!affaireId) return NextResponse.json({ error: 'affaireId requis' }, { status: 400 });
  const key = getChatKey(affaireId);
  await redis.del(key);
  return NextResponse.json({ success: true });
}

export async function POST(req: Request) {
  const endpoint = 'api:chat';
  const start = Date.now();
  try {
    const { message, userId = "default", affaireId, readFiles = true, contextFiles } = await req.json();
    
    // Debug: Log des fichiers sélectionnés
    console.log('Fichiers sélectionnés reçus:', contextFiles);
    console.log('Type de contextFiles:', typeof contextFiles);
    console.log('Est un array:', Array.isArray(contextFiles));
    
    // Ensure message is a string
    if (typeof message !== 'string') {
      return NextResponse.json({ reply: 'Le message doit être une chaîne de caractères.' }, { status: 400 });
    }
    
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

    // --- Prompt engineering : injecter les contacts dans le prompt système si affaireId ---
    let contactContext = '';
    if (affaireId) {
      const affaire = await prisma.affaires.findFirst({ where: { numero_affaire: affaireId } });
      if (affaire) {
        let contactLines = [];
        if (affaire.client) contactLines.push(`Client : ${affaire.client}`);
        if (affaire.porteur) contactLines.push(`Porteur : ${affaire.porteur}`);
        if (affaire.referent) contactLines.push(`Référent : ${affaire.referent}`);
        if (affaire.contact_moa_moeg) contactLines.push(`Contact MOA/MOEG : ${affaire.contact_moa_moeg}`);
        if (affaire.guichet) contactLines.push(`Guichet : ${affaire.guichet}`);
        if (contactLines.length > 0) {
          contactContext = `\n\nSi l'utilisateur pose une question sur les contacts (qui contacter, à qui s'adresser, etc.), réponds précisément avec ces informations :\n- ${contactLines.join('\n- ')}\nSinon, réponds normalement et n'utilise ces informations que si c'est pertinent.`;
        }
      }
    }

    // --- Ajout : détection question contact ---
    const contactKeywords = [
      'contact', 'qui contacter', 'qui dois-je contacter', 'à qui m\'adresser', 'référent', 'porteur', 'client', 'moa', 'moeg', 'responsable', 'personne à contacter', 'personne de contact', 'point de contact', 'support', 'mail', 'email', 'téléphone', 'coordonnées'
    ];
    // Ajout : mots-clés pour la rédaction de mail
    const mailWritingKeywords = [
      'rédiger un mail', 'rédiger un email', 'écrire un mail', 'écrire un email', 'envoyer un mail', 'envoyer un email', 'exemple de mail', 'exemple d\'email', 'rédaction mail', 'rédaction email', 'proposer un mail', 'proposer un email', 'générer un mail', 'générer un email', 'mail type', 'email type', 'modèle de mail', 'modèle d\'email', 'mail automatique', 'email automatique', 'mail de relance', 'email de relance', 'mail de demande', 'email de demande', 'mail de réponse', 'email de réponse', 'mail professionnel', 'email professionnel', 'mail formel', 'email formel', 'mail informel', 'email informel'
    ];
    // Fonction utilitaire pour vérifier si un message ou une intention correspond à un mot-clé de rédaction de mail
    function isMailWritingIntent(text: string) {
      if (typeof text !== 'string') return false;
      const lower = text.toLowerCase();
      return mailWritingKeywords.some(kw => lower.includes(kw));
    }
    // On ne déclenche la réponse contact que si ce n'est PAS une demande de rédaction de mail ET qu'aucun fichier n'est sélectionné
    const isContactIntent = (
      !isMailWritingIntent(typeof message === 'string' ? message : '') &&
      !isMailWritingIntent(typeof intentEntities.intent === 'string' ? intentEntities.intent : '') &&
      (
        (intentEntities.intent && /contact|référent|porteur|client|moa|moeg|responsable|support|mail|email|téléphone|coordonnées/i.test(intentEntities.intent)) ||
        contactKeywords.some(kw => (typeof message === 'string' ? message : '').toLowerCase().includes(kw))
      )
    );
    
    // Vérifier d'abord si des fichiers sont sélectionnés - si oui, on ignore la logique de contact automatique
    const hasContextFiles = Array.isArray(contextFiles) && contextFiles.length > 0;
    
    // Ne déclencher la réponse contact automatique que si aucun fichier n'est sélectionné
    console.log('Détection contact:', { isContactIntent, hasContextFiles, contextFiles });
    if (isContactIntent && affaireId && !hasContextFiles) {
      // Récupérer les infos de l'affaire
      const affaire = await prisma.affaires.findFirst({ where: { numero_affaire: affaireId } });
      if (affaire) {
        let contactMsg = `Pour toute information sur l'affaire, vous pouvez contacter :\n`;
        if (affaire.client) contactMsg += `- Client : ${affaire.client}\n`;
        if (affaire.porteur) contactMsg += `- Porteur : ${affaire.porteur}\n`;
        if (affaire.referent) contactMsg += `- Référent : ${affaire.referent}\n`;
        if (affaire.contact_moa_moeg) contactMsg += `- Contact MOA/MOEG : ${affaire.contact_moa_moeg}\n`;
        if (affaire.guichet) contactMsg += `- Guichet : ${affaire.guichet}\n`;
        if (contactMsg.trim() === `Pour toute information sur l'affaire, vous pouvez contacter :`) {
          contactMsg = `Aucun contact spécifique n'est renseigné pour cette affaire.`;
        }
        memory.history.push({ role: "assistant", content: contactMsg });
        await saveToRedisHistory(affaireId, message, contactMsg);
        return NextResponse.json({ reply: contactMsg });
      } else {
        const errorMsg = "Aucune information d'affaire trouvée pour fournir un contact.";
        await saveToRedisHistory(affaireId, message, errorMsg);
        return NextResponse.json({ reply: errorMsg });
      }
    }
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
    // Ajout : Calculer l'embedding du message utilisateur dès le début
    const currentUserEmbedding = await getEmbeddingOpenAI(resolvedMessage);
    // Ajout : Ajouter le message utilisateur avec embedding et timestamp dans l'historique
    memory.history.push({ role: "user", content: resolvedMessage, embedding: currentUserEmbedding, timestamp: Date.now() });
    // Ajout : Générer un résumé de contexte si l'historique dépasse 10 messages
    if (memory.history.length > 10) {
      const summary = await summarizeHistory(memory.history);
      if (summary) {
        await updateMemory(userId, { contextSummary: summary });
        memory.contextSummary = summary;
      }
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
      const ambiguousReply = "Votre question semble ambiguë ou fait référence à un élément précédent. Pouvez-vous préciser de quel document, projet ou sujet il s'agit ?";
      await saveToRedisHistory(affaireId, message, ambiguousReply);
      return NextResponse.json({ reply: ambiguousReply });
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
      console.log('Traitement des fichiers sélectionnés:', contextFiles);
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
    // Détection d'intention améliorée pour différents types de requêtes
    const resumeIntentRegex = /résum[ée]|synth[èe]se|extrait|points? clés?|fichier joint|document sélectionné|document joint|fichier sélectionné|ce fichier|ces fichiers|le fichier|les fichiers|document/i;
    const isResumeIntent = resumeIntentRegex.test(message);
    
    // Détection d'autres types de requêtes
    const analysisIntentRegex = /analys[ée]|étudier|examiner|vérifier|contrôler|rechercher|trouver|identifier|détecter|comparer|différence|similaire/i;
    const isAnalysisIntent = analysisIntentRegex.test(message);
    
    const questionIntentRegex = /qu[ée]stion|demande|comment|pourquoi|quand|où|qui|quoi|combien|quel|quelle|quels|quelles/i;
    const isQuestionIntent = questionIntentRegex.test(message);
    
    // Détection de requête sur fichier spécifique
    const fileSpecificIntent = /fichier|document|pièce jointe|joint|sélectionné|ce document|ce fichier|le document|le fichier/i;
    const isFileSpecificIntent = fileSpecificIntent.test(message);
    
    // Déterminer le type principal de requête
    let requestType = 'general';
    if (isResumeIntent) requestType = 'summary';
    else if (isAnalysisIntent) requestType = 'analysis';
    else if (isQuestionIntent) requestType = 'question';
    else if (isFileSpecificIntent) requestType = 'file_specific';
    // Si la demande concerne un fichier joint/document sélectionné
    // Gestion des cas multiples/ambigus
    let ambiguousWarning = '';
    if ((isResumeIntent || isAnalysisIntent || isFileSpecificIntent) && Array.isArray(contextFiles) && contextFiles.length > 1) {
      ambiguousWarning = "Plusieurs fichiers ont été sélectionnés. Propose une analyse globale ou une analyse pour chaque fichier, ou demande à l'utilisateur de préciser si besoin.";
    }
    // Gestion des erreurs de lecture de fichiers
    let fileErrorWarning = '';
    if ((isResumeIntent || isAnalysisIntent || isFileSpecificIntent) && Array.isArray(contextFiles) && contextFiles.length > 0) {
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
        { role: "system", content: SYSTEM_PROMPT + contactContext },
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
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });
      if (!response.ok) {
        console.error('OpenAI API error:', await response.text());
        return NextResponse.json({ reply: 'Erreur OpenAI.' }, { status: 500 });
      }
      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || "Aucune réponse générée.";
      memory.history.push({ role: "assistant", content: reply });
      // Supprimer les suggestions dans tous les NextResponse.json
      // 1. Chercher tous les appels à generateSuggestions et les supprimer
      // 2. Ne pas inclure suggestions dans les objets retournés
      const explicability = {
        files: contextFiles.map(k => k.split('/').pop()),
        prompt: openaiMessages.filter(m => m && typeof m.content === 'string').map(m => (m as any).content).join('\n---\n'),
      };
      return NextResponse.json({ reply, explicabilityBelow: explicability });
    }
    // Après la gestion des fichiers sélectionnés et avant la construction du prompt openaiMessages :
    // Si des fichiers sont sélectionnés, on a déjà traité la demande plus haut
    // Sinon, vérifier si c'est une demande de résumé global d'affaire
    const hasSelectedFiles = Array.isArray(contextFiles) && contextFiles.length > 0;
    
    // Si aucun fichier sélectionné ET que ce n'est pas une demande de fichier spécifique
    if (!hasSelectedFiles && !isFileSpecificIntent) {
      // Résumé global si semanticContext existe, sinon demande de précision
      if (affaireId) {
        // Lire l'affaire depuis la base
        const affaire = await prisma.affaires.findFirst({ where: { numero_affaire: affaireId } });
        if (affaire) {
          // Construire un texte à résumer à partir des champs principaux
          const baseText = `Titre: ${affaire.titre || ''}\nEtat: ${affaire.etat || ''}\nClient: ${affaire.client || ''}\nPorteur: ${affaire.porteur || ''}\nType de demande: ${affaire.type_demande || ''}\nDescription: ${affaire.description_technique || ''}`;
          const openaiMessages = [
            { role: "system", content: SYSTEM_PROMPT + contactContext },
            { role: "user", content: `Rédige un paragraphe synthétique et fluide présentant l'affaire ci-dessous à un lecteur non spécialiste, en intégrant les informations principales (titre, état, client, porteur, type de demande, description technique). N'utilise pas de liste, pas de titre, et privilégie un style naturel.\n\nInformations de l'affaire :\n${baseText}` },
          ];
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'gpt-3.5-turbo',
              messages: openaiMessages,
              temperature: 0.3,
              max_tokens: 4096,
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
        }
      }
      if (semanticContext) {
        const openaiMessages = [
          { role: "system", content: SYSTEM_PROMPT + contactContext },
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
            temperature: 0.3,
            max_tokens: 4096,
          }),
        });
        if (!response.ok) {
          console.error('OpenAI API error:', await response.text());
          return NextResponse.json({ reply: 'Erreur OpenAI.' }, { status: 500 });
        }
        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || "Aucune réponse générée.";
        memory.history.push({ role: "assistant", content: reply });
        // Supprimer les suggestions dans tous les NextResponse.json
        // 1. Chercher tous les appels à generateSuggestions et les supprimer
        // 2. Ne pas inclure suggestions dans les objets retournés
        const explicability = {
          files: [],
          prompt: openaiMessages.filter(m => m && typeof m.content === 'string').map(m => (m as any).content).join('\n---\n'),
        };
        return NextResponse.json({ reply, explicabilityBelow: explicability });
      } else {
        let precisionReply = "";
        if (requestType === 'summary') {
          precisionReply = "Pour quel(s) fichier(s) souhaitez-vous un résumé ? Veuillez sélectionner un ou plusieurs fichiers ou préciser votre demande.";
        } else if (requestType === 'analysis') {
          precisionReply = "Pour quel(s) fichier(s) souhaitez-vous une analyse ? Veuillez sélectionner un ou plusieurs fichiers ou préciser votre demande.";
        } else if (requestType === 'question') {
          precisionReply = "Sur quel(s) fichier(s) souhaitez-vous que je réponde à votre question ? Veuillez sélectionner un ou plusieurs fichiers.";
        } else if (requestType === 'file_specific') {
          precisionReply = "Quel(s) fichier(s) souhaitez-vous que j'examine ? Veuillez sélectionner un ou plusieurs fichiers.";
        } else {
          precisionReply = "Sur quel(s) fichier(s) souhaitez-vous que je travaille ? Veuillez sélectionner un ou plusieurs fichiers ou préciser votre demande.";
        }
        await saveToRedisHistory(affaireId, message, precisionReply);
        return NextResponse.json({ reply: precisionReply });
      }
    }
    
    // Si c'est une demande de fichier spécifique mais aucun fichier sélectionné
    if (isFileSpecificIntent && !hasSelectedFiles) {
      let precisionReply = "Quel(s) fichier(s) souhaitez-vous que j'examine ? Veuillez sélectionner un ou plusieurs fichiers.";
      await saveToRedisHistory(affaireId, message, precisionReply);
      return NextResponse.json({ reply: precisionReply });
    }
    // Détecter le type de question pour adapter la réponse
    const questionType = detectQuestionType(resolvedMessage);
    
    const openaiMessages = [
      { role: "system", content: SYSTEM_PROMPT + contactContext },
      { role: "system", content: `Type de question détecté : ${questionType.type}. Contexte : ${questionType.context}. Adaptez votre réponse en conséquence.` },
      memory.contextSummary ? { role: "system", content: `Résumé du contexte : ${memory.contextSummary}` } : undefined,
      contextFilesText ? { role: "system", content: `Contexte extrait des fichiers sélectionnés :\n${contextFilesText}` } : undefined,
      semanticContext ? { role: "system", content: `Contexte extrait par recherche sémantique :\n${semanticContext}` } : undefined,
      memory.userGoals && memory.userGoals.length ? { role: "system", content: `Objectifs utilisateur détectés : ${memory.userGoals.join(", ")}` } : undefined,
      memory.keyEntities && memory.keyEntities.length ? { role: "system", content: `Entités clés détectées : ${memory.keyEntities.map(e => `${e.type}: ${e.value}`).join("; ")}` } : undefined,
      // Limiter l'historique à 15 derniers messages pertinents pour plus de contexte
      ...memory.history.slice(-15)
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
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });
    if (!response.ok) {
      console.error('OpenAI API error:', await response.text());
      return NextResponse.json({ reply: 'Erreur OpenAI.' }, { status: 500 });
    }
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Aucune réponse générée.";
    memory.history.push({ role: "assistant", content: reply });
    await updateMemory(userId, memory);

    // Sauvegarder aussi dans Redis pour l'API GET
    await saveToRedisHistory(affaireId, message, reply);

    let contextForSuggestions = '';
    if (memory.contextSummary) contextForSuggestions += `Résumé du contexte : ${memory.contextSummary}\n`;
    if (memory.userGoals && memory.userGoals.length) contextForSuggestions += `Objectifs utilisateur : ${memory.userGoals.join(", ")}\n`;
    if (memory.keyEntities && memory.keyEntities.length) contextForSuggestions += `Entités clés : ${memory.keyEntities.map(e => `${e.type}: ${e.value}`).join("; ")}\n`;
    // Supprimer les suggestions dans tous les NextResponse.json
    // 1. Chercher tous les appels à generateSuggestions et les supprimer
    // 2. Ne pas inclure suggestions dans les objets retournés
    let similarPast = null;
    if (memory.history && memory.history.length > 0) {
      let bestScore = 0;
      let bestIdx = -1;
      for (let i = 0; i < memory.history.length; i++) {
        const h = memory.history[i];
        if (h.role === 'user' && h.embedding) {
          const score = cosineSimilarity(currentUserEmbedding, h.embedding);
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
    memory.history.push({ role: "user", content: message, embedding: currentUserEmbedding, timestamp: Date.now() });

    // Mise en cache de la réponse IA
    await cacheUserResponse(userId, message, currentUserEmbedding, reply);

    // --- Log du temps de réponse et du nombre de requêtes ---
    const duration = Date.now() - start;
    await logTiming(endpoint, duration);
    await logMetric(`metrics:${endpoint}:requests`, 1);

    return NextResponse.json({
      reply,
      explicabilityBelow: {
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

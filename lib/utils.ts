import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { fetchTxtContentFromS3 } from './readTxt';
import { parseStructuredFile } from './readCsv';
import s3 from './s3Client';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function getEmbeddingOpenAI(text: string, apiKey?: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey || process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });
  if (!response.ok) throw new Error('Erreur OpenAI Embedding');
  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Extrait les contacts (nom, email, téléphone) d'un texte brut de façon robuste.
 * Retourne un tableau d'objets { name, email, phone } plausibles.
 */
export function extractContactsFromText(text: string): Array<{ name?: string, email?: string, phone?: string }> {
  const contacts: Array<{ name?: string, email?: string, phone?: string }> = [];
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(?:\+\d{1,3}[ .-]?)?(?:\(\d{1,4}\)[ .-]?)?\d{1,4}[ .-]?\d{2,4}[ .-]?\d{2,4}/g;

  // Split en lignes pour analyse contextuelle
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Extraction emails et téléphones avec contexte
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const emails = line.match(emailRegex) || [];
    const phones = line.match(phoneRegex) || [];
    if (emails.length === 0 && phones.length === 0) continue;

    // Chercher le nom sur la même ligne ou la précédente
    let name: string | undefined;
    // Heuristique : si la ligne commence par un nom (2 mots, majuscules, pas "email", etc.)
    const nameCandidate = line.replace(emailRegex, '').replace(phoneRegex, '').replace(/[<>\-–|,;:]/g, '').trim();
    if (nameCandidate &&
      nameCandidate.split(' ').length <= 4 &&
      !/email|courriel|adresse|contact|téléphone|phone|portable|mobile|mail/i.test(nameCandidate) &&
      /[A-Za-zÀ-ÿ]{2,}/.test(nameCandidate)
    ) {
      name = nameCandidate;
    } else if (i > 0) {
      // Sinon, prendre la ligne précédente si elle ressemble à un nom
      const prev = lines[i - 1];
      if (prev &&
        prev.split(' ').length <= 4 &&
        !/email|courriel|adresse|contact|téléphone|phone|portable|mobile|mail/i.test(prev) &&
        /[A-Za-zÀ-ÿ]{2,}/.test(prev)
      ) {
        name = prev;
      }
    }

    // Ajouter chaque email/phone trouvé comme contact
    emails.forEach(email => {
      // Validation email simple
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
      contacts.push({ name, email });
    });
    phones.forEach(phone => {
      // Nettoyage du numéro
      const cleanPhone = phone.replace(/[^\d+]/g, '');
      if (cleanPhone.length < 8) return; // Trop court pour être un vrai numéro
      // Éviter doublons
      if (!contacts.some(c => c.phone === cleanPhone)) {
        contacts.push({ name, phone: cleanPhone });
      }
    });
  }

  // Nettoyage final : ne garder que les contacts plausibles
  const filtered = contacts.filter(c => (c.email || c.phone) && (c.name || c.email));

  // Dédoublonnage par email ou téléphone
  const unique: typeof filtered = [];
  const seen = new Set();
  for (const c of filtered) {
    const id = c.email || c.phone;
    if (id && !seen.has(id)) {
      unique.push(c);
      seen.add(id);
    }
  }
  return unique;
}

/**
 * Utilise OpenAI pour extraire les contacts humains d'un texte (nom, prénom, email, téléphone, société, rôle).
 * Retourne un tableau d'objets structurés.
 */
export async function extractContactsWithLLM(text: string, apiKey?: string): Promise<Array<{ prenom?: string, nom?: string, email?: string, telephone?: string, societe?: string, role?: string }>> {
  const prompt = `Voici un texte extrait d'un document professionnel.\n\nExtrais uniquement les contacts humains (prénom, nom, email, téléphone, société, rôle si possible) présents dans ce texte.\n\nIgnore :\n- Les adresses génériques (ex : contact@, info@, support@, noreply@, etc.)\n- Les signatures automatiques ou mentions de service\n- Les adresses ou numéros de téléphone qui ne sont pas associés à une personne réelle\n\nRetourne la liste sous forme d'objets JSON, un par contact, exemple :\n[{"prenom": "Marie", "nom": "Dubois", "email": "m.dubois@sncf.fr", "telephone": "0123456789", "societe": "SNCF", "role": "Chef de projet"}]\n\nTexte :\n${text}\n\nRéponse :`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey || process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Tu es un assistant d\'extraction de contacts professionnels.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 800,
    }),
  });
  if (!response.ok) throw new Error('Erreur OpenAI extraction contacts');
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  // Extraction robuste du JSON de la réponse (sans flag 's')
  const firstBracket = content.indexOf('[');
  const lastBracket = content.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(content.substring(firstBracket, lastBracket + 1));
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Utilise OpenAI pour extraire les risques d'un texte (description, criticité, responsable, etc.).
 * Retourne un tableau d'objets structurés.
 */
export async function extractRisksWithLLM(text: string, apiKey?: string): Promise<Array<{ description?: string, criticite?: string, justification?: string, responsable?: string, action?: string }>> {
  const prompt = `Tu es un assistant expert en gestion des risques projet SNCF.

Ta tâche :
- Lis attentivement le texte ci-dessous et détecte tous les risques projet, même s'ils sont implicites, mal formulés ou indirects.
- Pour chaque risque identifié, fournis un objet avec les champs suivants :
  - description : reformule le risque de façon claire et concise (une phrase)
  - criticite : choisis parmi "faible", "moyen", "élevé", "critique" selon la gravité ET la probabilité (voir critères ci-dessous)
  - justification : explique brièvement pourquoi tu as choisi ce niveau de criticité
  - responsable : indique le nom, la fonction ou le service responsable du risque. Si aucune information n'est trouvée, indique "Non précisé".
  - action : propose une action concrète de mitigation ou de suivi (si possible, sinon laisse vide)

Critères pour la criticité :
- faible : impact négligeable, très peu probable (ex : "Erreur mineure sans conséquence", "Retard d'une journée sur une tâche non critique")
- moyen : impact modéré ou probabilité moyenne (ex : "Retard de quelques jours sur une tâche secondaire", "Oubli d'un livrable intermédiaire")
- élevé : impact important ou probabilité forte (ex : "Retard de plusieurs semaines sur une tâche clé", "Dépendance fournisseur à risque")
- critique : impact majeur, bloquant ou très probable (ex : "Blocage total du projet", "Non-conformité légale", "Perte de données majeures", "Arrêt de production")

Consignes :
- Sois exhaustif : détecte aussi les risques sous-entendus, liés à des retards, des dépendances, des ressources, des erreurs humaines, des problèmes techniques, etc.
- Pour chaque risque, cherche activement le responsable : nom, fonction, service, ou "Non précisé".
- Propose une action de mitigation adaptée à chaque risque si possible.
- Structure la réponse en une liste JSON strictement valide, un objet par risque, maximum 50 objets, exemple :
[
  {
    "description": "Retard de livraison du matériel critique",
    "criticite": "élevé",
    "justification": "Le matériel est indispensable et le retard est probable.",
    "responsable": "Service Achats",
    "action": "Relancer le fournisseur et ajuster le planning"
  }
]
Texte :
${text}

Réponse :`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey || process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Tu es un assistant d\'extraction de risques projet.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 800,
    }),
  });
  if (!response.ok) throw new Error('Erreur OpenAI extraction risques');
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const firstBracket = content.indexOf('[');
  const lastBracket = content.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(content.substring(firstBracket, lastBracket + 1));
    } catch {
      return [];
    }
  }
  return [];
}

// --- CACHE UTILS ---
import redis from './redisClient';

export async function getCache(key: string): Promise<any | null> {
  const data = await redis.get(key);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

export async function setCache(key: string, value: any, ttlSeconds?: number) {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (ttlSeconds) {
    await redis.set(key, str, { ex: ttlSeconds });
  } else {
    await redis.set(key, str);
  }
}

// --- MONITORING UTILS ---
export async function logMetric(key: string, value: number) {
  // Incrémente un compteur (ex: nombre de requêtes)
  await redis.incrby(key, value);
}

export async function logTiming(key: string, durationMs: number) {
  // Stocke la somme et le nombre pour calculer la moyenne
  await redis.incrby(`${key}:sum`, durationMs);
  await redis.incrby(`${key}:count`, 1);
}

export async function getTimingStats(key: string) {
  const sum = parseInt(await redis.get(`${key}:sum`) || '0', 10);
  const count = parseInt(await redis.get(`${key}:count`) || '0', 10);
  return { avg: count ? sum / count : 0, count, sum };
}

export async function logCacheHit(endpoint: string) {
  await redis.incrby(`metrics:${endpoint}:cache_hit`, 1);
}
export async function logCacheMiss(endpoint: string) {
  await redis.incrby(`metrics:${endpoint}:cache_miss`, 1);
}

// (Suppression de la fonction extractAndAnalyzeDocument, utiliser lib/server/extractAndAnalyzeDocument.ts)

// --- FILE D'ATTENTE PREANALYSE ---
const PREANALYSIS_QUEUE = 'preanalysis:queue';
const PREANALYSIS_STATUS = 'preanalysis:status';

export async function enqueuePreanalysisTask(buffer: Buffer, fileName: string, mimeType: string) {
  // Stocke le buffer temporairement (clé binaire)
  await redis.set(`preanalysis:buffer:${fileName}`, buffer);
  await redis.expire(`preanalysis:buffer:${fileName}`, 60 * 60); // 1h TTL
  await redis.rpush(PREANALYSIS_QUEUE, JSON.stringify({ fileName, mimeType }));
  await setPreanalysisStatus(fileName, 'pending');
}

export async function dequeuePreanalysisTask() {
  const taskStr = await redis.lpop(PREANALYSIS_QUEUE);
  if (!taskStr) return null;
  const task = JSON.parse(taskStr);
  const buffer = await redis.getBuffer(`preanalysis:buffer:${task.fileName}`);
  return { ...task, buffer };
}

export async function setPreanalysisStatus(fileName: string, status: 'pending' | 'processing' | 'done' | 'error') {
  await redis.hset(PREANALYSIS_STATUS, fileName, status);
}

export async function getPreanalysisStatus(fileName: string) {
  return await redis.hget(PREANALYSIS_STATUS, fileName) || 'unknown';
}

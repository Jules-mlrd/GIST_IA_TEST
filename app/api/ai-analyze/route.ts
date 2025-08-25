import { NextResponse } from "next/server"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import s3 from "@/lib/s3Client"
import pdfParse from "pdf-parse"
import OpenAI from "openai"
import path from "path"
import { readPdfFromS3Robust } from "@/lib/readPdfRobust"
import { fetchHtmlTextFromS3 } from "@/lib/readTxt"


async function getS3FileBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME!,
    Key: key,
  })
  const response = await s3.send(command)
  
  const stream = response.Body
  if (!stream) {
    throw new Error("S3 stream non disponible pour " + key)
  }
  const chunks: Buffer[] = []
  for await (const chunk of stream as any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

async function readTxtFromS3(key: string) {
  const buffer = await getS3FileBuffer(key)
  return buffer.toString("utf-8")
}

async function readPdfFromS3(key: string) {
  return await readPdfFromS3Robust(key);
}

async function readDocxFromS3(key: string) {
  return "[Lecture DOCX non implémentée dans cette démo]"
}

async function readHtmlFromS3(key: string) {
  return await fetchHtmlTextFromS3(process.env.AWS_BUCKET_NAME!, key);
}

async function askOpenAI(prompt: string, maxRetries = 2): Promise<string> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  let lastError: any = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      })
      return completion.choices[0].message?.content || ""
    } catch (err) {
      lastError = err
      if (attempt < maxRetries) {
        const delay = 500 * Math.pow(2, attempt) 
        await new Promise(res => setTimeout(res, delay))
      }
    }
  }
  throw lastError
}

const PROMPTS = {
  devis: (text: string) => `Voici le texte d'un devis fournisseur :\n"""\n${text}\n"""\n
1. Liste toutes les lignes du devis (description, quantité, prix unitaire, total ligne).
2. Donne le total HT, la TVA, le total TTC.
3. Détecte les anomalies ou incohérences éventuelles.
4. Fournis un résumé du devis (fournisseur, date, objet, etc.).
Réponds uniquement en JSON : { lignes: [...], totalHT: ..., tva: ..., totalTTC: ..., anomalies: [...], resume: ... }`,
  excel: (preview: string, ext: string) => `Voici un extrait d'un tableau issu d'un fichier ${ext} :\n${preview}\n
Fais un résumé des informations importantes, détecte les anomalies éventuelles, et propose 3 graphiques pertinents à réaliser (nom, type, axes). Réponds en JSON : { summary: string, keypoints: string[], charts: [{title, type, x, y}] }`,
  pdf: (text: string) => `Voici le texte extrait d'un PDF :\n"""\n${text}\n"""\n
Fais un résumé du document, liste les mots-clés importants, et détecte les points d'attention éventuels. Réponds en JSON : { summary: string, keywords: string[], alerts: string[] }`,
  txt: (text: string) => `Voici le contenu d'un fichier texte :\n"""\n${text}\n"""\n
Fais un résumé, liste les points clés, et détecte les alertes éventuelles. Réponds en JSON : { summary: string, keypoints: string[], alerts: string[] }`,
  global: (text: string) => `Voici le contenu de documents de projet SNCF :\n\n"""\n${text}\n"""\n
Analyse ces documents et produis une synthèse avancée pour un dashboard projet.\n
1. Fais un résumé long, détaillé et structuré des points clés, des enjeux, des décisions, des risques, des jalons, des personnes impliquées, etc. (minimum 20 lignes, style rapport).
2. Identifie les indicateurs clés (KPIs) sous forme de liste label/valeur (ex : Budget utilisé, Avancement, Nombre de risques, etc.).
3. Liste toutes les alertes ou risques détectés (phrases courtes).
4. Dresse une liste structurée des personnes mentionnées (nom, statut ou rôle, contact si possible).
5. Dresse une timeline structurée des événements ou jalons (date, événement).

Réponds uniquement en JSON strictement formaté, avec les clés suivantes :\n- detailedSummary (string, long résumé détaillé)\n- kpis (array d'objets {label, value})\n- alerts (array de strings)\n- people (array d'objets {name, status, contact})\n- timeline (array d'objets {date, label})\n\nN'inclus aucun texte hors du JSON.`
}

function truncateText(text: string, max: number = 8000) {
  return text.length > max ? text.slice(0, max) : text
}

const FILE_HANDLERS: Record<string, (key: string) => Promise<string | Buffer>> = {
  pdf: readPdfFromS3,
  txt: readTxtFromS3,
  html: readHtmlFromS3,
  docx: readDocxFromS3,
  doc: readDocxFromS3,
}

function extractFirstJsonObject(str: string) {
  const match = str.match(/{[\s\S]*}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function extractDevisData(text: string) {
  let cleanedText = text
    .replace(/Page \d+\/\d+/g, '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\t/g, '    ')
    .replace(/\n{2,}/g, '\n')
    .replace(/[•·●]/g, '-')
    .trim();

  const patterns = [
    { name: 'tab', regex: /^(.*?)(?:\t| {2,})(\d+(?:[.,]\d+)?)(?:\t| {2,})(\d+(?:[.,]\d+)?)(?:\t| {2,})(\d+(?:[.,]\d+)?)/gm },
    { name: 'semicolon', regex: /^(.*?);(\d+(?:[.,]\d+)?);(\d+(?:[.,]\d+)?);(\d+(?:[.,]\d+)?)/gm },
    { name: 'pipe', regex: /^(.*?)\|(\d+(?:[.,]\d+)?)\|(\d+(?:[.,]\d+)?)\|(\d+(?:[.,]\d+)?)/gm },
    { name: 'spaces', regex: /^(.*?)(?:\s{2,})(\d+(?:[.,]\d+)?)(?:\s{2,})(\d+(?:[.,]\d+)?)(?:\s{2,})(\d+(?:[.,]\d+)?)/gm },
  ];
  let lines: any[] = [];
  let patternUsed = null;
  for (const pat of patterns) {
    let match;
    let found = false;
    while ((match = pat.regex.exec(cleanedText)) !== null) {
      found = true;
      lines.push({
        description: match[1].trim(),
        quantite: match[2].replace(',', '.'),
        prixUnitaire: match[3].replace(',', '.'),
        totalLigne: match[4].replace(',', '.')
      });
    }
    if (found) {
      patternUsed = pat.name;
      break;
    }
  }
  const plausibleLines = lines.filter(l => {
    const q = parseFloat(l.quantite);
    const p = parseFloat(l.prixUnitaire);
    const t = parseFloat(l.totalLigne);
    return (
      l.description && l.description.length > 1 &&
      !/^([A-Z]{2,}|[0-9]{4,})$/.test(l.description) && // pas que des lettres/chiffres
      !isNaN(q) && !isNaN(p) && !isNaN(t) &&
      q > 0 && p > 0 && t >= 0
    );
  });
  function extractTotal(label: string) {
    const rgx = new RegExp(label + '\\s*:?\\s*([\u20ac\d., ]+)', 'i');
    const found = cleanedText.match(rgx);
    if (found) {
      return found[1].replace(/[^\d.,]/g, '').replace(',', '.');
    }
    return null;
  }
  const totalHT = extractTotal('total\\s*ht');
  const tva = extractTotal('tva');
  const totalTTC = extractTotal('total\\s*ttc');

  let warning = null;
  if (!plausibleLines.length) {
    warning = "Aucune ligne de tableau exploitable détectée automatiquement. Le PDF est peut-être mal structuré, bruité ou le tableau n'est pas reconnu. Les totaux ont été extraits si possible. Vous pouvez vérifier le texte extrait ci-dessous.";
  }

  return { lines: plausibleLines, totalHT, tva, totalTTC, cleanedText, patternUsed, warning };
}

/**
 * Utilise OpenAI pour extraire une timeline structurée d'un texte de projet.
 * Retourne un tableau d'objets { date, label, description? }.
 */
export async function extractTimelineWithLLM(text: string, apiKey?: string): Promise<Array<{ date: string, label: string, description?: string, type?: string }>> {
  const prompt = `Tu es un assistant expert en gestion de projet SNCF.

Contexte :
- Tu analyses des documents relatifs à un projet SNCF (travaux, études, opérations ferroviaires, etc.).
- Les éléments majeurs d'une affaire incluent : jalons, validations, réunions clés, livraisons, démarrages, réceptions, clôtures, incidents majeurs, décisions importantes, blocages, changements majeurs, alertes, etc.
- Les dates sont parfois imprécises ou absentes, mais il faut toujours restituer l'ordre chronologique.

Ta tâche :
- Lis attentivement le texte ci-dessous et extrais une timeline structurée de TOUS les événements majeurs du projet.
- Pour chaque événement, fournis :
  - date (format AAAA-MM-JJ si possible, sinon "inconnue")
  - label (titre court, explicite, sans abréviation)
  - description (phrase explicative, contexte ou impact)
  - type (choisis parmi : "jalon", "réunion", "livraison", "validation", "incident", "décision", "blocage", "changement", "alerte", "autre")
- Organise la timeline de façon strictement chronologique (du plus ancien au plus récent).
- Sois exhaustif : n'oublie aucun jalon, validation, incident, décision, blocage ou changement majeur mentionné dans le texte.
- Si plusieurs événements ont la même date, trie-les par importance (livraison > validation > décision > réunion > incident > blocage > autre).
- Si aucune date n'est trouvée, indique "inconnue" mais conserve l'ordre logique.

Exemple de réponse attendue :
[
  { "date": "2024-01-15", "label": "Étude de faisabilité validée", "description": "Validation du dossier d'étude par la MOA.", "type": "validation" },
  { "date": "2024-02-10", "label": "Réunion de lancement", "description": "Réunion de démarrage avec tous les acteurs du projet.", "type": "réunion" },
  { "date": "2024-02-15", "label": "Décision de changement de fournisseur", "description": "Changement de prestataire suite à un incident.", "type": "décision" },
  { "date": "2024-03-01", "label": "Début des travaux", "description": "Démarrage effectif des travaux sur site.", "type": "jalon" },
  { "date": "2024-03-10", "label": "Blocage administratif", "description": "Blocage du chantier suite à un retard d'autorisation.", "type": "blocage" },
  { "date": "2024-04-20", "label": "Livraison du matériel", "description": "Réception des équipements nécessaires au chantier.", "type": "livraison" },
  { "date": "inconnue", "label": "Incident technique majeur", "description": "Blocage du chantier suite à un incident sur la voie.", "type": "incident" }
]

Texte à analyser :
"""
${text}
"""

Réponds uniquement par un tableau JSON strictement valide, sans texte autour.
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
        { role: 'system', content: 'Tu es un assistant d\'extraction de timeline projet.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1000,
    }),
  });
  if (!response.ok) throw new Error('Erreur OpenAI extraction timeline');
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

/**
 * Utilise OpenAI pour extraire les tâches projet d'un texte.
 * Retourne un tableau d'objets { id, name, status, assignee, startDate, endDate, description? }.
 */
export async function extractTasksWithLLM(text: string, apiKey?: string): Promise<Array<{ id: string, name: string, status: string, assignee?: string, startDate?: string, endDate?: string, description?: string, icon?: string }>> {
  const prompt = `Tu es un assistant expert en gestion de projet SNCF.\n\nContexte :\n- Tu analyses des documents de projet SNCF (travaux, études, opérations, etc.).\n- Les tâches peuvent être de différents types : réunion, validation, livraison, développement, contrôle, etc.\n- Le statut doit être explicite : "completed" (réalisée), "in-progress" (en cours), "pending" (à venir).\n\nTa tâche :\n- Lis attentivement le texte ci-dessous et extrais la liste structurée des tâches du projet.\n- Pour chaque tâche, fournis :\n  - id (identifiant ou numéro, ou "T-XXX" si inconnu)\n  - name (titre court, explicite, sans abréviation)\n  - status (completed, in-progress, pending)\n  - assignee (personne assignée, si connue)\n  - startDate (si connue)\n  - endDate (si connue)\n  - description (facultatif, phrase explicative)\n  - icon (emoji ou nom d'icône pertinent selon le type ou le statut, ex : "✅" pour completed, "🕒" pour in-progress, "📅" pour réunion, "🚚" pour livraison, "⚠️" pour blocage, etc.)\n- Détecte les tâches même si elles sont mal formulées ou implicites.\n- Structure la réponse en un tableau JSON strictement valide, un objet par tâche.\n- Trie les tâches par date de début croissante si possible.\n\nExemple de réponse attendue :\n[\n  { "id": "T-001", "name": "Analyse des besoins", "status": "completed", "assignee": "Marie Dubois", "startDate": "2024-01-10", "endDate": "2024-01-15", "description": "Analyse des besoins utilisateurs.", "icon": "✅" },\n  { "id": "T-002", "name": "Réunion de lancement", "status": "completed", "startDate": "2024-01-20", "icon": "📅" },\n  { "id": "T-003", "name": "Développement", "status": "in-progress", "icon": "🕒" },\n  { "id": "T-004", "name": "Livraison du matériel", "status": "pending", "icon": "🚚" }\n]\n\nTexte à analyser :\n"""\n${text}\n"""\n\nRéponds uniquement par un tableau JSON strictement valide, sans texte autour.\nRéponse :`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey || process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Tu es un assistant d\'extraction de tâches projet.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1000,
    }),
  });
  if (!response.ok) throw new Error('Erreur OpenAI extraction tâches');
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

/**
 * Utilise OpenAI pour extraire un diagramme de Gantt simplifié d'un texte projet.
 * Retourne un tableau d'objets { label, startDate, endDate, status }.
 */
export async function extractGanttWithLLM(text: string, apiKey?: string): Promise<Array<{ label: string, startDate?: string, endDate?: string, status?: string }>> {
  const prompt = `Voici un texte extrait de documents de projet SNCF :\n\n"""\n${text}\n"""\n\nAnalyse ce texte et extrais un diagramme de Gantt simplifié des tâches ou phases du projet.\nPour chaque élément, donne :\n- label (nom de la tâche ou phase)\n- startDate (si connue)\n- endDate (si connue)\n- status (completed, in-progress, pending)\n\nRetourne uniquement un tableau JSON strictement valide, exemple :\n[\n  { "label": "Étude de faisabilité", "startDate": "2024-01-10", "endDate": "2024-01-15", "status": "completed" },\n  { "label": "Développement", "status": "in-progress" }\n]\n\nRéponse :`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey || process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Tu es un assistant d\'extraction de Gantt projet.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1000,
    }),
  });
  if (!response.ok) throw new Error('Erreur OpenAI extraction Gantt');
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

export async function POST(req: Request) {
  let keys: string[] = []
  try {
    const body = await req.json()
    keys = body.keys
  } catch {
    return NextResponse.json({ error: "Clés de fichiers manquantes" }, { status: 400 })
  }
  if (!keys || keys.length === 0) {
    return NextResponse.json({ error: "Aucune clé de fichier reçue" }, { status: 400 })
  }

  let globalText = ""
  let devisTexts: { key: string, text: string }[] = []
  let excelFiles: { key: string, buffer: Buffer, ext: string }[] = []
  let pdfFiles: { key: string, text: string }[] = []
  let txtFiles: { key: string, text: string }[] = []

  for (const key of keys) {
    const ext = key.split(".").pop()?.toLowerCase() || ""
    const base = path.basename(key).toLowerCase()
    let text = ""
    let buffer: Buffer | null = null
    if (FILE_HANDLERS[ext]) {
      const result = await FILE_HANDLERS[ext](key)
      if (ext === "pdf") {
        text = result as string
        if (base.includes("devis")) {
          devisTexts.push({ key, text })
        } else {
          globalText += text + "\n"
          pdfFiles.push({ key, text })
        }
      } else if (ext === "txt") {
        text = result as string
        if (base.includes("devis")) {
          devisTexts.push({ key, text })
        } else {
          globalText += text + "\n"
          txtFiles.push({ key, text })
        }
      } else if (ext === "docx" || ext === "doc") {
        text = result as string
        if (base.includes("devis")) {
          devisTexts.push({ key, text })
        } else {
          globalText += text + "\n"
        }
      }
    } else if (["xlsx","xls","csv"].includes(ext)) {
      buffer = await getS3FileBuffer(key)
      excelFiles.push({ key, buffer, ext })
    } else {
      globalText += `\n[Type de fichier non supporté: ${key}]\n`
    }
  }

  let devisAnalysis: any[] = []
  for (const devis of devisTexts) {
    try {
      const localExtract = extractDevisData(devis.text);
      let data = null;
      if (localExtract.lines && localExtract.lines.length > 0) {
        const prompt = `Voici le texte d'un devis fournisseur :\n"""\n${localExtract.cleanedText}\n"""\nVoici ce que j'ai extrait automatiquement :\nLignes : ${JSON.stringify(localExtract.lines, null, 2)}\nTotaux détectés : HT=${localExtract.totalHT}, TVA=${localExtract.tva}, TTC=${localExtract.totalTTC}\nMerci de corriger/compléter si besoin et de répondre en JSON structuré : { resume: {...}, totaux: {...}, anomalies: [...], lignes: [...], autresInfos: {...}, texteExtrait: "..." }`;
        const aiResp = await askOpenAI(prompt)
        const jsonStart = aiResp.indexOf("{")
        const jsonEnd = aiResp.lastIndexOf("}") + 1
        const jsonString = aiResp.slice(jsonStart, jsonEnd)
        data = JSON.parse(jsonString)
        devisAnalysis.push({
          key: devis.key,
          resume: data.resume || {},
          totaux: data.totaux || {
            totalHT: data.totalHT || localExtract.totalHT || null,
            tva: data.tva || localExtract.tva || null,
            totalTTC: data.totalTTC || localExtract.totalTTC || null,
            sommeLignes: Array.isArray(data.lignes) ? data.lignes.reduce((acc: number, l: any) => acc + (parseFloat(l.totalLigne || l.total || 0) || 0), 0) : null
          },
          anomalies: data.anomalies || [],
          lignes: data.lignes || [],
          autresInfos: data.autresInfos || {},
          texteExtrait: localExtract.cleanedText,
          localExtract
        })
      } else {
        const fallbackPrompt = `Le tableau du devis n'a pas été reconnu automatiquement. Voici le texte extrait :\n"""\n${localExtract.cleanedText}\n"""\nTente de reconstituer les sections suivantes, même si le texte est bruité ou mal structuré :\n- resume : fiche synthétique (fournisseur, date, objet, etc.)\n- totaux : totalHT, tva, totalTTC, sommeLignes\n- anomalies : liste d'anomalies ou incohérences\n- lignes : tableau des lignes (description, quantité, prix unitaire, total ligne)\n- autresInfos : mentions légales, conditions, etc.\n- texteExtrait : le texte brut extrait\nRéponds uniquement en JSON structuré, même si certains champs sont partiels ou incertains.\nExemple : {\n  "resume": {"fournisseur": "Nom", "date": "2024-06-01", "objet": "Achat"},\n  "totaux": {"totalHT": "200", "tva": "40", "totalTTC": "240", "sommeLignes": "200"},\n  "anomalies": ["Total TTC incohérent"],\n  "lignes": [{"description": "Fourniture X", "quantite": "2", "prixUnitaire": "100", "totalLigne": "200"}],\n  "autresInfos": {"conditions": "30 jours fin de mois"},\n  "texteExtrait": "..."\n}`;
        let aiResp = await askOpenAI(fallbackPrompt)
        let jsonStart = aiResp.indexOf("{")
        let jsonEnd = aiResp.lastIndexOf("}") + 1
        let jsonString = aiResp.slice(jsonStart, jsonEnd)
        try {
          data = JSON.parse(jsonString)
          devisAnalysis.push({
            key: devis.key,
            resume: data.resume || {},
            totaux: data.totaux || {
              totalHT: data.totalHT || localExtract.totalHT || null,
              tva: data.tva || localExtract.tva || null,
              totalTTC: data.totalTTC || localExtract.totalTTC || null,
              sommeLignes: Array.isArray(data.lignes) ? data.lignes.reduce((acc: number, l: any) => acc + (parseFloat(l.totalLigne || l.total || 0) || 0), 0) : null
            },
            anomalies: data.anomalies || [],
            lignes: data.lignes || [],
            autresInfos: data.autresInfos || {},
            texteExtrait: localExtract.cleanedText,
            localExtract,
            fallback: true
          })
        } catch (e) {
          devisAnalysis.push({ key: devis.key, error: "Erreur IA ou parsing (fallback)", details: String(e), localExtract })
        }
      }
    } catch (e: any) {
      const localExtract = extractDevisData(devis.text);
      devisAnalysis.push({ key: devis.key, error: "Erreur IA ou parsing", details: e?.message, localExtract })
    }
  }

  let excelAnalysis: any[] = []
  for (const excel of excelFiles) {
    try {
      const { parseStructuredFile } = await import("@/lib/readCsv")
      const parsed = await parseStructuredFile(excel.buffer, excel.key)
      let summary = parsed.summary || ""
      let data = Array.isArray(parsed.data) ? parsed.data.slice(0, 20) : [];
      if (data.length > 0) {
        const allCols = Object.keys(data[0]);
        const limitedCols = allCols.slice(0, 20);
        data = data.map(row => {
          const newRow: any = {};
          for (const col of limitedCols) newRow[col] = row[col];
          return newRow;
        });
      }
      const columns = data.length > 0 ? Object.keys(data[0]) : [];
      const numericCols = columns.filter(col => data.every(row => typeof row[col] === 'number' || (!isNaN(parseFloat(row[col])) && row[col] !== null && row[col] !== '')));
      const catCols = columns.filter(col => !numericCols.includes(col));
      const autoCharts: any[] = [];
      if (numericCols.length && catCols.length) {
        autoCharts.push({ title: `Répartition ${numericCols[0]} par ${catCols[0]}`, type: 'bar', x: catCols[0], y: numericCols[0], explanation: `Bar chart de ${numericCols[0]} par ${catCols[0]}` });
        autoCharts.push({ title: `Camembert ${numericCols[0]} par ${catCols[0]}`, type: 'pie', x: catCols[0], y: numericCols[0], explanation: `Camembert de ${numericCols[0]} par ${catCols[0]}` });
      }
      if (numericCols.length >= 2) {
        autoCharts.push({ title: `Courbe ${numericCols[1]} vs ${numericCols[0]}`, type: 'line', x: numericCols[0], y: numericCols[1], explanation: `Courbe de ${numericCols[1]} en fonction de ${numericCols[0]}` });
      }
      const stats: Record<string, any> = {};
      for (const col of numericCols) {
        const vals = data.map(row => parseFloat(row[col])).filter(v => !isNaN(v));
        if (vals.length) {
          stats[col] = {
            min: Math.min(...vals),
            max: Math.max(...vals),
            mean: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2),
          };
        }
      }
      let aiData = {};
      let charts = [];
      if (data.length > 0) {
        function detectType(values: any[]) {
          if (values.every((v: any) => typeof v === 'number' || (!isNaN(parseFloat(v)) && v !== null && v !== ''))) return 'numérique';
          if (values.every((v: any) => typeof v === 'string' && !isNaN(Date.parse(v)))) return 'date';
          if (values.every((v: any) => typeof v === 'boolean')) return 'booléen';
          if (values.every((v: any) => typeof v === 'string')) return 'texte';
          return 'texte';
        }
        function isUnique(values: any[]) {
          const set = new Set(values.map(v => v?.toString?.() ?? ''));
          return set.size === values.length;
        }
        const columns = Object.keys(data[0]);
        const columnSamples = columns.map(col => {
          const vals = data.slice(0, 20).map(row => row[col]);
          const type = detectType(vals);
          const unique = isUnique(vals);
          const colObj: any = {
            name: col,
            type,
            examples: vals.slice(0, 3),
            unique
          };
          if (type === 'numérique') {
            const nums = vals.map((v: any) => parseFloat(v)).filter((v: number) => !isNaN(v));
            if (nums.length) {
              colObj.min = Math.min(...nums);
              colObj.max = Math.max(...nums);
              colObj.mean = parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
            }
          }
          return colObj;
        });
        const filteredColumns = columnSamples.filter(c => !c.unique);
        const prompt = `Contexte : Ce tableau provient d'un projet SNCF. Les colonnes sont listées ci-dessous avec leur type détecté, des exemples de valeurs, et un résumé statistique pour les colonnes numériques.\n\nColonnes :\n${JSON.stringify(filteredColumns, null, 2)}\n\nRègles :\n- Propose 1 à 3 graphiques maximum, chacun sous la forme {type, x, y, title, explanation}.\n- Ne propose que des croisements pertinents statistiquement ET métier (ex : "Coût par Département", "Nombre de membres par Chef d'équipe").\n- N'invente pas de croisements absurdes (ex : deux colonnes texte, deux dates, identifiants uniques, etc.).\n- Ignore les colonnes qui semblent être des identifiants uniques ou des codes.\n- Pour chaque graphique, explique en 1 phrase pourquoi il est pertinent pour un chef de projet SNCF.\n- Si aucune combinaison n'est pertinente, réponds [].\n\nExemples de graphiques pertinents :\n- Barres : "Coût" par "Département"\n- Camembert : "Nombre de membres" par "Chef d'équipe"\n- Courbe : "Coût" en fonction du temps (si une colonne date existe)\n\nRéponds uniquement en JSON, sans texte autour, sous la forme :\n[\n  { "type": "bar", "x": "Département", "y": "Coût", "title": "Répartition du coût par département", "explanation": "Permet de visualiser les coûts par service pour optimiser le budget." },\n  ...\n]`;
        const aiResp = await askOpenAI(prompt);
        let aiCharts = [];
        try {
          aiCharts = JSON.parse(aiResp.match(/\[([\s\S]*?)\]/)?.[0] || '[]');
        } catch { aiCharts = []; }
        if (!aiCharts.length) {
          const firstCat = filteredColumns.find(c => c.type === 'texte');
          const firstNum = filteredColumns.find(c => c.type === 'numérique');
          const firstDate = filteredColumns.find(c => c.type === 'date');
          if (firstCat && firstNum) {
            aiCharts.push({ type: 'bar', x: firstCat.name, y: firstNum.name, title: `Répartition ${firstNum.name} par ${firstCat.name}`, explanation: `Bar chart de ${firstNum.name} par ${firstCat.name}` });
            aiCharts.push({ type: 'pie', x: firstCat.name, y: firstNum.name, title: `Camembert ${firstNum.name} par ${firstCat.name}`, explanation: `Camembert de ${firstNum.name} par ${firstCat.name}` });
          }
          if (firstDate && firstNum) {
            aiCharts.push({ type: 'line', x: firstDate.name, y: firstNum.name, title: `Courbe ${firstNum.name} en fonction de ${firstDate.name}`, explanation: `Courbe de ${firstNum.name} en fonction de ${firstDate.name}` });
          }
        }
        charts = aiCharts;
        const preview = JSON.stringify(data);
        const statsStr = Object.keys(stats).length ? `\nStatistiques colonnes numériques: ${JSON.stringify(stats)}` : '';
        const promptSummary = PROMPTS.excel(preview + statsStr, excel.ext);
        const aiRespSummary = await askOpenAI(promptSummary);
        const jsonStart = aiRespSummary.indexOf("{");
        const jsonEnd = aiRespSummary.lastIndexOf("}") + 1;
        try {
          if (jsonStart !== -1 && jsonEnd > jsonStart) {
            aiData = JSON.parse(aiRespSummary.slice(jsonStart, jsonEnd));
          }
        } catch {}
      }
      const allCharts = [ ...(charts || []), ...autoCharts ];
      excelAnalysis.push({ key: excel.key, ...parsed, ...aiData, charts: allCharts, data });
    } catch (e: any) {
      console.error("[AI/Parsing][Excel]", { key: excel.key, error: e?.message, stack: e?.stack });
      excelAnalysis.push({ key: excel.key, error: "Erreur analyse Excel/CSV", details: e?.message });
    }
  }

  let pdfAnalysis: any[] = []
  for (const pdf of pdfFiles) {
    try {
      const prompt = PROMPTS.pdf(truncateText(pdf.text))
      const aiResp = await askOpenAI(prompt)
      const jsonStart = aiResp.indexOf("{")
      const jsonEnd = aiResp.lastIndexOf("}") + 1
      const jsonString = aiResp.slice(jsonStart, jsonEnd)
      const data = JSON.parse(jsonString)
      pdfAnalysis.push({ key: pdf.key, ...data })
    } catch (e: any) {
      console.error("[AI/Parsing][PDF]", { key: pdf.key, error: e?.message, stack: e?.stack, prompt: PROMPTS.pdf(truncateText(pdf.text)), response: e?.response || null })
      pdfAnalysis.push({ key: pdf.key, error: "Erreur IA ou parsing", details: e?.message })
    }
  }

  let txtAnalysis: any[] = []
  for (const txt of txtFiles) {
    try {
      const prompt = PROMPTS.txt(truncateText(txt.text))
      const aiResp = await askOpenAI(prompt)
      const jsonStart = aiResp.indexOf("{")
      const jsonEnd = aiResp.lastIndexOf("}") + 1
      const jsonString = aiResp.slice(jsonStart, jsonEnd)
      const data = JSON.parse(jsonString)
      txtAnalysis.push({ key: txt.key, ...data })
    } catch (e: any) {
      console.error("[AI/Parsing][TXT]", { key: txt.key, error: e?.message, stack: e?.stack, prompt: PROMPTS.txt(truncateText(txt.text)), response: e?.response || null })
      txtAnalysis.push({ key: txt.key, error: "Erreur IA ou parsing", details: e?.message })
    }
  }

  let globalData: any = {}
  if (globalText.trim().length > 0) {
    try {
      const prompt = PROMPTS.global(truncateText(globalText, 12000))
      const aiResponse = await askOpenAI(prompt)
      const jsonStart = aiResponse.indexOf("{")
      const jsonEnd = aiResponse.lastIndexOf("}") + 1
      const jsonString = aiResponse.slice(jsonStart, jsonEnd)
      globalData = JSON.parse(jsonString)
    } catch (e: any) {
      console.error("[AI/Parsing][Global]", { error: e?.message, stack: e?.stack, prompt: PROMPTS.global(truncateText(globalText, 12000)), response: e?.response || null })
      globalData = { error: "Erreur IA ou parsing: " + e?.message }
    }
  }

  return NextResponse.json({
    ...globalData,
    devisAnalysis,
    excelAnalysis,
    pdfAnalysis,
    txtAnalysis,
  })
}

export async function POST_custom_chart(req: Request) {
  try {
    const { key, query } = await req.json();
    if (!key || !query) {
      return NextResponse.json({ error: "Clé de fichier ou requête manquante" }, { status: 400 });
    }
    const { parseStructuredFile } = await import("@/lib/readCsv");
    const buffer = await getS3FileBuffer(key);
    const parsed = await parseStructuredFile(buffer, key);
    let data = Array.isArray(parsed.data) ? parsed.data.slice(0, 20) : [];
    if (data.length > 0) {
      const allCols = Object.keys(data[0]);
      const limitedCols = allCols.slice(0, 20);
      data = data.map(row => {
        const newRow: any = {};
        for (const col of limitedCols) newRow[col] = row[col];
        return newRow;
      });
    }
    const preview = JSON.stringify(data);
    const prompt = `Voici un extrait d'un tableau Excel :\n${preview}\nL'utilisateur demande : \"${query}\". Propose la configuration JSON du graphique le plus pertinent (type, x, y, titre, explication). Réponds uniquement en JSON strictement valide, sans texte autour, sans explication, sans balise.`;
    const aiResp = await askOpenAI(prompt);
    console.log("[AI RAW RESPONSE]", aiResp);
    let chartConfig = extractFirstJsonObject(aiResp);
    if (!chartConfig) {
      const reformulatedPrompt = `${prompt}\nRéponds uniquement par un objet JSON, sans aucun texte autour. Exemple : {\"type\":\"bar\",\"x\":\"Nom\",\"y\":\"Valeur\",\"title\":\"Titre\",\"explanation\":\"...\"}`;
      const aiResp2 = await askOpenAI(reformulatedPrompt);
      console.log("[AI RAW RESPONSE][Tentative 2]", aiResp2);
      chartConfig = extractFirstJsonObject(aiResp2);
      if (!chartConfig) {
        return NextResponse.json({ error: "Impossible d'extraire un JSON valide de la réponse IA.", details: aiResp2 }, { status: 400 });
      }
    }
    return NextResponse.json({ chart: chartConfig, data });
  } catch (e: any) {
    console.error("[AI/CustomChart][Excel]", { error: e?.message, stack: e?.stack });
    return NextResponse.json({ error: "Erreur lors de la génération du graphique personnalisé", details: e?.message }, { status: 500 });
  }
} 
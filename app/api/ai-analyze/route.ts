import { NextResponse } from "next/server"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import s3 from "@/lib/s3Client"
import pdfParse from "pdf-parse"
import OpenAI from "openai"
import path from "path"

// Si tu as une erreur 'Cannot find module "openai"', installe-le avec : npm install openai

// Helper pour lire un stream S3 en buffer (centralisé)
async function getS3FileBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME!,
    Key: key,
  })
  const response = await s3.send(command)
  // @ts-ignore
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

// Helper pour lire un fichier texte depuis S3
async function readTxtFromS3(key: string) {
  const buffer = await getS3FileBuffer(key)
  return buffer.toString("utf-8")
}

// Helper pour lire un PDF depuis S3
async function readPdfFromS3(key: string) {
  const buffer = await getS3FileBuffer(key)
  const data = await pdfParse(buffer)
  return data.text
}

// Helper pour lire un DOCX (placeholder)
async function readDocxFromS3(key: string) {
  return "[Lecture DOCX non implémentée dans cette démo]"
}

// Appel à l'API OpenAI avec retry
async function askOpenAI(prompt: string, maxRetries = 2): Promise<string> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  let lastError: any = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      })
      return completion.choices[0].message?.content || ""
    } catch (err) {
      lastError = err
      // Attendre avant de réessayer (exponentiel)
      if (attempt < maxRetries) {
        const delay = 500 * Math.pow(2, attempt) // 500ms, 1000ms
        await new Promise(res => setTimeout(res, delay))
      }
    }
  }
  // Si toutes les tentatives échouent, throw la dernière erreur
  throw lastError
}

// Centralisation des prompts OpenAI
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

// Utilitaire pour tronquer le texte à une longueur maximale
function truncateText(text: string, max: number = 8000) {
  return text.length > max ? text.slice(0, max) : text
}

// Mapping des extensions de fichiers vers leur handler
const FILE_HANDLERS: Record<string, (key: string) => Promise<string | Buffer>> = {
  pdf: readPdfFromS3,
  txt: readTxtFromS3,
  docx: readDocxFromS3,
  doc: readDocxFromS3,
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

  // Préparation des groupes de fichiers par type
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

  // Analyse des devis
  let devisAnalysis: any[] = []
  for (const devis of devisTexts) {
    try {
      const prompt = PROMPTS.devis(truncateText(devis.text))
      const aiResp = await askOpenAI(prompt)
      const jsonStart = aiResp.indexOf("{")
      const jsonEnd = aiResp.lastIndexOf("}") + 1
      const jsonString = aiResp.slice(jsonStart, jsonEnd)
      const data = JSON.parse(jsonString)
      devisAnalysis.push({ key: devis.key, ...data })
    } catch (e: any) {
      console.error("[AI/Parsing][Devis]", { key: devis.key, error: e?.message, stack: e?.stack, prompt: PROMPTS.devis(truncateText(devis.text)), response: e?.response || null })
      devisAnalysis.push({ key: devis.key, error: "Erreur IA ou parsing", details: e?.message })
    }
  }

  // Analyse Excel/CSV
  let excelAnalysis: any[] = []
  for (const excel of excelFiles) {
    try {
      const { parseStructuredFile } = await import("@/lib/readCsv")
      const parsed = await parseStructuredFile(excel.buffer, excel.key)
      let summary = parsed.summary || ""
      if (parsed.data && parsed.data.length > 0) {
        const preview = JSON.stringify(parsed.data.slice(0, 5))
        const prompt = PROMPTS.excel(preview, excel.ext)
        const aiResp = await askOpenAI(prompt)
        const jsonStart = aiResp.indexOf("{")
        const jsonEnd = aiResp.lastIndexOf("}") + 1
        const jsonString = aiResp.slice(jsonStart, jsonEnd)
        const aiData = JSON.parse(jsonString)
        excelAnalysis.push({ key: excel.key, ...parsed, ...aiData })
      } else {
        excelAnalysis.push({ key: excel.key, ...parsed })
      }
    } catch (e: any) {
      console.error("[AI/Parsing][Excel]", { key: excel.key, error: e?.message, stack: e?.stack })
      excelAnalysis.push({ key: excel.key, error: "Erreur analyse Excel/CSV", details: e?.message })
    }
  }

  // Analyse PDF hors devis
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

  // Analyse TXT hors devis
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

  // Synthèse globale (pour widget global)
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

  // Retourne toutes les analyses pour chaque widget
  return NextResponse.json({
    ...globalData,
    devisAnalysis,
    excelAnalysis,
    pdfAnalysis,
    txtAnalysis,
  })
} 
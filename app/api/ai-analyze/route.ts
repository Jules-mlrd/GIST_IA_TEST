import { NextResponse } from "next/server"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import s3 from "@/lib/s3Client"
import pdfParse from "pdf-parse"
import OpenAI from "openai"

// Si tu as une erreur 'Cannot find module "openai"', installe-le avec : npm install openai

// Helper pour lire un stream S3 en buffer
async function streamToBuffer(stream: any): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    stream.on("data", (chunk: Uint8Array) => chunks.push(chunk))
    stream.on("end", () => resolve(Buffer.concat(chunks)))
    stream.on("error", reject)
  })
}

// Helper pour lire un fichier texte depuis S3
async function readTxtFromS3(key: string) {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME!,
    Key: key,
  })
  const response = await s3.send(command)
  // @ts-ignore
  const stream = response.Body
  const buffer = await streamToBuffer(stream)
  return buffer.toString("utf-8")
}

// Helper pour lire un PDF depuis S3
async function readPdfFromS3(key: string) {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME!,
    Key: key,
  })
  const response = await s3.send(command)
  // @ts-ignore
  const stream = response.Body
  const buffer = await streamToBuffer(stream)
  const data = await pdfParse(buffer)
  return data.text
}

// Helper pour lire un DOCX (placeholder)
async function readDocxFromS3(key: string) {
  return "[Lecture DOCX non implémentée dans cette démo]"
}

// Appel à l'API OpenAI
async function askOpenAI(prompt: string) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  })
  return completion.choices[0].message?.content || ""
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

  let fullText = ""
  for (const key of keys) {
    const ext = key.split(".").pop()?.toLowerCase()
    if (ext === "pdf") {
      fullText += await readPdfFromS3(key)
    } else if (ext === "txt") {
      fullText += await readTxtFromS3(key)
    } else if (ext === "docx" || ext === "doc") {
      fullText += await readDocxFromS3(key)
    } else {
      fullText += `\n[Type de fichier non supporté: ${key}]\n`
    }
  }

  // Prompt IA pour analyse de documents projet
  const prompt = `Voici le contenu de documents de projet SNCF :\n\n"""\n${fullText.slice(0, 12000)}\n"""\n
Analyse ces documents et produis une synthèse avancée pour un dashboard projet.\n
1. Fais un résumé long, détaillé et structuré des points clés, des enjeux, des décisions, des risques, des jalons, des personnes impliquées, etc. (minimum 20 lignes, style rapport).
2. Identifie les indicateurs clés (KPIs) sous forme de liste label/valeur (ex : Budget utilisé, Avancement, Nombre de risques, etc.).
3. Liste toutes les alertes ou risques détectés (phrases courtes).
4. Dresse une liste structurée des personnes mentionnées (nom, statut ou rôle, contact si possible).
5. Dresse une timeline structurée des événements ou jalons (date, événement).

Réponds uniquement en JSON strictement formaté, avec les clés suivantes :\n- detailedSummary (string, long résumé détaillé)\n- kpis (array d'objets {label, value})\n- alerts (array de strings)\n- people (array d'objets {name, status, contact})\n- timeline (array d'objets {date, label})\n\nN'inclus aucun texte hors du JSON.\n\nExemple :\n{\n  "detailedSummary": "...",\n  "kpis": [{"label": "...", "value": "..."}],\n  "alerts": ["..."],\n  "people": [{"name": "...", "status": "...", "contact": "..."}],\n  "timeline": [{"date": "...", "label": "..."}]\n}`

  let aiResponse = ""
  try {
    aiResponse = await askOpenAI(prompt)
    // Tente de parser le JSON retourné par l'IA
    const jsonStart = aiResponse.indexOf("{")
    const jsonEnd = aiResponse.lastIndexOf("}") + 1
    const jsonString = aiResponse.slice(jsonStart, jsonEnd)
    const data = JSON.parse(jsonString)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: "Erreur IA ou parsing: " + (e as any).message, aiResponse }, { status: 500 })
  }
} 
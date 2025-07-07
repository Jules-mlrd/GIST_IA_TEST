import { NextRequest, NextResponse } from "next/server"
import { listPdfFilesInS3, fetchPdfTextFromS3 } from "@/lib/readPdf"
import { listTxtFilesInS3, fetchTxtContentFromS3 } from "@/lib/readTxt"

const BUCKET_NAME = "gism-documents"
const SUPPORTED_EXTENSIONS = ['.pdf', '.txt']
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"

const STRUCTURED_PROMPT = `Tu es un assistant expert en gestion de projet SNCF. À partir du texte ci-dessous, fais :\n1. Un résumé global, synthétique et professionnel du projet, en langage naturel, pour un chef de projet (champ globalSummary).\n2. Puis, si possible, extrais les informations structurées suivantes dans un objet JSON :\n- projectName, projectId\n- projectManager (nom, email, téléphone, entité)\n- client (nom, contact)\n- description synthétique du projet\n- objectifs (liste)\n- avancement (état, % si possible, résumé des dernières avancées)\n- budget (total, % utilisé, reste à consommer, alertes)\n- période (start, end, dates clés)\n- phases (liste : nom, statut, responsable, dates)\n- jalons (nom, date, statut, criticité)\n- risques (liste : description, criticité, responsable, actions)\n- points de blocage (liste)\n- prochaines actions (liste)\n- livrables attendus (liste)\n- parties prenantes (nom, rôle, contact)\n- contacts utiles (nom, rôle, email, téléphone)\n- alertes ou points d'attention\n- toute autre information pertinente pour le pilotage du projet\nSi tu ne trouves pas certaines infos, remplis au moins le champ globalSummary avec ta meilleure compréhension du projet. Retourne un objet JSON avec au moins le champ globalSummary.`

async function askOpenAIStructured(text: string) {
  const messages = [
    { role: "system", content: STRUCTURED_PROMPT },
    { role: "user", content: text }
  ]
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages,
      temperature: 0.2,
      max_tokens: 1500
    })
  })
  if (!response.ok) {
    let errorBody = ""
    try { errorBody = await response.text() } catch {}
    throw new Error(`Erreur OpenAI (status: ${response.status}) - ${errorBody}`)
  }
  const data = await response.json()
  return data.choices[0].message.content
}

async function mergeJsonSummaries(summaries: string[]) {
  const prompt = `Voici plusieurs objets JSON extraits de différents morceaux d'un même document projet SNCF. Fusionne-les intelligemment en un seul objet JSON complet, en gardant toutes les informations pertinentes et en évitant les doublons.`
  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: summaries.join("\n\n") }
  ]
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages,
      temperature: 0.2,
      max_tokens: 1800
    })
  })
  if (!response.ok) {
    let errorBody = ""
    try { errorBody = await response.text() } catch {}
    throw new Error(`Erreur OpenAI (merge) (status: ${response.status}) - ${errorBody}`)
  }
  const data = await response.json()
  return data.choices[0].message.content
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.get("list") === "1") {
      let pdfFiles: string[] = []
      let txtFiles: string[] = []
      try {
        pdfFiles = await listPdfFilesInS3(BUCKET_NAME)
        txtFiles = await listTxtFilesInS3(BUCKET_NAME)
      } catch (e) {
        console.error("Erreur lors de la récupération de la liste des fichiers S3:", e)
        return NextResponse.json({ error: "Erreur d'accès au bucket S3." }, { status: 500 })
      }
      return NextResponse.json({ files: [...pdfFiles, ...txtFiles] })
    }
    let pdfFiles: string[] = []
    let txtFiles: string[] = []
    try {
      pdfFiles = await listPdfFilesInS3(BUCKET_NAME)
      txtFiles = await listTxtFilesInS3(BUCKET_NAME)
    } catch (e) {
      console.error("Erreur lors de la récupération de la liste des fichiers S3:", e)
      return NextResponse.json({ error: "Erreur d'accès au bucket S3." }, { status: 500 })
    }
    const allFiles = [...pdfFiles, ...txtFiles]
    if (allFiles.length === 0) {
      return NextResponse.json({ error: "Aucun fichier disponible dans le bucket S3." }, { status: 404 })
    }
    const results = []
    for (const file of allFiles) {
      const ext = file.slice(file.lastIndexOf('.')).toLowerCase()
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        results.push({ file, error: `Type de fichier non supporté: ${ext}` })
        continue
      }
      let text = ""
      try {
        if (ext === '.pdf') {
          text = await fetchPdfTextFromS3(BUCKET_NAME, file)
        } else if (ext === '.txt') {
          text = await fetchTxtContentFromS3(BUCKET_NAME, file)
        }
      } catch (e: any) {
        results.push({ file, error: `Erreur lors de la lecture du fichier: ${e.message || e.toString()}` })
        continue
      }
      if (!text || text.trim() === "") {
        results.push({ file, error: `Le fichier est vide ou n'a pas pu être lu.` })
        continue
      }
      if (text.trim().startsWith("<!DOCTYPE")) {
        results.push({ file, error: `Le contenu du fichier semble être du HTML (erreur S3 ou parsing).` })
        continue
      }
      
      const chunkSize = 9000
      const chunks = []
      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize))
      }
      let summaries: string[] = []
      for (const chunk of chunks) {
        try {
          const aiResponse = await askOpenAIStructured(chunk)
          summaries.push(aiResponse)
        } catch (e: any) {
          results.push({ file, error: `Erreur OpenAI: ${e.message || e.toString()}` })
          continue
        }
      }
      let mergedSummary = summaries[0]
      if (summaries.length > 1) {
        try {
          mergedSummary = await mergeJsonSummaries(summaries)
        } catch (e: any) {
          results.push({ file, error: `Erreur fusion IA: ${e.message || e.toString()}` })
          continue
        }
      }
      let summaryJson
      try {
        summaryJson = JSON.parse(mergedSummary)
      } catch {
        summaryJson = { error: "Impossible de parser la réponse IA", raw: mergedSummary }
      }
      if (!summaryJson.globalSummary && typeof mergedSummary === 'string') {
        summaryJson.globalSummary = mergedSummary
      }
      results.push({ file, summary: summaryJson })
    }
    return NextResponse.json({ summaries: results })
  } catch (e: any) {
    console.error("ERREUR API PROJECT SUMMARY:", e)
    return NextResponse.json({ error: e.message || e.toString() }, { status: 500 })
  }
} 
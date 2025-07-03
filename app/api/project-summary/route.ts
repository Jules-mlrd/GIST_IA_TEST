import { NextRequest, NextResponse } from "next/server"
import { listPdfFilesInS3, fetchPdfTextFromS3 } from "@/lib/readPdf"
import { listTxtFilesInS3, fetchTxtContentFromS3 } from "@/lib/readTxt"

const BUCKET_NAME = "gism-documents"
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"

const SYSTEM_PROMPT = `Tu es un assistant qui extrait les informations clés d'un projet ferroviaire à partir de documents. Pour chaque projet, retourne un objet JSON avec les champs suivants :\n- projectId\n- projectName\n- projectManager (nom)\n- period (start, end)\n- client\n- objectives (liste)\n- description\n- phases (liste d'objets : name, status, date)\n- progress (en %)\n- nextDeadline (date, phase)\n- budget (usedPercent, total)\n\nSi une information n'est pas trouvée, laisse le champ vide ou null.`

async function askOpenAI(text: string) {
  const limitedText = text.slice(0, 2000)
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: limitedText }
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
      max_tokens: 800
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

async function extractTextFromS3Files() {
  const pdfFiles = await listPdfFilesInS3(BUCKET_NAME)
  const txtFiles = await listTxtFilesInS3(BUCKET_NAME)
  let allText = ""
  for (const file of pdfFiles) {
    try {
      const text = await fetchPdfTextFromS3(BUCKET_NAME, file)
      allText += `\n\n--- Fichier: ${file} ---\n` + text
    } catch (e) {
      allText += `\n\n--- Fichier: ${file} ---\n[Erreur de lecture PDF]`
    }
  }
  for (const file of txtFiles) {
    try {
      const text = await fetchTxtContentFromS3(BUCKET_NAME, file)
      allText += `\n\n--- Fichier: ${file} ---\n` + text
    } catch (e) {
      allText += `\n\n--- Fichier: ${file} ---\n[Erreur de lecture TXT]`
    }
  }
  return allText
}

export async function GET(req: NextRequest) {
  try {
    const allText = await extractTextFromS3Files()
    const aiResponse = await askOpenAI(allText)
    let summary
    try {
      summary = JSON.parse(aiResponse)
    } catch {
      summary = { error: "Impossible de parser la réponse IA", raw: aiResponse }
    }
    return NextResponse.json(summary)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || e.toString() }, { status: 500 })
  }
} 
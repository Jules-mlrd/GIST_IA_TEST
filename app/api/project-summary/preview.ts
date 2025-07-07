import { NextRequest, NextResponse } from "next/server"
import { listPdfFilesInS3, fetchPdfTextFromS3 } from "@/lib/readPdf"
import { listTxtFilesInS3, fetchTxtContentFromS3 } from "@/lib/readTxt"

const BUCKET_NAME = "gism-documents"
const SUPPORTED_EXTENSIONS = ['.pdf', '.txt']

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const fileParam = searchParams.get("file")
    if (!fileParam || typeof fileParam !== "string" || !fileParam.trim()) {
      return NextResponse.json({ error: "Aucun fichier sélectionné." }, { status: 400 })
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
    const file = allFiles.find(f => f === fileParam)
    if (!file) {
      return NextResponse.json({ error: `Fichier demandé non trouvé: ${fileParam}` }, { status: 400 })
    }
    const ext = file.slice(file.lastIndexOf('.')).toLowerCase()
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: `Type de fichier non supporté: ${ext} (fichier: ${file}). Extensions supportées: ${SUPPORTED_EXTENSIONS.join(', ')}` }, { status: 400 })
    }
    let text = ""
    try {
      if (ext === '.pdf') {
        text = await fetchPdfTextFromS3(BUCKET_NAME, file)
      } else if (ext === '.txt') {
        text = await fetchTxtContentFromS3(BUCKET_NAME, file)
      }
    } catch (e: any) {
      console.error(`Erreur lors de la lecture du fichier ${file}:`, e)
      return NextResponse.json({ error: `Erreur lors de la lecture du fichier: ${e.message || e.toString()}` }, { status: 500 })
    }
    if (!text || text.trim() === "") {
      return NextResponse.json({ error: `Le fichier est vide ou n'a pas pu être lu (${file}).` }, { status: 500 })
    }
    if (text.trim().startsWith("<!DOCTYPE")) {
      return NextResponse.json({ error: `Le contenu du fichier semble être du HTML (erreur S3 ou parsing) pour le fichier: ${file}` }, { status: 500 })
    }
    const preview = text.slice(0, 500)
    return NextResponse.json({ preview })
  } catch (e: any) {
    console.error("ERREUR API PREVIEW:", e)
    return NextResponse.json({ error: e.message || e.toString() }, { status: 500 })
  }
} 
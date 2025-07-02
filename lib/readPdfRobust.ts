import pdfParse from "pdf-parse";
import { createWorker } from "tesseract.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import s3 from "@/lib/s3Client";
import { PDFDocument } from "pdf-lib";

// Extraction PDF robuste avec OCR fallback
export async function extractPdfTextRobust(buffer: Buffer): Promise<string> {
  // 1. Extraction classique
  let text = "";
  try {
    const data = await pdfParse(buffer);
    text = data.text || "";
  } catch (e) {
    text = "";
  }

  // 2. Si texte trop court, fallback OCR
  if (!text || text.replace(/\s+/g, "").length < 50) {
    try {
      const pdfDoc = await PDFDocument.load(buffer);
      const numPages = pdfDoc.getPageCount();
      const worker = await createWorker("fra"); // ou "eng" selon la langue
      let ocrText = "";
      for (let i = 0; i < numPages; i++) {
        // pdf-lib ne permet pas de rendre en image directement côté Node.js
        // Il faut une lib comme pdf2pic, pdf-poppler, ou passer par un service externe
        // Ici, on laisse un placeholder pour l'OCR par page
        ocrText += `[OCR page ${i + 1} non implémenté ici]`;
      }
      await worker.terminate();
      text = ocrText;
    } catch (e) {
      text = "";
    }
  }

  // 3. Nettoyage du texte
  text = text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, "    ")
    .replace(/\n{2,}/g, "\n")
    .replace(/[•·●]/g, "-")
    .trim();

  return text;
}

// Exemple d'utilisation avec S3
export async function readPdfFromS3Robust(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME!,
    Key: key,
  });
  const response = await s3.send(command);
  const stream = response.Body;
  if (!stream) throw new Error("S3 stream non disponible pour " + key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);
  return await extractPdfTextRobust(buffer);
} 
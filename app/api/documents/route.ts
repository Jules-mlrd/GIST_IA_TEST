import { NextResponse } from "next/server"
import { ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import s3, { generatePresignedUrl } from "@/lib/s3Client"
import JSZip from "jszip"

export async function GET() {
  try {
    const data = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.AWS_BUCKET_NAME!,
      })
    )

    const documents = await Promise.all(
      (data.Contents || []).map(async (file) => {
        const key = file.Key!
        const url = await generatePresignedUrl(key)
        return {
          name: key.split("/").pop(),
          key,
          size: (file.Size! / 1000).toFixed(1) + " KB",
          lastModified: file.LastModified?.toISOString().split("T")[0],
          type: key.split(".").pop(),
          url,
        }
      })
    )

    return NextResponse.json({ documents })
  } catch (error) {
    console.error("Erreur lors de la récupération des fichiers S3:", error)
    return new NextResponse("Erreur interne du serveur", { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { key } = await req.json();
    if (!key) {
      return new NextResponse("Clé de fichier manquante", { status: 400 });
    }
    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: key,
      })
    );
    return NextResponse.json({ message: "Fichier supprimé" });
  } catch (error) {
    console.error("Erreur lors de la suppression du fichier S3:", error);
    return new NextResponse("Erreur lors de la suppression du fichier", { status: 500 });
  }
}

export async function POST(req: Request) {
  const { keys } = await req.json();
  if (!Array.isArray(keys) || keys.length === 0) {
    return NextResponse.json({ error: "Aucune clé de fichier fournie" }, { status: 400 });
  }
  const zip = new JSZip();
  for (const key of keys) {
    try {
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: key,
      });
      const response = await s3.send(command);
      const stream = response.Body as any; 
      if (!stream || typeof stream[Symbol.asyncIterator] !== "function") {
        zip.file(key.split("/").pop() + ".error.txt", `Erreur: flux S3 non disponible ou non itérable pour ${key}`);
        continue;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of stream as any) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);
      const name = key.split("/").pop() || key;
      zip.file(name, buffer);
    } catch (e) {
      zip.file(key.split("/").pop() + ".error.txt", `Erreur lors de l'export du fichier: ${(e as any).message}`);
    }
  }
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  return new Response(zipBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename=export_documents.zip`,
    },
  });
}

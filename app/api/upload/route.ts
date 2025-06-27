// app/api/upload/route.ts
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import s3 from "@/lib/s3Client";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  const formData = await req.formData();
  const files = formData.getAll("file").filter(Boolean) as File[];

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
  }

  const uploaded: { fileName: string, url?: string, error?: string }[] = [];
  for (const file of files) {
    const allowedTypes = ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "text/csv", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowedTypes.includes(file.type)) {
      uploaded.push({ fileName: file.name, error: "Type de fichier non supporté" });
      continue;
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${uuidv4()}-${file.name}`;
    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: `documents/${fileName}`,
      Body: buffer,
      ContentType: file.type,
    };
    try {
      await s3.send(new PutObjectCommand(uploadParams));
      uploaded.push({ fileName });
    } catch (err) {
      console.error("Erreur upload S3:", err);
      uploaded.push({ fileName: file.name, error: "Échec de l'upload" });
    }
  }
  return NextResponse.json({ uploaded });
}

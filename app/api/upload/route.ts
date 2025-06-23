// app/api/upload/route.ts
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import s3 from "@/lib/s3Client";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
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
    return NextResponse.json({ message: "Upload réussi", fileName });
  } catch (err) {
    console.error("Erreur upload S3:", err);
    return NextResponse.json({ error: "Échec de l'upload" }, { status: 500 });
  }
}

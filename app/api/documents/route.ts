import { NextResponse } from "next/server"
import { ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3"
import s3, { generatePresignedUrl } from "@/lib/s3Client"

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

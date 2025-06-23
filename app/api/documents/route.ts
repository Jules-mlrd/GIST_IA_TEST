import { NextResponse } from "next/server"
import { ListObjectsV2Command } from "@aws-sdk/client-s3"
import s3, { generatePresignedUrl } from "@/lib/s3Client"

export async function GET() {
  try {
    const data = await s3.send(
      new ListObjectsV2Command({
        Bucket: "gism-documents",
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

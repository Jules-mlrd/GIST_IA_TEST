import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const s3 = new S3Client({
  region: "eu-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function generatePresignedUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: "gism-documents",
    Key: key,
  })

  const url = await getSignedUrl(s3, command, { expiresIn: 3600 }) // 1h
  return url
}

export default s3

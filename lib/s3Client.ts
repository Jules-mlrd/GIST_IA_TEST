import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
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

// Fetch and parse CSV credentials from S3
export async function fetchUserCredentialsFromS3() {
  const command = new GetObjectCommand({
    Bucket: "liste-utilisateurs",
    Key: "utilisateurs.csv", // Adjust if your file has a different name
  })
  try {
    const response = await s3.send(command)
    // @ts-ignore
    const stream = response.Body
    const text = await streamToString(stream)
    const credentials: Record<string, string> = {}
    text.split("\n").forEach((line) => {
      // Remove carriage returns and trim
      const cleanLine = line.replace(/\r/g, "").trim()
      if (!cleanLine) return // skip empty lines
      const [username, password] = cleanLine.split(",")
      if (username && password) {
        credentials[username.trim()] = password.trim()
      }
    })
    return credentials
  } catch (err) {
    console.error("Failed to fetch credentials from S3:", err)
    return null
  }
}

export async function writeJsonToS3(bucket: string, key: string, data: any) {
  const body = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: 'application/json',
  });
  await s3.send(command);
}

export async function readJsonFromS3(bucket: string, key: string): Promise<any | null> {
  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const data = await s3.send(command);
    if (!data.Body) return null;
    const chunks: Buffer[] = [];
    for await (const chunk of data.Body as any) {
      chunks.push(Buffer.from(chunk));
    }
    const jsonStr = Buffer.concat(chunks).toString('utf-8');
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

// Helper to convert stream to string (Node.js ReadableStream)
async function streamToString(stream: any): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    stream.on("data", (chunk: Uint8Array) => chunks.push(chunk))
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
    stream.on("error", reject)
  })
}

export default s3

import { NextRequest, NextResponse } from "next/server"
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"

const s3 = new S3Client({
  region: "eu-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

async function streamToString(stream: any): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    stream.on("data", (chunk: Uint8Array) => chunks.push(chunk))
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
    stream.on("error", reject)
  })
}

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  const command = new GetObjectCommand({
    Bucket: "liste-utilisateurs",
    Key: "utilisateurs.csv",
  })

  try {
    const response = await s3.send(command)
    // @ts-ignore
    const stream = response.Body
    const text = await streamToString(stream)
    let valid = false
    text.split("\n").forEach((line) => {
      const cleanLine = line.replace(/\r/g, "").trim()
      if (!cleanLine) return
      const [csvUser, csvPass] = cleanLine.split(",")
      if (
        csvUser &&
        csvPass &&
        csvUser.trim() === username.trim() &&
        csvPass.trim() === password.trim()
      ) {
        valid = true
      }
    })
    return NextResponse.json({ valid })
  } catch (err) {
    return NextResponse.json({ valid: false, error: "S3 error" }, { status: 500 })
  }
}

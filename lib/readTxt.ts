import fs from 'fs'
import path from 'path'
import s3 from "./s3Client";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import * as cheerio from "cheerio";

export function readTxtContent(): string {
  const txtFolder = path.join(process.cwd(), 'public', 'document')

  if (!fs.existsSync(txtFolder)) {
    throw new Error(`Le dossier "${txtFolder}" est introuvable.`)
  }

  const files = fs.readdirSync(txtFolder).filter(file => file.endsWith('.txt'))

  if (files.length === 0) {
    throw new Error('Aucun fichier TXT trouvé.')
  }

  let allText = ''

  for (const file of files) {
    const filePath = path.join(txtFolder, file)
    const data = fs.readFileSync(filePath, 'utf-8')
    allText += `\n\n---\n\n[${file}]\n${data}`
  }

  return allText
}

// S3-based TXT file listing
export async function listTxtFilesInS3(bucketName: string): Promise<string[]> {
  try {
    const command = new ListObjectsV2Command({ Bucket: bucketName });
    const data = await s3.send(command);
    return (data.Contents || [])
      .filter((item: any) => item.Key && item.Key.endsWith('.txt'))
      .map((item: any) => item.Key!);
  } catch (error) {
    console.error('Error listing TXT files in S3:', error);
    throw new Error('Failed to list TXT files in S3.');
  }
}

// S3-based TXT file reading
export async function fetchTxtContentFromS3(bucketName: string, fileKey: string): Promise<string> {
  try {
    const command = new GetObjectCommand({ Bucket: bucketName, Key: fileKey });
    const data = await s3.send(command);
    if (!data.Body) throw new Error('S3 object Body is undefined.');
    const chunks: Buffer[] = [];
    for await (const chunk of data.Body as any) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
  } catch (error) {
    console.error('Error fetching TXT from S3:', error);
    throw new Error('Failed to fetch TXT from S3.');
  }
}

export async function fetchHtmlTextFromS3(bucketName: string, fileKey: string): Promise<string> {
  try {
    const html = await fetchTxtContentFromS3(bucketName, fileKey);
    const $ = cheerio.load(html);
    // On extrait le texte du body, ou tout le texte si besoin
    return $("body").text() || $.text();
  } catch (error) {
    console.error('Error fetching HTML from S3:', error);
    throw new Error('Failed to fetch HTML from S3.');
  }
}

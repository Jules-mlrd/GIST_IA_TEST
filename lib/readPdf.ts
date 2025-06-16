import s3 from "./s3Client";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import pdfParse from "pdf-parse";

/**
 * Extracts text from a PDF file stored in an S3 bucket.
 * @param bucketName - The name of the S3 bucket.
 * @param fileKey - The key of the PDF file in the S3 bucket.
 * @returns The extracted text as a string.
 */
export async function fetchPdfTextFromS3(bucketName: string, fileKey: string): Promise<string> {
  try {
    const command = new GetObjectCommand({ Bucket: bucketName, Key: fileKey });
    const data = await s3.send(command);

    if (!data.Body) {
      throw new Error('S3 object Body is undefined.');
    }
    // Read the stream into a buffer
    const chunks: Buffer[] = [];
    for await (const chunk of data.Body as any) {
      chunks.push(Buffer.from(chunk));
    }
    const pdfBuffer = Buffer.concat(chunks);
    const text = await extractTextFromPdf(pdfBuffer);
    return text;
  } catch (error) {
    console.error('Error fetching or processing PDF:', error);
    throw new Error('Failed to fetch or process PDF.');
  }
}

/**
 * Extracts text from a PDF buffer using pdf-parse.
 * @param pdfBuffer - The buffer of the PDF file.
 * @returns The extracted text as a string.
 */
export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(pdfBuffer);
    return data.text;
  } catch (err) {
    console.error("Error extracting text from PDF:", err);
    throw new Error("Unable to read PDF file.");
  }
}

/**
 * Lists all PDF files in an S3 bucket.
 * @param bucketName - The name of the S3 bucket.
 * @returns An array of PDF file keys in the S3 bucket.
 */
export async function listPdfFilesInS3(bucketName: string): Promise<string[]> {
  try {
    const command = new ListObjectsV2Command({ Bucket: bucketName });
    const data = await s3.send(command);

    return (data.Contents || [])
      .filter((item: any) => item.Key && item.Key.endsWith('.pdf'))
      .map((item: any) => item.Key!);
  } catch (error) {
    console.error('Error listing PDF files in S3:', error);
    throw new Error('Failed to list PDF files in S3.');
  }
}

import s3 from "./s3Client";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { extractPdfTextRobust } from "./readPdfRobust";

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
    const text = await extractPdfTextRobust(pdfBuffer);
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
  return extractPdfTextRobust(pdfBuffer);
}

/**
 * Lists all PDF files in an S3 bucket, optionally under a prefix.
 * @param bucketName - The name of the S3 bucket.
 * @param prefix - Optional prefix to filter files (e.g. 'affaires/12345/')
 * @returns An array of PDF file keys in the S3 bucket.
 */
export async function listPdfFilesInS3(bucketName: string, prefix?: string): Promise<string[]> {
  try {
    const command = new ListObjectsV2Command({ Bucket: bucketName, Prefix: prefix });
    const data = await s3.send(command);
    return (data.Contents || [])
      .filter((item: any) => item.Key && item.Key.endsWith('.pdf'))
      .map((item: any) => item.Key!);
  } catch (error) {
    console.error('Error listing PDF files in S3:', error);
    throw new Error('Failed to list PDF files in S3.');
  }
}

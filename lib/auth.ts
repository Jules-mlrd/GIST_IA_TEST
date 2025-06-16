import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
const Papa = require('papaparse');
const { Readable } = require('stream');
const bcrypt = require('bcryptjs');

const BUCKET_NAME = process.env.S3_USER_BUCKET || 'liste-utilisateurs';
const CLIENTS_FILE = process.env.S3_CLIENTS_FILE || 'clients.csv';
const COLLABS_FILE = process.env.S3_COLLABS_FILE || 'collaborateurs.csv';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'eu-central-1', // Ensure the region matches the bucket's region
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function fetchCsvFromS3(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
  const { Body } = await s3.send(command);
  const stream = Body as any; // Use 'any' to avoid type error
  return new Promise((resolve, reject) => {
    let data = '';
    stream.on('data', (chunk: any) => (data += chunk));
    stream.on('end', () => resolve(data));
    stream.on('error', reject);
  });
}

function parseCsv(csv: string) {
  // Parse as raw rows, no header, only first two columns used
  return (Papa.parse(csv.trim(), { header: false, skipEmptyLines: true }).data as string[][])
    .map(row => [row[0]?.trim(), row[1]?.trim()]);
}

export async function getUserFromS3(username: string, password: string) {
  const [clientsCsv, collabsCsv] = await Promise.all([
    fetchCsvFromS3(CLIENTS_FILE),
    fetchCsvFromS3(COLLABS_FILE),
  ]);
  const users = [
    ...parseCsv(clientsCsv).map(([u, p]) => ({ username: u, password: p, role: 'client' })),
    ...parseCsv(collabsCsv).map(([u, p]) => ({ username: u, password: p, role: 'collaborateur' })),
  ];
  for (const user of users) {
    if (!user.username || !user.password) continue;
    if (user.username === username && user.password === password) {
      return user;
    }
    // For future: if password starts with $2 (bcrypt hash), use bcrypt.compare
    if (user.username === username && user.password.startsWith('$2')) {
      if (await bcrypt.compare(password, user.password)) return user;
    }
  }
  return null;
}

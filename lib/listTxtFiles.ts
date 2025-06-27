import fs from 'fs';
import path from 'path';

export function listTxtFiles(): string[] {
  const txtFolder = path.join(process.cwd(), 'public', 'document');
  if (!fs.existsSync(txtFolder)) return [];
  return fs.readdirSync(txtFolder).filter(file => file.endsWith('.txt'));
}

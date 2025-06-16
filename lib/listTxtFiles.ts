import fs from 'fs';
import path from 'path';

/**
 * Returns a list of TXT document filenames in the public/document folder.
 */
export function listTxtFiles(): string[] {
  const txtFolder = path.join(process.cwd(), 'public', 'document');
  if (!fs.existsSync(txtFolder)) return [];
  return fs.readdirSync(txtFolder).filter(file => file.endsWith('.txt'));
}

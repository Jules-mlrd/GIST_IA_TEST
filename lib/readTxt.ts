// lib/readTxt.ts
import fs from 'fs'
import path from 'path'

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

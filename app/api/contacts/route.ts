import { NextResponse } from 'next/server';
import { listPdfFilesInS3, fetchPdfTextFromS3 } from '@/lib/readPdf';
import { listTxtFilesInS3, fetchTxtContentFromS3 } from '@/lib/readTxt';
import { extractContactsWithLLM } from '@/lib/utils';
import fs from 'fs';
import path from 'path';

const BUCKET_NAME = 'gism-documents';
const CONTACTS_FILE = path.join(process.cwd(), 'manual-contacts.json');
const EXTRACTED_CONTACTS_FILE = path.join(process.cwd(), 'extracted-contacts.json');

function readManualContacts(): any[] {
  try {
    if (!fs.existsSync(CONTACTS_FILE)) return [];
    const data = fs.readFileSync(CONTACTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeManualContacts(contacts: any[]) {
  fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2), 'utf-8');
}

function readExtractedContacts(): any[] {
  try {
    if (!fs.existsSync(EXTRACTED_CONTACTS_FILE)) return [];
    const data = fs.readFileSync(EXTRACTED_CONTACTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeExtractedContacts(contacts: any[]) {
  fs.writeFileSync(EXTRACTED_CONTACTS_FILE, JSON.stringify(contacts, null, 2), 'utf-8');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.email && !body.telephone) {
      return NextResponse.json({ error: 'Email ou téléphone requis.' }, { status: 400 });
    }
    const contacts = readManualContacts();
    const id = body.email || body.telephone;
    if (contacts.some((c: any) => (c.email || c.telephone) === id)) {
      return NextResponse.json({ error: 'Contact déjà existant.' }, { status: 400 });
    }
    contacts.push(body);
    writeManualContacts(contacts);
    return NextResponse.json({ success: true, contact: body });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de l\'ajout du contact.' }, { status: 500 });
  }
}

export async function GET() {
  try {
    let contacts = readExtractedContacts();
    if (!contacts.length) {
      const [pdfFiles, txtFiles] = await Promise.all([
        listPdfFilesInS3(BUCKET_NAME),
        listTxtFilesInS3(BUCKET_NAME),
      ]);
      const allFiles = [
        ...pdfFiles.map((key) => ({ key, type: 'pdf' })),
        ...txtFiles.map((key) => ({ key, type: 'txt' })),
      ];
      const texts = await Promise.all(
        allFiles.map(async ({ key, type }) => {
          try {
            if (type === 'pdf') {
              return await fetchPdfTextFromS3(BUCKET_NAME, key);
            } else {
              return await fetchTxtContentFromS3(BUCKET_NAME, key);
            }
          } catch (e) {
            return '';
          }
        })
      );
      const contactsArrays = await Promise.all(
        texts.map(async (text) => {
          if (!text || text.length < 30) return [];
          try {
            return await extractContactsWithLLM(text);
          } catch {
            return [];
          }
        })
      );
      contacts = contactsArrays.flat();
      writeExtractedContacts(contacts);
    }
    const uniqueContacts = [];
    const seen = new Set();
    const manualContacts = readManualContacts();
    for (const c of manualContacts) {
      const id = c.email || c.telephone;
      if (id && !seen.has(id)) {
        uniqueContacts.push(c);
        seen.add(id);
      }
    }
    // Puis les contacts IA (cache)
    for (const c of contacts) {
      const id = c.email || c.telephone;
      if (id && !seen.has(id)) {
        uniqueContacts.push(c);
        seen.add(id);
      }
    }
    return NextResponse.json({ contacts: uniqueContacts });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de l\'extraction des contacts.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { email, telephone } = await req.json();
    if (!email && !telephone) {
      return NextResponse.json({ error: 'Email ou téléphone requis.' }, { status: 400 });
    }
    let contacts = readManualContacts();
    const before = contacts.length;
    contacts = contacts.filter((c: any) => {
      if (email && c.email === email) return false;
      if (telephone && c.telephone === telephone) return false;
      return true;
    });
    if (contacts.length === before) {
      return NextResponse.json({ error: 'Contact non trouvé.' }, { status: 404 });
    }
    writeManualContacts(contacts);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la suppression du contact.' }, { status: 500 });
  }
}

export async function POST_refresh(_: Request) {
  try {
    const [pdfFiles, txtFiles] = await Promise.all([
      listPdfFilesInS3(BUCKET_NAME),
      listTxtFilesInS3(BUCKET_NAME),
    ]);
    const allFiles = [
      ...pdfFiles.map((key) => ({ key, type: 'pdf' })),
      ...txtFiles.map((key) => ({ key, type: 'txt' })),
    ];
    const texts = await Promise.all(
      allFiles.map(async ({ key, type }) => {
        try {
          if (type === 'pdf') {
            return await fetchPdfTextFromS3(BUCKET_NAME, key);
          } else {
            return await fetchTxtContentFromS3(BUCKET_NAME, key);
          }
        } catch (e) {
          return '';
        }
      })
    );
    const contactsArrays = await Promise.all(
      texts.map(async (text) => {
        if (!text || text.length < 30) return [];
        try {
          return await extractContactsWithLLM(text);
        } catch {
          return [];
        }
      })
    );
    const contacts = contactsArrays.flat();
    writeExtractedContacts(contacts);
    return NextResponse.json({ success: true, count: contacts.length });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors du rafraîchissement du cache IA.' }, { status: 500 });
  }
} 
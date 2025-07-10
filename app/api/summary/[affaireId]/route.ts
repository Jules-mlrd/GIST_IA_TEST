import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { fetchPdfTextFromS3 } from '@/lib/readPdf';
import { fetchTxtContentFromS3 } from '@/lib/readTxt';

async function getAffaireData(affaireId: string): Promise<any> {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'DevMySQL2024!',
    database: 'gestion_affaires',
  });
  const [rows] = await connection.execute('SELECT * FROM affaires WHERE numero_affaire = ?', [affaireId]);
  await connection.end();
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Affaire non trouvée');
  return rows[0];
}

async function extractFileText(bucket: string, affaireId: string, fileKey: string): Promise<string> {
  const key = `affaires/${affaireId}/${fileKey}`;
  const fileType = fileKey.split('.').pop()?.toLowerCase();
  if (fileType === 'pdf') {
    return await fetchPdfTextFromS3(bucket, key);
  } else if (fileType === 'txt') {
    return await fetchTxtContentFromS3(bucket, key);
  } else {
    return '';
  }
}

async function summarizeWithOpenAI(text: string): Promise<string> {
  const prompt = `Voici la fiche d'une affaire SNCF, suivie éventuellement de documents joints. Résume de façon synthétique et structurée les points importants, objectifs, risques, et informations clés pour un chef de projet.\n\n${text}`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Tu es un assistant qui résume des fiches projet SNCF.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 400,
    }),
  });
  if (!response.ok) throw new Error('Erreur OpenAI');
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function POST(req: NextRequest, { params }: { params: { affaireId: string } }) {
  const affaireId = params.affaireId;
  try {
    const { files } = await req.json(); // files: array of fileKey
    const affaire = await getAffaireData(affaireId);
    let context = `Titre: ${affaire.titre}\nPortefeuille: ${affaire.portefeuille_projet}\nClient: ${affaire.client}\nType de demande: ${affaire.type_demande}\nRéférent: ${affaire.referent}\nGuichet: ${affaire.guichet}\nPorteur: ${affaire.porteur}\nType de mission: ${affaire.type_mission}\nRisque environnemental: ${affaire.risque_environnemental}\nCommentaires environnementaux: ${affaire.commentaires_env}\nDemandeur/MOEG: ${affaire.contact_moa_moeg}\nMOA: ${affaire.client}\nSites: ${affaire.site}\nDescription technique: ${affaire.description_technique}\nCode C6: ${affaire.code_c6}\nFEM-ESTI: ${affaire.fem_esti}\nEtat: ${affaire.etat}\nSA: ${affaire.sa}\nType de comptes: ${affaire.compte_projet}\nType décret: ${affaire.type_decret}\nContact sur site: ${affaire.contact_site}\nMesure environnementale: ${affaire.mesure_env}`;
    // Ajout du texte des fichiers sélectionnés
    if (Array.isArray(files) && files.length > 0) {
      const bucket = process.env.AWS_BUCKET_NAME || '';
      for (const fileKey of files) {
        const fileText = await extractFileText(bucket, affaireId, fileKey);
        if (fileText) {
          context += `\n\n---\nContenu du fichier ${fileKey}:\n${fileText}`;
        }
      }
    }
    const summary = await summarizeWithOpenAI(context);
    return NextResponse.json({ affaireId, summary, source: 'affaire+files' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { affaireId: string } }) {
  const affaireId = params.affaireId;
  try {
    const affaire = await getAffaireData(affaireId);
    let context = `Titre: ${affaire.titre}\nPortefeuille: ${affaire.portefeuille_projet}\nClient: ${affaire.client}\nType de demande: ${affaire.type_demande}\nRéférent: ${affaire.referent}\nGuichet: ${affaire.guichet}\nPorteur: ${affaire.porteur}\nType de mission: ${affaire.type_mission}\nRisque environnemental: ${affaire.risque_environnemental}\nCommentaires environnementaux: ${affaire.commentaires_env}\nDemandeur/MOEG: ${affaire.contact_moa_moeg}\nMOA: ${affaire.client}\nSites: ${affaire.site}\nDescription technique: ${affaire.description_technique}\nCode C6: ${affaire.code_c6}\nFEM-ESTI: ${affaire.fem_esti}\nEtat: ${affaire.etat}\nSA: ${affaire.sa}\nType de comptes: ${affaire.compte_projet}\nType décret: ${affaire.type_decret}\nContact sur site: ${affaire.contact_site}\nMesure environnementale: ${affaire.mesure_env}`;
    const summary = await summarizeWithOpenAI(context);
    return NextResponse.json({ affaireId, summary, source: 'affaire' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
} 
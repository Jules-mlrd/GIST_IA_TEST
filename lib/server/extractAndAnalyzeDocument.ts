import { fetchPdfTextFromS3 } from '../readPdf';
import { parseStructuredFile } from '../readCsv';
import s3 from '../s3Client';
import { getEmbeddingOpenAI } from '../utils';
import { setCache } from '../utils';

export async function extractAndAnalyzeDocument(buffer: Buffer, fileName: string, mimeType: string) {
  try {
    let text = '';
    let summary = '';
    let entities = [];
    let embedding: number[] = [];
    // Extraction du texte selon le type
    if (/pdf/i.test(mimeType) || fileName.endsWith('.pdf')) {
      // Upload temporaire dans S3 pour extraction
      const tempKey = `temp/${fileName}`;
      await s3.send(new (require('@aws-sdk/client-s3').PutObjectCommand)({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: tempKey,
        Body: buffer,
        ContentType: mimeType,
      }));
      text = await fetchPdfTextFromS3(process.env.AWS_BUCKET_NAME!, tempKey);
      // Optionnel : supprimer le fichier temporaire
    } else if (/text\//i.test(mimeType) || fileName.endsWith('.txt')) {
      text = buffer.toString('utf-8');
    } else if (/csv|excel|spreadsheet/i.test(mimeType) || /\.(csv|xlsx|xls)$/i.test(fileName)) {
      const parsed = await parseStructuredFile(buffer, fileName);
      if (parsed.error) return { error: parsed.error };
      text = parsed.summary + '\n' + JSON.stringify(parsed.data.slice(0, 5));
    } else {
      return { error: 'Type de fichier non supporté pour la pré-analyse.' };
    }
    // Génération de l'embedding
    embedding = await getEmbeddingOpenAI(text.slice(0, 2000));
    // Génération du résumé
    const summaryPrompt = `Résume de façon synthétique et structurée le contenu suivant :\n${text.slice(0, 4000)}`;
    const summaryResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'Tu es un assistant qui résume des documents.' },
          { role: 'user', content: summaryPrompt },
        ],
        temperature: 0.3,
        max_tokens: 400,
      }),
    });
    summary = summaryResp.ok ? (await summaryResp.json()).choices?.[0]?.message?.content || '' : '';
    // Extraction des entités clés
    const entityPrompt = `Voici un texte extrait d'un document. Liste les entités clés (projets, personnes, dates, lieux, risques, etc) sous forme de tableau JSON [{type, value}].\n\nTEXTE:\n${text.slice(0, 2000)}`;
    const entityResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'Tu es un assistant qui extrait des entités clés de documents.' },
          { role: 'user', content: entityPrompt },
        ],
        temperature: 0.2,
        max_tokens: 300,
      }),
    });
    try {
      entities = entityResp.ok ? JSON.parse((await entityResp.json()).choices?.[0]?.message?.content || '[]') : [];
    } catch {
      entities = [];
    }
    // Stockage dans Redis
    const result = { summary, embedding, entities, text: text.slice(0, 4000) };
    await setCache(`doc:${fileName}:preanalysis`, result, 60 * 60 * 24);
    return result;
  } catch (e) {
    return { error: 'Erreur lors de la pré-analyse.' };
  }
} 
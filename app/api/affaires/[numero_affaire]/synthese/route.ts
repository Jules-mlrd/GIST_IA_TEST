import { NextResponse } from 'next/server';
import { listPdfFilesInS3, fetchPdfTextFromS3 } from '@/lib/readPdf';
import { listTxtFilesInS3, fetchTxtContentFromS3 } from '@/lib/readTxt';
import redis from '@/lib/redisClient';
import { setCache } from '@/lib/utils';

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || '';
const CACHE_TTL = 60 * 60; // 1h

export async function GET(req: Request, { params }: { params: { numero_affaire: string } }) {
  try {
    const numero_affaire = typeof params.numero_affaire === 'string' ? params.numero_affaire : String(params.numero_affaire);
    const url = new URL(String(req.url), 'http://localhost');
    const refresh = url.searchParams.get('refresh') === '1';
    const cacheKey = `affaire:${numero_affaire}:synthese`;
    let cacheTimestamp = Date.now();
    if (!refresh) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.resume && parsed.bullets) {
            cacheTimestamp = parsed.cacheTimestamp || cacheTimestamp;
            const etag = `"${cacheTimestamp}"`;
            if (req.headers.get('if-none-match') === etag) {
              return new Response(null, { status: 304 });
            }
            const response = NextResponse.json(parsed);
            response.headers.set('ETag', etag);
            return response;
          }
        } catch {}
      }
    }
    // 1. Récupérer les fichiers de l'affaire
    const prefix = `affaires/${numero_affaire}/`;
    const [pdfFiles, txtFiles] = await Promise.all([
      listPdfFilesInS3(BUCKET_NAME),
      listTxtFilesInS3(BUCKET_NAME),
    ]);
    const affairePdfFiles = pdfFiles.filter(key => key.startsWith(prefix));
    const affaireTxtFiles = txtFiles.filter(key => key.startsWith(prefix));
    // 2. Lire le contenu des fichiers (limite taille totale)
    const allFiles = [
      ...affairePdfFiles.map((key) => ({ key, type: 'pdf' })),
      ...affaireTxtFiles.map((key) => ({ key, type: 'txt' })),
    ];
    let totalLength = 0;
    const MAX_TOTAL_CHARS = 20000;
    let texts: string[] = [];
    for (const { key, type } of allFiles) {
      let text = '';
      try {
        if (type === 'pdf') text = await fetchPdfTextFromS3(BUCKET_NAME, key);
        else if (type === 'txt') text = await fetchTxtContentFromS3(BUCKET_NAME, key);
      } catch {}
      if (text && text.length > 0) {
        if (totalLength + text.length > MAX_TOTAL_CHARS) {
          text = text.slice(0, MAX_TOTAL_CHARS - totalLength);
        }
        texts.push(text);
        totalLength += text.length;
        if (totalLength >= MAX_TOTAL_CHARS) break;
      }
    }
    const fullText = texts.join('\n\n---\n\n');
    // 3. Génération d'un rapport structuré et cohérent en Markdown
    const plan = [
      "Objectifs et contexte du projet",
      "Parties prenantes et contacts clés",
      "État d’avancement (étapes franchies, difficultés, solutions)",
      "Blocages, risques et points de vigilance",
      "Actions à venir et prochaines étapes"
    ];
    const structuringPrompt = `
Lis attentivement le texte ci-dessous (extraits de documents d'une affaire SNCF).
Rédige un rapport détaillé et structuré selon le plan suivant :

${plan.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Pour chaque partie :
- Commence par un titre clair (niveau 2 Markdown : ##)
- Développe en plusieurs paragraphes, avec des exemples concrets si possible
- Sois exhaustif, pédagogique, et veille à la cohérence globale du texte

Texte :
${fullText}

Réponse :
`;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'Tu es un assistant IA expert en gestion de projet SNCF.' },
          { role: 'user', content: structuringPrompt },
        ],
        temperature: 0.4,
        max_tokens: 4096,
      }),
    });
    if (!response.ok) throw new Error('Erreur OpenAI synthèse affaire');
    const data = await response.json();
    const resume = data.choices?.[0]?.message?.content || '';
    // Génère aussi les bullet points comme avant
    const bulletPrompt = `Lis attentivement le texte ci-dessous (extraits de documents d'une affaire SNCF). Génère une version bullet points pour réunion, listant les points clés, décisions, actions à venir, blocages, etc. Réponds uniquement avec une liste JSON de chaînes de caractères.`;
    let bullets: string[] = [];
    let bulletsByCategory: Record<string, string[]> = {};
    let bulletsRaw = '';
    try {
      const bulletRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'Tu es un assistant IA expert en gestion de projet SNCF.' },
            { role: 'user', content: `${bulletPrompt}\n\nTexte :\n${fullText}\n\nRéponse :` },
          ],
          temperature: 0.4,
          max_tokens: 1024,
        }),
      });
      if (bulletRes.ok) {
        const bulletData = await bulletRes.json();
        const bulletContent = bulletData.choices?.[0]?.message?.content || '';
        bulletsRaw = bulletContent;
        let bulletsArr: string[] = [];
        try {
          // Extraction du premier objet ou tableau JSON valide
          let jsonMatch = bulletContent.match(/(\{[\s\S]*?\}|\[[\s\S]*?\])/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) {
              bulletsArr = parsed.filter(x => typeof x === 'string');
            } else if (typeof parsed === 'object' && parsed !== null) {
              // Fusionne toutes les listes de string trouvées dans l'objet
              for (const k of Object.keys(parsed)) {
                if (Array.isArray(parsed[k])) {
                  bulletsArr.push(...parsed[k].filter((x: any) => typeof x === 'string'));
                  bulletsByCategory[k] = parsed[k].filter((x: any) => typeof x === 'string');
                }
              }
            }
          } else {
            // Fallback : extraire les bullet points à partir du texte brut
            const lines = bulletContent.split(/\r?\n/).map((l: string) => l.trim());
            const bulletLines = lines.filter((l: string) => l.match(/^[-*•]\s+/));
            if (bulletLines.length > 0) {
              bulletsArr = bulletLines.map((l: string) => l.replace(/^[-*•]\s+/, ''));
            }
          }
        } catch (e) {
          // Fallback : extraire les bullet points à partir du texte brut
          const lines = bulletContent.split(/\r?\n/).map((l: string) => l.trim());
          const bulletLines = lines.filter((l: string) => l.match(/^[-*•]\s+/));
          if (bulletLines.length > 0) {
            bulletsArr = bulletLines.map((l: string) => l.replace(/^[-*•]\s+/, ''));
          }
        }
        if (!bulletsArr.length) {
          // fallback ultime : on ne retourne rien (jamais de string JSON brute)
          bulletsArr = [];
        }
        bullets = bulletsArr;
      }
    } catch (e) {
      console.error('Erreur génération bullet points:', e);
    }
    const cacheTimestampNew = Date.now();
    const result = { resume, bullets, bulletsByCategory, cacheTimestamp: cacheTimestampNew };
    await setCache(cacheKey, result, CACHE_TTL);
    const etag = `"${cacheTimestampNew}"`;
    if (req.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304 });
    }
    const responseFinal = NextResponse.json(result);
    responseFinal.headers.set('ETag', etag);
    return responseFinal;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erreur serveur synthèse affaire.' }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import redis from '@/lib/redisClient';

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  return dot / (normA * normB);
}

async function getEmbeddingOpenAI(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });
  if (!response.ok) throw new Error('Erreur OpenAI embedding');
  const data = await response.json();
  return data.data[0].embedding;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ affaireId: string }> }) {
  const { affaireId } = await params;
  try {
    const { query } = await req.json();
    if (!query) return NextResponse.json({ error: 'Query manquante.' }, { status: 400 });
    const queryEmbedding = await getEmbeddingOpenAI(query);
    // Récupérer toutes les clés d'embeddings pour cette affaire
    const keys = await redis.keys(`affaire:${affaireId}:file:*`);
    const results: Array<{ fileKey: string, score: number, text: string }> = [];
    for (const key of keys) {
      const value = await redis.get(key);
      if (!value) continue;
      const { embedding, text } = JSON.parse(value);
      if (!embedding) continue;
      const score = cosineSimilarity(queryEmbedding, embedding);
      results.push({ fileKey: key.split(':file:')[1], score, text });
    }
    // Trier par score décroissant
    results.sort((a, b) => b.score - a.score);
    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
} 
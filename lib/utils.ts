import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Appelle l'API OpenAI pour obtenir l'embedding d'un texte
export async function getEmbeddingOpenAI(text: string, apiKey?: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey || process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });
  if (!response.ok) throw new Error('Erreur OpenAI Embedding');
  const data = await response.json();
  return data.data[0].embedding;
}

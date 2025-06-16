import { NextResponse } from 'next/server';
import { readTxtContent } from '@/lib/readTxt';

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ reply: 'Clé API manquante.' }, { status: 500 });
    }

    let txtData = '';
    if (message.toLowerCase().match(/plan de test|rapport|avancement|spécification|technique|cahier des charges/)) {
      try {
        txtData = readTxtContent();
      } catch (txtError) {
        console.error('Erreur lecture TXT:', txtError);
        txtData = '(Impossible de charger les documents actuellement.)';
      }
    }

    const prompt = `
    Tu es un assistant utile pour le support de projet GISM. Réponds toujours en français.
    ${txtData ? `Documents disponibles : ${txtData}` : ''}
    Question : ${message}
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ reply: `Erreur OpenAI: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;

    return NextResponse.json({ reply });

  } catch (error) {
    console.error('Erreur serveur:', error);
    return NextResponse.json({ reply: 'Erreur serveur inattendue.' }, { status: 500 });
  }
}

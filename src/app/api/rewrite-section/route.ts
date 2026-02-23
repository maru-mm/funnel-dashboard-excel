import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `Sei un esperto sviluppatore front-end specializzato in landing page e funnel di marketing.
Il tuo compito è RISCRIVERE una sezione HTML estratta da una pagina, rendendola COMPLETAMENTE STANDALONE e riutilizzabile.

REGOLE:
1. Restituisci SOLO il codice HTML della sezione riscritta, NIENTE altro testo o markdown.
2. NON aggiungere backtick, \`\`\`html o blocchi di codice. Output puro HTML.
3. La sezione deve funzionare AUTONOMAMENTE come blocco HTML inseribile ovunque.
4. INCLUDI un tag <style> in cima con TUTTI gli stili necessari alla sezione (no dipendenze esterne).
5. Tutti gli stili CSS devono essere SCOPED usando un wrapper con classe unica (es. .saved-section-XXXX).
6. Mantieni il design visivo e la struttura originale il più possibile.
7. Converti classi framework (Tailwind, Bootstrap, etc.) in CSS puro inline o nel tag <style>.
8. Mantieni le immagini con URL assoluti. Se un'immagine ha URL relativo, mantienilo.
9. Rimuovi eventuali script, event handler (onclick, etc.), e codice JS non necessario.
10. Mantieni i link (href) funzionali.
11. Il blocco finale deve essere un singolo <div> wrapper con la classe scoped.
12. Assicurati che la sezione sia responsive (media queries se necessario).`;

function cleanAiOutput(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:html)?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?```\s*$/i, '');
  return cleaned.trim();
}

async function rewriteWithClaude(sectionHtml: string, context?: string): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userPrompt = `Riscrivi questa sezione HTML per renderla completamente standalone e riutilizzabile.
${context ? `\nContesto sulla pagina di origine: ${context}` : ''}

SEZIONE HTML DA RISCRIVERE:
${sectionHtml}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const result = response.content[0].type === 'text' ? response.content[0].text : '';
  return cleanAiOutput(result);
}

async function rewriteWithGemini(sectionHtml: string, context?: string): Promise<string> {
  const apiKey = (process.env.GOOGLE_GEMINI_API_KEY ?? '').trim();
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY not configured');

  const userPrompt = `Riscrivi questa sezione HTML per renderla completamente standalone e riutilizzabile.
${context ? `\nContesto sulla pagina di origine: ${context}` : ''}

SEZIONE HTML DA RISCRIVERE:
${sectionHtml}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: 32768, temperature: 0.7 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return cleanAiOutput(text);
}

export async function POST(request: NextRequest) {
  try {
    const { html, model, context } = await request.json() as {
      html: string;
      model?: 'claude' | 'gemini';
      context?: string;
    };

    if (!html || html.trim().length < 10) {
      return NextResponse.json({ error: 'HTML sezione mancante o troppo corto.' }, { status: 400 });
    }

    const useModel = model || 'claude';
    let rewritten: string;

    if (useModel === 'gemini') {
      rewritten = await rewriteWithGemini(html, context);
    } else {
      rewritten = await rewriteWithClaude(html, context);
    }

    return NextResponse.json({
      success: true,
      html: rewritten,
      model: useModel,
      originalLength: html.length,
      rewrittenLength: rewritten.length,
    });
  } catch (error) {
    console.error('Rewrite section API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Errore sconosciuto' },
      { status: 500 }
    );
  }
}

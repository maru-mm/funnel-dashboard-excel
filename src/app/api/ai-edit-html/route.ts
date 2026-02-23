import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

type AIModel = 'claude' | 'gemini';

interface EditRequest {
  html: string;
  prompt: string;
  model: AIModel;
}

const CHUNK_SYSTEM_PROMPT = `Sei un esperto sviluppatore front-end e brand designer.
Il tuo compito è MODIFICARE il codice HTML fornito secondo le istruzioni dell'utente.

REGOLE FONDAMENTALI:
1. Restituisci SOLO il codice HTML modificato, NIENTE altro testo, spiegazioni o markdown.
2. NON aggiungere \`\`\`html o altri blocchi di codice. Output puro HTML.
3. Mantieni la struttura HTML intatta — modifica solo ciò che è rilevante al prompt.
4. Se il prompt chiede un cambio di brand/stile, modifica TUTTI gli elementi coerentemente:
   - Colori (background, testo, bordi, bottoni, gradienti)
   - Font families e stili di testo
   - Testi/copy se rilevanti al nuovo brand
   - Icone e immagini se hanno URL modificabili
   - Ombre, border-radius, spaziature per coerenza con il nuovo stile
5. Sii COMPLETO: non lasciare elementi con il vecchio stile. Ogni modifica deve essere uniforme.
6. Preserva TUTTI i link, form, input, script funzionali e struttura semantica.
7. Se trovi inline styles, modificali. Se trovi classi CSS in un <style> tag, modifica anche quelle.`;

function splitHtmlIntoChunks(html: string): { chunks: string[]; boundaries: number[] } {
  if (html.length < 15000) {
    return { chunks: [html], boundaries: [0] };
  }

  const bodyMatch = html.match(/<body[\s\S]*?<\/body>/is);

  if (!bodyMatch) {
    if (html.length < 60000) {
      return { chunks: [html], boundaries: [0] };
    }
    const mid = Math.floor(html.length / 2);
    const splitPoint = html.lastIndexOf('>', mid) + 1 || mid;
    return {
      chunks: [html.substring(0, splitPoint), html.substring(splitPoint)],
      boundaries: [0, splitPoint],
    };
  }

  const bodyContent = bodyMatch[0];
  const bodyStart = html.indexOf(bodyContent);
  const beforeBody = html.substring(0, bodyStart);
  const afterBody = html.substring(bodyStart + bodyContent.length);

  const bodyInner = bodyContent.replace(/^<body[^>]*>/i, '').replace(/<\/body>$/i, '');

  const topElements: { start: number; end: number }[] = [];
  let topDepth = 0;
  let topStart = 0;

  for (let i = 0; i < bodyInner.length; i++) {
    if (bodyInner[i] === '<') {
      const rest = bodyInner.substring(i);
      const tagMatch = rest.match(/^<(\/?)(\w+)([^>]*?)(\/?)>/);
      if (tagMatch) {
        const isClose = tagMatch[1] === '/';
        const isSelfClose = tagMatch[4] === '/' || /^(br|hr|img|input|meta|link|area|base|col|embed|source|track|wbr)$/i.test(tagMatch[2]);

        if (!isSelfClose) {
          if (isClose) {
            topDepth--;
            if (topDepth === 0) {
              topElements.push({ start: topStart, end: i + tagMatch[0].length });
            }
          } else {
            if (topDepth === 0) {
              topStart = i;
            }
            topDepth++;
          }
        }
      }
    }
  }

  if (topElements.length === 0) {
    return {
      chunks: [beforeBody + bodyContent, afterBody].filter(Boolean),
      boundaries: [0, beforeBody.length + bodyContent.length],
    };
  }

  const TARGET_CHUNK_SIZE = 12000;
  const chunks: string[] = [];
  const boundaries: number[] = [];
  let currentChunk = '';
  let chunkStart = 0;

  chunks.push(beforeBody + '<body' + (bodyContent.match(/^<body([^>]*)>/i)?.[1] || '') + '>');
  boundaries.push(0);

  for (let j = 0; j < topElements.length; j++) {
    const elem = topElements[j];
    const elemContent = bodyInner.substring(elem.start, elem.end);

    if (currentChunk.length + elemContent.length > TARGET_CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push(currentChunk);
      boundaries.push(chunkStart);
      currentChunk = elemContent;
      chunkStart = elem.start;
    } else {
      if (currentChunk.length === 0) chunkStart = elem.start;
      currentChunk += elemContent;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
    boundaries.push(chunkStart);
  }

  chunks.push('</body>' + afterBody);
  boundaries.push(bodyStart + bodyContent.length);

  return { chunks, boundaries };
}

async function editWithClaude(
  html: string,
  prompt: string,
  onChunk: (data: Record<string, unknown>) => void
): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const { chunks } = splitHtmlIntoChunks(html);

  const totalChunks = chunks.length;
  onChunk({ type: 'info', totalChunks, model: 'claude' });

  if (totalChunks <= 1) {
    onChunk({ type: 'chunk-start', chunkIndex: 0, totalChunks: 1, label: 'Pagina intera' });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      system: CHUNK_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `ISTRUZIONI: ${prompt}\n\nHTML DA MODIFICARE:\n${html}`,
        },
      ],
    });

    const result =
      response.content[0].type === 'text' ? response.content[0].text : '';
    onChunk({ type: 'chunk-done', chunkIndex: 0, totalChunks: 1 });
    return cleanAiOutput(result);
  }

  const headChunk = chunks[0];
  const bodyChunks = chunks.slice(1, -1);
  const tailChunk = chunks[chunks.length - 1];

  onChunk({
    type: 'chunk-start',
    chunkIndex: 0,
    totalChunks,
    label: 'Head e struttura iniziale',
  });

  const headResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    system: CHUNK_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `ISTRUZIONI: ${prompt}\n\nQuesta è la PRIMA PARTE (head + apertura body) di una pagina HTML. Modifica gli stili CSS, meta tag, e qualsiasi elemento rilevante.\n\nCHUNK HTML:\n${headChunk}`,
      },
    ],
  });
  const modifiedHead =
    headResponse.content[0].type === 'text' ? headResponse.content[0].text : headChunk;
  onChunk({ type: 'chunk-done', chunkIndex: 0, totalChunks });

  const modifiedBodyChunks: string[] = [];
  for (let i = 0; i < bodyChunks.length; i++) {
    const chunkIdx = i + 1;
    onChunk({
      type: 'chunk-start',
      chunkIndex: chunkIdx,
      totalChunks,
      label: `Sezione ${i + 1} di ${bodyChunks.length}`,
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      system: CHUNK_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `ISTRUZIONI: ${prompt}\n\nQuesta è la SEZIONE ${i + 1} di ${bodyChunks.length} del body di una pagina HTML. Applica le modifiche in modo coerente con il resto della pagina.\nContesto: stai modificando il brand/stile dell'intera pagina, quindi modifica TUTTI gli elementi visivi in questa sezione.\n\nCHUNK HTML:\n${bodyChunks[i]}`,
        },
      ],
    });

    const result =
      response.content[0].type === 'text' ? response.content[0].text : bodyChunks[i];
    modifiedBodyChunks.push(cleanAiOutput(result));
    onChunk({ type: 'chunk-done', chunkIndex: chunkIdx, totalChunks });
  }

  const finalHtml = cleanAiOutput(modifiedHead) + modifiedBodyChunks.join('') + tailChunk;
  return finalHtml;
}

async function editWithGemini(
  html: string,
  prompt: string,
  onChunk: (data: Record<string, unknown>) => void
): Promise<string> {
  const apiKey = (process.env.GOOGLE_GEMINI_API_KEY ?? '').trim();
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY not configured');

  const { chunks } = splitHtmlIntoChunks(html);
  const totalChunks = chunks.length;
  onChunk({ type: 'info', totalChunks, model: 'gemini' });

  const geminiCall = async (userContent: string): Promise<string> => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: CHUNK_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userContent }] }],
        generationConfig: {
          maxOutputTokens: 65536,
          temperature: 0.7,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  };

  if (totalChunks <= 1) {
    onChunk({ type: 'chunk-start', chunkIndex: 0, totalChunks: 1, label: 'Pagina intera' });
    const result = await geminiCall(`ISTRUZIONI: ${prompt}\n\nHTML DA MODIFICARE:\n${html}`);
    onChunk({ type: 'chunk-done', chunkIndex: 0, totalChunks: 1 });
    return cleanAiOutput(result);
  }

  const headChunk = chunks[0];
  const bodyChunks = chunks.slice(1, -1);
  const tailChunk = chunks[chunks.length - 1];

  onChunk({
    type: 'chunk-start',
    chunkIndex: 0,
    totalChunks,
    label: 'Head e struttura iniziale',
  });

  const modifiedHead = await geminiCall(
    `ISTRUZIONI: ${prompt}\n\nQuesta è la PRIMA PARTE (head + apertura body) di una pagina HTML. Modifica gli stili CSS, meta tag, e qualsiasi elemento rilevante.\n\nCHUNK HTML:\n${headChunk}`
  );
  onChunk({ type: 'chunk-done', chunkIndex: 0, totalChunks });

  const modifiedBodyChunks: string[] = [];
  for (let i = 0; i < bodyChunks.length; i++) {
    const chunkIdx = i + 1;
    onChunk({
      type: 'chunk-start',
      chunkIndex: chunkIdx,
      totalChunks,
      label: `Sezione ${i + 1} di ${bodyChunks.length}`,
    });

    const result = await geminiCall(
      `ISTRUZIONI: ${prompt}\n\nQuesta è la SEZIONE ${i + 1} di ${bodyChunks.length} del body di una pagina HTML. Applica le modifiche in modo coerente con il resto della pagina.\nContesto: stai modificando il brand/stile dell'intera pagina, quindi modifica TUTTI gli elementi visivi in questa sezione.\n\nCHUNK HTML:\n${bodyChunks[i]}`
    );

    modifiedBodyChunks.push(cleanAiOutput(result));
    onChunk({ type: 'chunk-done', chunkIndex: chunkIdx, totalChunks });
  }

  return cleanAiOutput(modifiedHead) + modifiedBodyChunks.join('') + tailChunk;
}

function cleanAiOutput(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```html?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?```\s*$/i, '');
  cleaned = cleaned.trim();
  return cleaned;
}

export async function POST(request: NextRequest) {
  try {
    const body: EditRequest = await request.json();
    const { html, prompt, model = 'claude' } = body;

    if (!html || !prompt) {
      return new Response(
        JSON.stringify({ error: 'html e prompt sono obbligatori' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          send({ type: 'start', model, htmlLength: html.length });

          let resultHtml: string;

          if (model === 'gemini') {
            resultHtml = await editWithGemini(html, prompt, send);
          } else {
            resultHtml = await editWithClaude(html, prompt, send);
          }

          send({ type: 'result', html: resultHtml });
          send({ type: 'done' });
        } catch (error) {
          console.error('[ai-edit-html] Error:', error);
          send({
            type: 'error',
            error: error instanceof Error ? error.message : 'Errore sconosciuto',
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[ai-edit-html] Request error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Errore nella richiesta',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Sei un esperto sviluppatore frontend specializzato nella creazione di quiz interattivi per il marketing.
Quando l'utente ti chiede di creare un quiz, genera un SINGOLO file HTML completo che contiene:
- HTML semantico
- CSS embedded in un tag <style> (design moderno, responsive, animazioni fluide)
- JavaScript embedded in un tag <script> per la logica del quiz

REGOLE IMPORTANTI:
1. Il quiz deve essere completamente funzionante e autosufficiente in un unico file HTML
2. Usa un design moderno con gradient, ombre, transizioni e animazioni CSS
3. Il quiz deve essere responsive (mobile-first)
4. Includi una progress bar per mostrare l'avanzamento
5. Includi una pagina risultati alla fine con animazioni
6. Usa colori vivaci e un layout accattivante
7. Non usare librerie esterne (no CDN, no framework)
8. Il codice deve funzionare immediatamente quando inserito in un iframe
9. Genera SOLO il codice HTML, senza spiegazioni, senza markdown, senza backtick
10. Inizia direttamente con <!DOCTYPE html> e termina con </html>
11. I testi devono essere in italiano se non specificato diversamente`;

export async function POST(request: NextRequest) {
  try {
    const { prompt, temperature } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Il campo "prompt" è obbligatorio' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY non configurata' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = new Anthropic({ apiKey });

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      temperature: temperature ?? 0.7,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Crea un quiz interattivo HTML/CSS/JS completo per: ${prompt}

Genera SOLO il codice HTML completo. Nessuna spiegazione aggiuntiva.`,
        },
      ],
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              const chunk = event.delta.text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
              );
            }
          }

          const finalMessage = await stream.finalMessage();
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                usage: {
                  input_tokens: finalMessage.usage.input_tokens,
                  output_tokens: finalMessage.usage.output_tokens,
                },
              })}\n\n`
            )
          );
          controller.close();
        } catch (err) {
          const errorMsg =
            err instanceof Error ? err.message : 'Errore durante la generazione';
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: errorMsg })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Swipe Quiz generate error:', error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Errore interno del server',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

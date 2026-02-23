import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const MODEL = 'gpt-4.1';

const VISUAL_PROMPT = `Sei un esperto di funnel design, UI/UX design e conversion rate optimization.

Basandoti sull'analisi reverse engineering di un funnel e sulla proposta di funnel rigenerato, genera un mockup HTML completo e visuale che mostra come potrebbe essere il FUNNEL RIGENERATO e OTTIMIZZATO.

Il mockup HTML deve mostrare:

1. **Header Hero** — Titolo del funnel rigenerato con breve descrizione del concept
2. **Flow Diagram** — Schema visuale del percorso step-by-step con frecce di connessione
3. **Card per ogni Step** — Per ogni step del funnel rigenerato, mostra:
   - Numero e tipo dello step (con icona/colore)
   - Headline e subheadline proposti
   - Elementi chiave (CTA, form, trust signals)
   - Body copy riassuntivo
   - Nota sul perché è migliorato rispetto all'originale
4. **Sezione Miglioramenti** — Lista dei miglioramenti applicati rispetto al funnel originale
5. **Scoring Comparison** — Confronto prima/dopo dei punteggi di efficacia

Requisiti tecnici:
- Una singola pagina HTML auto-contenuta
- Usa Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Design moderno, professionale con gradients, shadows, rounded corners
- Palette colori: indigo/violet/purple come colori primari
- Responsive (funziona sia desktop che mobile)
- Icone tramite emoji Unicode (non dipendenze esterne)
- Font: system-ui

IMPORTANTE: Rispondi SOLO con il codice HTML completo, partendo da <!DOCTYPE html>. Nessun commento, nessun markdown, nessun blocco di codice. Solo puro HTML.`;

export async function POST(request: NextRequest) {
  try {
    const { analysis, funnelName } = await request.json();

    if (!analysis) {
      return NextResponse.json(
        { error: 'I dati dell\'analisi sono obbligatori' },
        { status: 400 }
      );
    }

    const apiKey = (process.env.OPENAI_API_KEY ?? '').trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY non configurata' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: VISUAL_PROMPT },
        {
          role: 'user',
          content: `Genera il mockup HTML visuale del funnel rigenerato per "${funnelName || 'Funnel'}".

Ecco l'analisi completa del funnel originale e la proposta di rigenerazione:

${JSON.stringify(analysis, null, 2)}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 16384,
    });

    let html = completion.choices[0]?.message?.content ?? '';
    const match = html.match(/```(?:html)?\s*([\s\S]*?)```/);
    if (match) html = match[1].trim();

    if (!html.includes('<!DOCTYPE') && !html.includes('<html')) {
      html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"><\/script><title>Funnel Rigenerato</title></head><body class="bg-gray-50">${html}</body></html>`;
    }

    return NextResponse.json({
      success: true,
      html,
      usage: completion.usage,
    });
  } catch (error) {
    console.error('[reverse-funnel/generate-visual] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Errore nella generazione visuale',
      },
      { status: 500 }
    );
  }
}

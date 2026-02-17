import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

type Phase = 'generate' | 'review';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  >;
}

async function callClaude(
  messages: ClaudeMessage[],
  apiKey: string,
  maxTokens: number = 16384,
  system?: string
): Promise<string> {
  const body: Record<string, unknown> = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    messages,
  };
  if (system) body.system = system;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API ${response.status}: ${err.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
  return text;
}

// ─── Phase 1: GENERATE - Pixel-perfect HTML replication ──────────────────────
function buildGenerateMessages(
  screenshot: string,
  analysis: Record<string, unknown>,
  url: string,
  title: string
): { messages: ClaudeMessage[]; system: string } {
  const system = `Sei un senior frontend developer specializzato nella replica pixel-perfect di pagine web.

Il tuo compito è analizzare uno screenshot di una pagina web insieme alla sua analisi dettagliata (colori, tipografia, layout, elementi visivi) e generare codice HTML/CSS/JS che REPLICA ESATTAMENTE quella pagina.

OBIETTIVO PRIMARIO: Il codice HTML generato deve essere VISIVAMENTE IDENTICO allo screenshot. Non devi creare qualcosa di nuovo, devi REPLICARE ESATTAMENTE ciò che vedi.

REGOLE CRITICHE:
- Genera SOLO il codice HTML completo (da <!DOCTYPE html> a </html>)
- NESSUN commento di spiegazione prima o dopo il codice
- NESSUN markdown, nessun blocco \`\`\`
- Il codice deve essere 100% funzionante standalone
- Usa CSS inline nel tag <style> e JS inline nel tag <script>
- Mobile responsive
- Il file deve essere completamente autocontenuto
- NON inventare contenuti nuovi - replica SOLO ciò che è visibile nello screenshot
- NON aggiungere step, pagine o sezioni che NON sono nello screenshot`;

  const prompt = `REPLICA ESATTAMENTE questa pagina web in HTML.

URL originale: ${url}
Titolo: ${title}

ANALISI DETTAGLIATA DELLA PAGINA (da Gemini Vision AI):
${JSON.stringify(analysis, null, 2)}

ISTRUZIONI PER LA REPLICA:

1. CONTENUTO: Replica ESATTAMENTE il testo, i titoli, i sottotitoli, le label, i bottoni e qualsiasi contenuto visibile nello screenshot. Non inventare nulla di nuovo.

2. COLORI: Usa ESATTAMENTE i colori dall'analisi:
   - Primary: ${(analysis as { color_palette?: { primary_color?: string } }).color_palette?.primary_color || 'dall\'analisi'}
   - Secondary: ${(analysis as { color_palette?: { secondary_color?: string } }).color_palette?.secondary_color || 'dall\'analisi'}
   - Accent: ${(analysis as { color_palette?: { accent_color?: string } }).color_palette?.accent_color || 'dall\'analisi'}
   - Background: ${(analysis as { color_palette?: { background_color?: string } }).color_palette?.background_color || 'dall\'analisi'}
   - Text: ${(analysis as { color_palette?: { text_color?: string } }).color_palette?.text_color || 'dall\'analisi'}

3. TIPOGRAFIA: Replica lo stile tipografico descritto nell'analisi (font, pesi, gerarchia).

4. LAYOUT: Replica ESATTAMENTE la struttura del layout:
   - Tipo: ${(analysis as { layout_structure?: { layout_type?: string } }).layout_structure?.layout_type || 'dall\'analisi'}
   - Densità: ${(analysis as { layout_structure?: { content_density?: string } }).layout_structure?.content_density || 'dall\'analisi'}
   - Whitespace: ${(analysis as { layout_structure?: { whitespace_usage?: string } }).layout_structure?.whitespace_usage || 'dall\'analisi'}

5. ELEMENTI VISIVI: Replica bottoni, card, icone, progress bar, form - tutto esattamente come nello screenshot.

6. INTERATTIVITÀ: Se la pagina ha elementi interattivi (bottoni, form, opzioni selezionabili), implementali con JavaScript vanilla funzionante.

7. Se ci sono immagini nello screenshot, usa placeholder con le stesse dimensioni e proporzioni (puoi usare div con background-color o placeholder SVG).

REQUISITI TECNICI:
- File HTML singolo autocontenuto con <style> e <script> inline
- Font da Google Fonts se identificati nell'analisi
- Mobile responsive
- Dimensioni e spacing il più fedeli possibile allo screenshot

Genera SOLO il codice HTML completo che replica ESATTAMENTE questa pagina. Nient'altro.`;

  return {
    system,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: screenshot },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  };
}

// ─── Phase 1 (SWIPE): GENERATE with swiped branding ─────────────────────────
function buildSwipeGenerateMessages(
  screenshot: string,
  swipedAnalysis: Record<string, unknown>,
  originalAnalysis: Record<string, unknown>,
  url: string,
  title: string
): { messages: ClaudeMessage[]; system: string } {
  const system = `Sei un senior frontend developer specializzato nella replica di pagine web con REBRANDING.

Il tuo compito è:
1. Guardare lo screenshot di una pagina web per capire il LAYOUT, la STRUTTURA, il TIPO DI PAGINA e la DISPOSIZIONE degli elementi
2. Usare l'ANALISI SWIPATA (con il nuovo branding del cliente) per applicare COLORI, TESTI, CTA, TIPOGRAFIA e BRANDING del NUOVO brand
3. Generare HTML che ha la STESSA STRUTTURA/LAYOUT dello screenshot ma con il BRANDING SWIPATO

OBIETTIVO: Stessa struttura e layout dello screenshot, ma con il branding del cliente (colori, testi, CTA, font dal branding swipato).

REGOLE CRITICHE:
- Genera SOLO il codice HTML completo (da <!DOCTYPE html> a </html>)
- NESSUN commento di spiegazione prima o dopo il codice
- NESSUN markdown, nessun blocco \`\`\`
- Il codice deve essere 100% funzionante standalone
- Usa CSS inline nel tag <style> e JS inline nel tag <script>
- Mobile responsive
- Il file deve essere completamente autocontenuto
- La STRUTTURA deve seguire lo screenshot (layout, sezioni, disposizione)
- I CONTENUTI (testi, colori, CTA, brand name) devono venire dall'analisi swipata`;

  const swipedColors = swipedAnalysis.color_palette as Record<string, string> | undefined;
  const swipedBrand = swipedAnalysis.brand_identity as Record<string, string> | undefined;
  const swipedCta = swipedAnalysis.cta_analysis as Record<string, unknown> | undefined;
  const swipedTypo = swipedAnalysis.typography as Record<string, string> | undefined;
  const swipedLayout = swipedAnalysis.layout_structure as Record<string, unknown> | undefined;

  const prompt = `GENERA una pagina HTML che ha la STESSA STRUTTURA dello screenshot ma con il NUOVO BRANDING.

URL originale: ${url}
Titolo originale: ${title}

═══════════════════════════════════════
ANALISI SWIPATA (USA QUESTI DATI PER IL BRANDING):
═══════════════════════════════════════
${JSON.stringify(swipedAnalysis, null, 2)}

═══════════════════════════════════════
ISTRUZIONI:
═══════════════════════════════════════

1. STRUTTURA/LAYOUT: Guarda lo screenshot e replica la STESSA struttura:
   - Stesso tipo di layout (${(originalAnalysis.layout_structure as Record<string, string> | undefined)?.layout_type || 'vedi screenshot'})
   - Stesse sezioni nella stessa posizione
   - Stessa disposizione di elementi (progress bar, domande, opzioni, CTA)
   - Stessi pattern di spacing e whitespace

2. COLORI: Usa SOLO i colori dell'analisi SWIPATA:
   - Primary: ${swipedColors?.primary_color || 'dall\'analisi swipata'}
   - Secondary: ${swipedColors?.secondary_color || 'dall\'analisi swipata'}
   - Accent: ${swipedColors?.accent_color || 'dall\'analisi swipata'}
   - Background: ${swipedColors?.background_color || 'dall\'analisi swipata'}
   - Text: ${swipedColors?.text_color || 'dall\'analisi swipata'}

3. TESTI E CTA: Usa i contenuti dall'analisi SWIPATA:
   - Brand name: ${swipedBrand?.brand_name || 'dall\'analisi swipata'}
   - CTA principale: ${swipedCta?.primary_cta_text || 'dall\'analisi swipata'}
   - CTA style: ${swipedCta?.primary_cta_style || 'dall\'analisi swipata'}
   - Tutti i testi (titoli, domande, opzioni, sottotitoli) dall'analisi swipata

4. TIPOGRAFIA: Usa i font dall'analisi SWIPATA:
   - Heading: ${swipedTypo?.heading_font_style || 'dall\'analisi swipata'}
   - Body: ${swipedTypo?.body_font_style || 'dall\'analisi swipata'}

5. ELEMENTI VISIVI: Replica lo stile dei bottoni, card e elementi come descritto nell'analisi swipata.

6. INTERATTIVITÀ: Se la pagina originale ha elementi interattivi, implementali con JavaScript vanilla funzionante.

REQUISITI TECNICI:
- File HTML singolo autocontenuto con <style> e <script> inline
- Font da Google Fonts se specificati
- Mobile responsive
- Layout fedele allo screenshot, branding dall'analisi swipata

Genera SOLO il codice HTML completo. Nient'altro.`;

  return {
    system,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: screenshot },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  };
}

// ─── Phase 2 (SWIPE): REVIEW with swiped branding ───────────────────────────
function buildSwipeReviewMessages(
  screenshot: string,
  code: string,
  swipedAnalysis: Record<string, unknown>
): { messages: ClaudeMessage[]; system: string } {
  const swipedColors = swipedAnalysis.color_palette as Record<string, string> | undefined;
  const swipedBrand = swipedAnalysis.brand_identity as Record<string, string> | undefined;

  const system = `Sei un senior code reviewer specializzato in rebranding di pagine web.

Il tuo compito è verificare che il codice HTML generato:
1. Abbia la STESSA STRUTTURA/LAYOUT dello screenshot originale
2. Usi i COLORI, TESTI e BRANDING dall'analisi swipata (NON quelli dell'originale)

REGOLE:
- Se il codice è corretto, restituiscilo ESATTAMENTE com'è
- Se i colori NON corrispondono all'analisi swipata, CORREGGI
- Se i testi/CTA NON corrispondono all'analisi swipata, CORREGGI
- Verifica che la struttura segua lo screenshot
- Verifica che gli elementi interattivi funzionino

RISPONDI SOLO con il codice HTML completo (da <!DOCTYPE html> a </html>), senza markdown, senza blocchi di codice, senza commenti.`;

  const prompt = `Verifica questo codice HTML. Deve avere la struttura dello screenshot ma il branding swipato.

BRANDING SWIPATO (i colori e testi devono essere QUESTI):
- Brand: ${swipedBrand?.brand_name || 'N/A'}
- Primary: ${swipedColors?.primary_color || 'N/A'}
- Secondary: ${swipedColors?.secondary_color || 'N/A'}
- Accent: ${swipedColors?.accent_color || 'N/A'}
- Background: ${swipedColors?.background_color || 'N/A'}
- Text: ${swipedColors?.text_color || 'N/A'}

ANALISI SWIPATA COMPLETA:
${JSON.stringify(swipedAnalysis, null, 2)}

CODICE DA VERIFICARE:
${code}

CHECKLIST:
1. La struttura/layout corrisponde allo screenshot?
2. I colori sono quelli dell'analisi SWIPATA (non dell'originale)?
3. I testi/CTA sono quelli dell'analisi SWIPATA?
4. Il brand name è quello swipato?
5. Il codice è responsive?
6. Gli elementi interattivi funzionano?
7. Non ci sono errori di sintassi?

Restituisci il codice HTML completo corretto.`;

  return {
    system,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: screenshot },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  };
}

// ─── Phase 2: REVIEW & FIX ──────────────────────────────────────────────────
function buildReviewMessages(
  screenshot: string,
  code: string,
  analysis: Record<string, unknown>
): { messages: ClaudeMessage[]; system: string } {
  const system = `Sei un senior code reviewer specializzato nella replica pixel-perfect di pagine web.

Il tuo compito è confrontare il codice HTML generato con lo screenshot originale e l'analisi, verificando che sia una replica FEDELE della pagina originale.

REGOLE:
- Se il codice replica fedelmente lo screenshot, restituiscilo ESATTAMENTE com'è
- Se ci sono differenze visive significative rispetto allo screenshot, CORREGGI il codice
- Verifica che colori, layout, tipografia, spacing corrispondano allo screenshot
- Verifica che il contenuto testuale sia identico a quello visibile nello screenshot
- Verifica che gli elementi interattivi funzionino
- Verifica che il codice sia responsive

RISPONDI SOLO con il codice HTML completo (da <!DOCTYPE html> a </html>), senza markdown, senza blocchi di codice, senza commenti di spiegazione.`;

  const prompt = `Confronta questo codice HTML con lo screenshot originale e l'analisi. Verifica che sia una replica fedele.

ANALISI DELLA PAGINA ORIGINALE:
${JSON.stringify(analysis, null, 2)}

COLORI RICHIESTI:
- Primary: ${(analysis as { color_palette?: { primary_color?: string } }).color_palette?.primary_color || 'N/A'}
- Secondary: ${(analysis as { color_palette?: { secondary_color?: string } }).color_palette?.secondary_color || 'N/A'}
- Accent: ${(analysis as { color_palette?: { accent_color?: string } }).color_palette?.accent_color || 'N/A'}
- Background: ${(analysis as { color_palette?: { background_color?: string } }).color_palette?.background_color || 'N/A'}
- Text: ${(analysis as { color_palette?: { text_color?: string } }).color_palette?.text_color || 'N/A'}

CODICE DA VERIFICARE:
${code}

CHECKLIST DI VERIFICA:
1. Il layout corrisponde allo screenshot?
2. I colori sono quelli dell'analisi?
3. La tipografia (font, dimensioni, pesi) è corretta?
4. Il contenuto testuale è identico allo screenshot?
5. Gli elementi visivi (bottoni, card, icone, form) corrispondono?
6. Lo spacing e il padding sono corretti?
7. Il codice è responsive?
8. Non ci sono errori di sintassi HTML/CSS/JS?
9. Non ci sono tag HTML non chiusi?
10. Gli elementi interattivi funzionano?

Se ci sono differenze, correggi il codice per renderlo più fedele allo screenshot.
Restituisci il codice HTML completo corretto.`;

  return {
    system,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: screenshot },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  };
}

function extractHtmlCode(text: string): string {
  const trimmed = text.trim();

  const htmlBlock = trimmed.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (htmlBlock) return htmlBlock[1].trim();

  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<!doctype')) {
    return trimmed;
  }

  const docTypeMatch = trimmed.match(/(<!DOCTYPE[\s\S]*<\/html>)/i);
  if (docTypeMatch) return docTypeMatch[1].trim();

  return trimmed;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      phase,
      screenshot,
      analysis,
      url,
      title,
      generatedCode,
      swipeMode,
      swipedAnalysis,
      originalAnalysis,
    } = body as {
      phase: Phase;
      screenshot: string;
      analysis: Record<string, unknown>;
      url: string;
      title: string;
      generatedCode?: string;
      swipeMode?: boolean;
      swipedAnalysis?: Record<string, unknown>;
      originalAnalysis?: Record<string, unknown>;
    };

    if (!phase) {
      return NextResponse.json({ error: 'phase è obbligatorio' }, { status: 400 });
    }

    const claudeKey = (process.env.ANTHROPIC_API_KEY ?? '').trim();
    if (!claudeKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY non configurata. Aggiungi la chiave in .env.local e riavvia il server.' },
        { status: 500 }
      );
    }

    const startTime = Date.now();

    // ─── PHASE 1: GENERATE ─────────────────────────────
    if (phase === 'generate') {
      if (!screenshot) {
        return NextResponse.json(
          { error: 'screenshot è obbligatorio per la fase generate' },
          { status: 400 }
        );
      }

      let messages: ClaudeMessage[];
      let system: string;

      if (swipeMode && swipedAnalysis) {
        // SWIPE MODE: layout from screenshot + branding from swiped analysis
        ({ messages, system } = buildSwipeGenerateMessages(
          screenshot,
          swipedAnalysis,
          originalAnalysis || analysis || {},
          url || '',
          title || ''
        ));
      } else {
        // NORMAL MODE: pixel-perfect replication
        if (!analysis) {
          return NextResponse.json(
            { error: 'analysis è obbligatorio per la fase generate' },
            { status: 400 }
          );
        }
        ({ messages, system } = buildGenerateMessages(screenshot, analysis, url || '', title || ''));
      }

      const rawText = await callClaude(messages, claudeKey, 16384, system);
      const htmlCode = extractHtmlCode(rawText);

      return NextResponse.json({
        success: true,
        phase: 'generate',
        code: htmlCode,
        swipeMode: !!swipeMode,
        duration_ms: Date.now() - startTime,
      });
    }

    // ─── PHASE 2: REVIEW & FIX ──────────────────────────
    if (phase === 'review') {
      if (!generatedCode || !screenshot) {
        return NextResponse.json(
          { error: 'generatedCode e screenshot sono obbligatori per la fase review' },
          { status: 400 }
        );
      }

      let messages: ClaudeMessage[];
      let system: string;

      if (swipeMode && swipedAnalysis) {
        ({ messages, system } = buildSwipeReviewMessages(screenshot, generatedCode, swipedAnalysis));
      } else {
        if (!analysis) {
          return NextResponse.json(
            { error: 'analysis è obbligatorio per la fase review' },
            { status: 400 }
          );
        }
        ({ messages, system } = buildReviewMessages(screenshot, generatedCode, analysis));
      }

      const rawText = await callClaude(messages, claudeKey, 16384, system);
      const finalCode = extractHtmlCode(rawText);

      return NextResponse.json({
        success: true,
        phase: 'review',
        code: finalCode,
        swipeMode: !!swipeMode,
        duration_ms: Date.now() - startTime,
      });
    }

    return NextResponse.json({ error: `Fase non valida: ${phase}` }, { status: 400 });
  } catch (error) {
    console.error('[quiz-creator/generate] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Errore durante la generazione',
      },
      { status: 500 }
    );
  }
}

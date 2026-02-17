import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

type Phase = 'my-branding' | 'swipe-regenerate';

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
  maxTokens: number = 8192,
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
  };
  return data.content?.find((c) => c.type === 'text')?.text ?? '';
}

function parseJsonSafe(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  let jsonStr = trimmed;
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1].trim();
  try {
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ─── Phase 1: MY BRANDING ────────────────────────────────────────────────────
// Claude prende lo screenshot + analisi originale + info prodotto dell'utente
// e genera il branding personalizzato per il prodotto dell'utente
function buildMyBrandingMessages(
  screenshot: string,
  originalAnalysis: Record<string, unknown>,
  productInfo: {
    product_name: string;
    product_description: string;
    target_audience: string;
    industry: string;
    tone_of_voice: string;
    unique_selling_points: string;
  }
): { messages: ClaudeMessage[]; system: string } {
  const system = `Sei un esperto di branding, marketing e design strategico.
Il tuo compito è analizzare il design di un competitor/ispirazione (screenshot + analisi) e creare un branding PERSONALIZZATO per il prodotto dell'utente.

Non devi copiare, devi SWIPARE: prendi ispirazione dalla struttura e dalle best practices del competitor, ma adatta tutto al brand dell'utente con colori, tono e personalità propri.

RISPONDI SOLO con un oggetto JSON valido, senza markdown, senza blocchi di codice.`;

  const prompt = `Analizza questo screenshot e l'analisi di branding di un competitor/ispirazione, poi crea un branding PERSONALIZZATO per il mio prodotto.

═══ ANALISI ORIGINALE (COMPETITOR/ISPIRAZIONE) ═══
${JSON.stringify(originalAnalysis, null, 2)}

═══ IL MIO PRODOTTO ═══
Nome: ${productInfo.product_name}
Descrizione: ${productInfo.product_description}
Target Audience: ${productInfo.target_audience}
Settore: ${productInfo.industry}
Tono di Voce: ${productInfo.tone_of_voice}
Punti di Forza Unici (USP): ${productInfo.unique_selling_points}

═══ ISTRUZIONI ═══
Genera un JSON con questa struttura ESATTA per il MIO brand (non del competitor):

{
  "brand_identity": {
    "brand_name": "${productInfo.product_name}",
    "brand_personality": "personalità del MIO brand",
    "brand_voice": "tono di voce specifico",
    "brand_promise": "promessa del brand al cliente",
    "target_audience": "descrizione dettagliata del MIO target",
    "industry": "${productInfo.industry}",
    "positioning_statement": "posizionamento del brand nel mercato",
    "competitor_differentiation": "come mi differenzio dal competitor analizzato"
  },
  "color_palette": {
    "primary_color": "#hex - colore principale del MIO brand",
    "secondary_color": "#hex",
    "accent_color": "#hex - per CTA e elementi di accento",
    "background_color": "#hex",
    "text_color": "#hex",
    "gradient_primary": "linear-gradient(...) per elementi premium",
    "all_colors": ["tutti i colori hex del MIO brand"],
    "color_rationale": "perché ho scelto questi colori per questo brand"
  },
  "typography": {
    "heading_font": "nome font Google Fonts per titoli",
    "body_font": "nome font Google Fonts per corpo",
    "heading_weight": "peso font titoli (es. 700)",
    "body_weight": "peso font corpo (es. 400)",
    "font_rationale": "perché questi font comunicano il brand"
  },
  "visual_style": {
    "overall_aesthetic": "estetica generale (es. minimal, bold, elegant, playful)",
    "border_radius": "valore px per angoli",
    "shadow_style": "stile ombre (es. subtle, pronounced, none)",
    "spacing_feel": "sensazione spaziatura (generous, balanced, compact)",
    "imagery_direction": "direzione artistica per immagini",
    "icon_style": "stile icone (outlined, filled, duotone)"
  },
  "messaging": {
    "headline_formula": "formula per headline (es. [Risultato] senza [Problema])",
    "value_proposition": "proposta di valore in una frase",
    "key_benefits": ["beneficio 1", "beneficio 2", "beneficio 3"],
    "social_proof_approach": "come usare la riprova sociale",
    "urgency_strategy": "strategia di urgenza/scarsità",
    "cta_primary_text": "testo CTA principale",
    "cta_secondary_text": "testo CTA secondaria"
  },
  "quiz_strategy": {
    "quiz_hook": "gancio del quiz (perché l'utente dovrebbe farlo)",
    "quiz_title": "titolo del quiz",
    "quiz_subtitle": "sottotitolo del quiz",
    "question_themes": ["tema domanda 1", "tema domanda 2", "..."],
    "result_types": ["tipo risultato 1", "tipo risultato 2", "..."],
    "lead_magnet_angle": "angolo per la cattura email",
    "conversion_strategy": "strategia di conversione post-quiz"
  },
  "swipe_notes": {
    "what_i_kept_from_original": ["cosa ho preso dall'originale"],
    "what_i_changed": ["cosa ho cambiato e perché"],
    "improvement_opportunities": ["opportunità di miglioramento rispetto all'originale"]
  }
}

IMPORTANTE:
- I colori devono essere DIVERSI dall'originale, specifici per il MIO brand
- Il tono deve riflettere il MIO prodotto, non il competitor
- Prendi ispirazione dalla STRUTTURA e dalle BEST PRACTICES, non dal branding letterale
- Le domande del quiz devono essere pertinenti al MIO settore e target`;

  return {
    system,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshot } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  };
}

// ─── Phase 2: SWIPE REGENERATE ───────────────────────────────────────────────
// Claude prende il branding del mio prodotto + l'analisi originale
// e rigenera una nuova analysis completa "swipata" per il mio prodotto
function buildSwipeRegenerateMessages(
  screenshot: string,
  originalAnalysis: Record<string, unknown>,
  myBranding: Record<string, unknown>
): { messages: ClaudeMessage[]; system: string } {
  const system = `Sei un esperto di funnel marketing, quiz design e conversion optimization.
Il tuo compito è rigenerare un'analisi completa per un nuovo quiz funnel, combinando le best practices del design originale con il branding personalizzato del cliente.

Questa è la fase finale dello "swipe": devi produrre un'analisi completa e pronta per la generazione del codice.

RISPONDI SOLO con un oggetto JSON valido, senza markdown, senza blocchi di codice.`;

  const prompt = `Rigenera un'analisi completa "swipata" per il mio prodotto, combinando le best practices del competitor con il mio branding.

═══ ANALISI ORIGINALE (COMPETITOR) ═══
${JSON.stringify(originalAnalysis, null, 2)}

═══ IL MIO BRANDING (generato nella fase precedente) ═══
${JSON.stringify(myBranding, null, 2)}

═══ ISTRUZIONI ═══
Genera un JSON con ESATTAMENTE la stessa struttura dell'analisi originale ma con TUTTI i valori adattati al MIO brand.
La struttura deve avere queste sezioni:

{
  "brand_identity": {
    "brand_name": "dal mio branding",
    "logo_description": "descrizione del logo ideale per il mio brand",
    "brand_personality": "dal mio branding",
    "target_audience": "dal mio branding, più dettagliato",
    "industry": "dal mio branding"
  },
  "color_palette": {
    "primary_color": "#hex dal mio branding",
    "secondary_color": "#hex dal mio branding",
    "accent_color": "#hex dal mio branding",
    "background_color": "#hex dal mio branding",
    "text_color": "#hex dal mio branding",
    "all_colors": ["array completo dei miei colori"],
    "color_scheme_type": "tipo schema colori",
    "color_mood": "mood della mia palette"
  },
  "typography": {
    "heading_font_style": "dal mio branding",
    "body_font_style": "dal mio branding",
    "font_weight_pattern": "pattern pesi tipografici",
    "text_hierarchy": "gerarchia testuale ottimizzata"
  },
  "layout_structure": {
    "layout_type": "mantieni struttura efficace dell'originale",
    "sections": ["sezioni adattate al mio contenuto"],
    "navigation_style": "stile navigazione",
    "hero_section": "hero adattata al mio messaggio",
    "content_density": "densità contenuto",
    "whitespace_usage": "uso spazi bianchi"
  },
  "visual_elements": {
    "images_style": "stile immagini per il mio brand",
    "icons_style": "dal mio branding",
    "buttons_style": "stile bottoni con i miei colori",
    "cards_style": "stile card con il mio design",
    "decorative_elements": ["elementi decorativi"],
    "animations_detected": "animazioni consigliate"
  },
  "cta_analysis": {
    "primary_cta_text": "dal mio branding/messaging",
    "primary_cta_style": "stile CTA con i miei colori",
    "secondary_ctas": ["CTA secondarie"],
    "cta_placement": "posizionamento ottimale"
  },
  "quiz_funnel_elements": {
    "is_quiz_funnel": true,
    "quiz_type": "tipo di quiz per il mio prodotto",
    "question_style": "stile domande",
    "answer_format": "formato risposte",
    "progress_indicator": "indicatore progresso",
    "steps_detected": "numero step consigliati"
  },
  "overall_assessment": {
    "design_quality_score": 8-10,
    "modernity_score": 8-10,
    "conversion_optimization_score": 8-10,
    "mobile_readiness_estimate": "ottima",
    "key_strengths": ["punti di forza del mio design swipato"],
    "improvement_suggestions": ["suggerimenti per migliorare ulteriormente"],
    "design_style_tags": ["tag stile"]
  },
  "my_branding_summary": {
    "brand_name": "nome",
    "value_proposition": "proposta di valore",
    "key_benefits": ["benefici"],
    "quiz_hook": "gancio quiz",
    "quiz_title": "titolo quiz",
    "quiz_subtitle": "sottotitolo quiz",
    "cta_primary": "CTA principale",
    "lead_magnet_angle": "angolo lead magnet",
    "conversion_strategy": "strategia conversione"
  }
}

CRITICO:
- I COLORI devono essere quelli del MIO branding, NON dell'originale
- Le CTA devono usare il MESSAGING del MIO brand
- La struttura layout deve seguire le best practices dell'originale
- Il quiz deve essere pertinente al MIO prodotto e target
- I punteggi devono essere realistici ma ottimistici (è un design nuovo ottimizzato)`;

  return {
    system,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshot } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      phase,
      screenshot,
      originalAnalysis,
      productInfo,
      myBranding,
    } = body as {
      phase: Phase;
      screenshot: string;
      originalAnalysis: Record<string, unknown>;
      productInfo?: {
        product_name: string;
        product_description: string;
        target_audience: string;
        industry: string;
        tone_of_voice: string;
        unique_selling_points: string;
      };
      myBranding?: Record<string, unknown>;
    };

    if (!phase) {
      return NextResponse.json({ error: 'phase è obbligatorio' }, { status: 400 });
    }

    const claudeKey = (process.env.ANTHROPIC_API_KEY ?? '').trim();
    if (!claudeKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY non configurata.' },
        { status: 500 }
      );
    }

    const startTime = Date.now();

    // ─── PHASE 1: MY BRANDING ────────────────────────────
    if (phase === 'my-branding') {
      if (!screenshot || !originalAnalysis || !productInfo) {
        return NextResponse.json(
          { error: 'screenshot, originalAnalysis e productInfo sono obbligatori per la fase my-branding' },
          { status: 400 }
        );
      }

      const { messages, system } = buildMyBrandingMessages(screenshot, originalAnalysis, productInfo);
      const rawText = await callClaude(messages, claudeKey, 8192, system);
      const brandingData = parseJsonSafe(rawText);

      return NextResponse.json({
        success: !!brandingData,
        phase: 'my-branding',
        myBranding: brandingData,
        myBrandingRaw: !brandingData ? rawText : undefined,
        duration_ms: Date.now() - startTime,
      });
    }

    // ─── PHASE 2: SWIPE REGENERATE ───────────────────────
    if (phase === 'swipe-regenerate') {
      if (!screenshot || !originalAnalysis || !myBranding) {
        return NextResponse.json(
          { error: 'screenshot, originalAnalysis e myBranding sono obbligatori per la fase swipe-regenerate' },
          { status: 400 }
        );
      }

      const { messages, system } = buildSwipeRegenerateMessages(screenshot, originalAnalysis, myBranding);
      const rawText = await callClaude(messages, claudeKey, 8192, system);
      const swipedAnalysis = parseJsonSafe(rawText);

      return NextResponse.json({
        success: !!swipedAnalysis,
        phase: 'swipe-regenerate',
        swipedAnalysis,
        swipedAnalysisRaw: !swipedAnalysis ? rawText : undefined,
        duration_ms: Date.now() - startTime,
      });
    }

    return NextResponse.json({ error: `Fase non valida: ${phase}` }, { status: 400 });
  } catch (error) {
    console.error('[quiz-creator/swipe-analysis] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Errore durante lo swipe',
      },
      { status: 500 }
    );
  }
}

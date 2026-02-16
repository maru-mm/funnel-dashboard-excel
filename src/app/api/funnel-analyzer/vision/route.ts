import { NextRequest, NextResponse } from 'next/server';
import type { FunnelCrawlStep, FunnelPageVisionAnalysis, FunnelPageType } from '@/types';

const VISION_PROMPT = `Analizza questa pagina di funnel (screenshot). Restituisci SOLO un oggetto JSON valido, senza markdown né blocchi di codice, con esattamente queste chiavi (usa null per stringhe mancanti e array vuoti [] dove appropriato):
- page_type: una di: "opt-in", "vsl", "sales_page", "order_form", "upsell", "downsell", "thank_you", "bridge_page", "landing", "checkout", "other"
- headline: stringa o null
- subheadline: stringa o null
- body_copy: testo principale (estratto) o null
- cta_text: array di testi dei bottoni/CTA (tutti i CTA visibili)
- next_step_ctas: array delle principali CTA che portano allo step successivo del funnel (es. "Acquista Ora", "Vai al checkout", "Continua", "Iscriviti") — escludi link secondari come privacy, cookie, torna indietro
- offer_details: descrizione offerta o null
- price_points: array di prezzi/testi prezzo rilevati
- urgency_elements: array (es. "scadenza", "posti limitati", countdown)
- social_proof: array (testimonianze, numeri, loghi)
- tech_stack_detected: array (es. ClickFunnels, Shopify, Stripe, Mailchimp - da layout/script)
- outbound_links: array di destinazioni principali (es. URL checkout, privacy)
- persuasion_techniques_used: array (es. "scarcity", "authority", "risk reversal")`;

const PAGE_TYPES: FunnelPageType[] = [
  'opt-in', 'vsl', 'sales_page', 'order_form', 'upsell', 'downsell',
  'thank_you', 'bridge_page', 'landing', 'checkout', 'other',
];

function parseJsonFromResponse(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  let jsonStr = trimmed;
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1].trim();
  try {
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeAnalysis(
  step: FunnelCrawlStep,
  raw: Record<string, unknown>
): FunnelPageVisionAnalysis {
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x) => typeof x === 'string').map(String) : [];
  const str = (v: unknown): string | null =>
    typeof v === 'string' && v.trim() ? v.trim() : null;
  const pageType = typeof raw.page_type === 'string' && PAGE_TYPES.includes(raw.page_type as FunnelPageType)
    ? (raw.page_type as FunnelPageType)
    : 'other';

  return {
    stepIndex: step.stepIndex,
    url: step.url,
    page_type: pageType,
    headline: str(raw.headline),
    subheadline: str(raw.subheadline),
    body_copy: str(raw.body_copy),
    cta_text: arr(raw.cta_text),
    next_step_ctas: arr(raw.next_step_ctas),
    offer_details: str(raw.offer_details),
    price_points: arr(raw.price_points),
    urgency_elements: arr(raw.urgency_elements),
    social_proof: arr(raw.social_proof),
    tech_stack_detected: arr(raw.tech_stack_detected),
    outbound_links: arr(raw.outbound_links),
    persuasion_techniques_used: arr(raw.persuasion_techniques_used),
  };
}

async function analyzeWithClaude(
  screenshotBase64: string,
  context: string,
  apiKey: string
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshotBase64,
              },
            },
            {
              type: 'text',
              text: `${VISION_PROMPT}\n\nContesto: ${context}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = (await response.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
  return text;
}

async function analyzeWithGemini(
  screenshotBase64: string,
  context: string,
  apiKey: string
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: 'image/png',
                  data: screenshotBase64,
                },
              },
              { text: `${VISION_PROMPT}\n\nContesto: ${context}` },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.2,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return text;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { steps, provider } = body as {
      steps: FunnelCrawlStep[];
      provider: 'claude' | 'gemini';
    };

    if (!Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { success: false, error: 'steps array is required and must not be empty' },
        { status: 400 }
      );
    }

    const rawClaude = (process.env.ANTHROPIC_API_KEY ?? '').trim();
    const rawGemini = (
      (process.env.GEMINI_API_KEY ?? '') ||
      (process.env.GOOGLE_GEMINI_API_KEY ?? '')
    ).trim();
    const apiKey = provider === 'claude' ? rawClaude : rawGemini;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: provider === 'claude'
            ? 'Chiave mancante: aggiungi ANTHROPIC_API_KEY in .env.local (nella root del progetto) e riavvia il server (npm run dev).'
            : 'Chiave mancante: aggiungi GOOGLE_GEMINI_API_KEY (o GEMINI_API_KEY) in .env.local (nella root del progetto) e riavvia il server (npm run dev).',
        },
        { status: 400 }
      );
    }

    const analyses: FunnelPageVisionAnalysis[] = [];
    const errors: string[] = [];

    for (const step of steps) {
      if (!step.screenshotBase64) {
        analyses.push({
          stepIndex: step.stepIndex,
          url: step.url,
          page_type: 'other',
          headline: null,
          subheadline: null,
          body_copy: null,
          cta_text: [],
          next_step_ctas: [],
          offer_details: null,
          price_points: [],
          urgency_elements: [],
          social_proof: [],
          tech_stack_detected: [],
          outbound_links: [],
          persuasion_techniques_used: [],
          error: 'No screenshot for this step',
        });
        continue;
      }

      const context = `URL: ${step.url}. Title: ${step.title}. CTAs from crawl: ${step.ctaButtons.map((b) => b.text).join(', ')}.`;

      try {
        const rawText =
          provider === 'claude'
            ? await analyzeWithClaude(step.screenshotBase64, context, apiKey)
            : await analyzeWithGemini(step.screenshotBase64, context, apiKey);

        const parsed = parseJsonFromResponse(rawText);
        if (parsed) {
          analyses.push(normalizeAnalysis(step, parsed));
        } else {
        analyses.push({
          ...normalizeAnalysis(step, { next_step_ctas: [] }),
          raw: rawText.slice(0, 500),
          error: 'Could not parse JSON from model',
        });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Step ${step.stepIndex}: ${msg}`);
        analyses.push({
          stepIndex: step.stepIndex,
          url: step.url,
          page_type: 'other',
          headline: null,
          subheadline: null,
          body_copy: null,
          cta_text: [],
          next_step_ctas: [],
          offer_details: null,
          price_points: [],
          urgency_elements: [],
          social_proof: [],
          tech_stack_detected: [],
          outbound_links: [],
          persuasion_techniques_used: [],
          error: msg,
        });
      }
    }

    return NextResponse.json({
      success: errors.length < steps.length,
      analyses,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Funnel vision error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Vision analysis failed',
      },
      { status: 500 }
    );
  }
}

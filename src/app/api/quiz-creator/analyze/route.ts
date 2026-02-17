import { NextRequest, NextResponse } from 'next/server';
import { launchBrowser, type Browser } from '@/lib/get-browser';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const BRANDING_VISION_PROMPT = `Sei un esperto di design, branding e UI/UX. Analizza questo screenshot di una pagina web e restituisci SOLO un oggetto JSON valido (senza markdown, senza blocchi di codice) con ESATTAMENTE queste chiavi:

{
  "brand_identity": {
    "brand_name": "nome del brand rilevato (o null)",
    "logo_description": "descrizione del logo se visibile (o null)",
    "brand_personality": "personalità del brand (es. professionale, giovanile, lussuoso, amichevole)",
    "target_audience": "pubblico target stimato",
    "industry": "settore/industria"
  },
  "color_palette": {
    "primary_color": "#hex del colore primario",
    "secondary_color": "#hex del colore secondario",
    "accent_color": "#hex del colore di accento",
    "background_color": "#hex del colore di sfondo principale",
    "text_color": "#hex del colore del testo principale",
    "all_colors": ["array di tutti i colori hex rilevati nella pagina"],
    "color_scheme_type": "tipo di schema (monocromatico, complementare, analogo, triadico, ecc.)",
    "color_mood": "mood trasmesso dalla palette (es. energico, calmo, professionale, lussuoso)"
  },
  "typography": {
    "heading_font_style": "stile del font dei titoli (serif, sans-serif, display, ecc.)",
    "body_font_style": "stile del font del corpo testo",
    "font_weight_pattern": "pattern dei pesi tipografici usati",
    "text_hierarchy": "descrizione della gerarchia tipografica"
  },
  "layout_structure": {
    "layout_type": "tipo di layout (single column, grid, hero+content, ecc.)",
    "sections": ["array delle sezioni identificate nella pagina"],
    "navigation_style": "stile della navigazione",
    "hero_section": "descrizione della hero section se presente (o null)",
    "content_density": "densità del contenuto (minimalista, moderata, densa)",
    "whitespace_usage": "uso degli spazi bianchi (generoso, equilibrato, compresso)"
  },
  "visual_elements": {
    "images_style": "stile delle immagini (foto, illustrazioni, icone, mix)",
    "icons_style": "stile delle icone se presenti",
    "buttons_style": "stile dei bottoni (rounded, square, pill, ghost, ecc.)",
    "cards_style": "stile delle card se presenti (con ombra, bordo, flat)",
    "decorative_elements": ["elementi decorativi rilevati"],
    "animations_detected": "animazioni o effetti dinamici rilevati"
  },
  "cta_analysis": {
    "primary_cta_text": "testo della CTA principale",
    "primary_cta_style": "stile della CTA principale (colore, forma, dimensione)",
    "secondary_ctas": ["testi delle CTA secondarie"],
    "cta_placement": "posizionamento delle CTA nella pagina"
  },
  "quiz_funnel_elements": {
    "is_quiz_funnel": true/false,
    "quiz_type": "tipo di quiz se rilevato (personality, scored, branching, ecc.) o null",
    "question_style": "stile delle domande se rilevato",
    "answer_format": "formato delle risposte (bottoni, card, slider, ecc.) o null",
    "progress_indicator": "indicatore di progresso se presente",
    "steps_detected": "numero di step/pagine del quiz rilevati o null"
  },
  "overall_assessment": {
    "design_quality_score": 1-10,
    "modernity_score": 1-10,
    "conversion_optimization_score": 1-10,
    "mobile_readiness_estimate": "stima della reattività mobile (buona, media, scarsa)",
    "key_strengths": ["punti di forza del design"],
    "improvement_suggestions": ["suggerimenti di miglioramento"],
    "design_style_tags": ["tag dello stile (es. minimal, corporate, playful, bold, elegant)"]
  }
}`;

function parseJsonResponse(text: string): Record<string, unknown> | null {
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

export async function POST(request: NextRequest) {
  let browser: Browser | null = null;

  try {
    const { url, screenshotDelay } = (await request.json()) as {
      url: string;
      screenshotDelay?: number;
    };

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Il campo "url" è obbligatorio' },
        { status: 400 }
      );
    }

    const geminiKey = (
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLE_GEMINI_API_KEY ??
      ''
    ).trim();

    if (!geminiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_GEMINI_API_KEY non configurata. Aggiungi la chiave in .env.local e riavvia il server.' },
        { status: 500 }
      );
    }

    // Step 1: Screenshot with Playwright
    browser = await launchBrowser();

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    // Use domcontentloaded first (fast), then wait for additional rendering.
    // networkidle often times out on modern pages with analytics/websockets.
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
    } catch (navErr) {
      // If even domcontentloaded fails, try with just commit
      await page.goto(url, {
        waitUntil: 'commit',
        timeout: 30_000,
      });
    }

    // Wait for visual rendering to settle.
    // If a custom screenshotDelay is provided (in seconds), use that as the total wait time.
    // Otherwise, use the default strategy: 4s + networkidle attempt + 1.5s.
    const customDelayMs = screenshotDelay && screenshotDelay > 0
      ? Math.round(screenshotDelay * 1000)
      : 0;

    if (customDelayMs > 0) {
      await page.waitForTimeout(customDelayMs);
    } else {
      await page.waitForTimeout(4000);

      // Try to wait for network to settle (best-effort, don't fail if it doesn't)
      try {
        await page.waitForLoadState('networkidle', { timeout: 8_000 });
      } catch {
        // Page has continuous network activity - that's fine, we have the DOM
      }

      await page.waitForTimeout(1500);
    }

    // Dismiss cookie banners
    try {
      const dismissSelectors = [
        '[class*="cookie"] button',
        '[class*="consent"] button',
        '[class*="popup"] [class*="close"]',
        '[class*="modal"] [class*="close"]',
        'button[aria-label="Close"]',
        'button[aria-label="Chiudi"]',
        'button[aria-label="Accept"]',
        'button[aria-label="Accetta"]',
      ];
      for (const sel of dismissSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
          await btn.click({ timeout: 1000 }).catch(() => {});
          await page.waitForTimeout(500);
        }
      }
    } catch {
      // Ignore
    }

    const screenshotBuffer = await page.screenshot({
      fullPage: false,
      type: 'png',
      timeout: 60_000,
    });

    const screenshotBase64 = screenshotBuffer.toString('base64');
    const pageTitle = await page.title();

    await browser.close();
    browser = null;

    // Step 2: Gemini Vision Analysis
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
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
                {
                  text: `${BRANDING_VISION_PROMPT}\n\nURL analizzato: ${url}\nTitolo pagina: ${pageTitle}`,
                },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.3,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      return NextResponse.json(
        {
          error: `Gemini API error: ${geminiResponse.status}`,
          details: errText.slice(0, 500),
          screenshot: screenshotBase64,
          title: pageTitle,
        },
        { status: 502 }
      );
    }

    const geminiData = (await geminiResponse.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const analysis = parseJsonResponse(rawText);

    return NextResponse.json({
      success: true,
      url,
      title: pageTitle,
      screenshot: screenshotBase64,
      analysis: analysis ?? rawText,
      analysisRaw: !analysis ? rawText : undefined,
    });
  } catch (error) {
    console.error('[quiz-creator/analyze] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Errore durante l\'analisi',
      },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 800;
export const dynamic = 'force-dynamic';

import {
  runVisualBlueprintAnalysis,
  runQuizLogicBlueprintAnalysis,
} from '@/lib/quiz-multiagent-engine';
import { generateBranding, buildBrandingInputFromDb } from '@/lib/branding-generator';
import { fetchFunnelCrawlStepsByFunnel } from '@/lib/supabase-operations';
import type { VisualBlueprint, QuizBlueprint } from '@/lib/quiz-multiagent-types';
import type { GeneratedBranding } from '@/types';
import { supabase } from '@/lib/supabase';

// =====================================================
// TYPES
// =====================================================

interface ProductData {
  name: string;
  description: string;
  price: number;
  benefits: string[];
  ctaText: string;
  ctaUrl: string;
  brandName: string;
  imageUrl?: string;
}

interface AffiliateFunnelStep {
  step_index: number;
  url: string;
  title: string;
  step_type?: string;
  input_type?: string;
  options?: string[];
  description?: string;
  cta_text?: string;
}

interface RequestBody {
  entryUrl: string;
  funnelName: string;
  product: ProductData;
  funnelSteps?: AffiliateFunnelStep[];
  funnelMeta?: Record<string, unknown>;
  extraInstructions?: string;
  mode?: 'background' | 'streaming';
}

// =====================================================
// SSE HELPERS
// =====================================================

function sseEncode(data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

// =====================================================
// SCREENSHOT + STEPS FETCHER
// =====================================================

async function fetchScreenshotsAndSteps(
  entryUrl: string,
  funnelName: string,
  funnelSteps?: AffiliateFunnelStep[],
) {
  let screenshots: string[] = [];
  let stepsInfo: Array<{ index: number; title: string; type: string; options?: string[] }> = [];

  try {
    const crawlSteps = await fetchFunnelCrawlStepsByFunnel(entryUrl, funnelName);
    screenshots = crawlSteps
      .filter(r => r.screenshot_base64)
      .map(r => r.screenshot_base64!);
    stepsInfo = crawlSteps.map(r => {
      const sd = r.step_data as Record<string, unknown> | null;
      return {
        index: r.step_index,
        title: r.title || `Step ${r.step_index}`,
        type: (sd?.step_type as string) || 'other',
        options: Array.isArray(sd?.options) ? (sd.options as string[]) : undefined,
      };
    });
  } catch { /* no crawl data */ }

  if (stepsInfo.length === 0 && funnelSteps) {
    stepsInfo = funnelSteps.map(s => ({
      index: s.step_index,
      title: s.title,
      type: s.step_type || 'other',
      options: s.options,
    }));
  }

  return { screenshots, stepsInfo };
}

// =====================================================
// LIVE SCREENSHOT CAPTURE (fallback when DB has none)
// =====================================================

interface LiveScreenshotResult {
  screenshots: string[];
  cssTokens: import('@/app/api/swipe-quiz/screenshot/route').CssTokens | null;
}

async function captureLiveScreenshots(
  entryUrl: string,
  funnelSteps?: AffiliateFunnelStep[],
  onProgress?: (msg: string) => void,
): Promise<LiveScreenshotResult> {
  const { launchBrowser } = await import('@/lib/get-browser');

  const screenshots: string[] = [];
  let cssTokens: import('@/app/api/swipe-quiz/screenshot/route').CssTokens | null = null;

  // Collect ALL unique URLs from steps
  const urlsToCapture: string[] = [entryUrl];
  if (funnelSteps) {
    const seen = new Set<string>([entryUrl]);
    for (const step of funnelSteps) {
      if (step.url && !seen.has(step.url)) {
        seen.add(step.url);
        urlsToCapture.push(step.url);
      }
    }
  }

  const totalUrls = urlsToCapture.length;
  onProgress?.(`Avvio Playwright — ${totalUrls} pagine da catturare...`);

  const browser = await launchBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  try {
    for (let i = 0; i < totalUrls; i++) {
      const url = urlsToCapture[i];
      const slug = url.split('/').filter(Boolean).pop() || url;
      onProgress?.(`Screenshot ${i + 1}/${totalUrls}: ${slug}`);

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(1500);

        // Dismiss popups on first page only
        if (i === 0) {
          try {
            const dismissSelectors = [
              '[class*="cookie"] button', '[class*="consent"] button',
              '[class*="popup"] [class*="close"]', '[class*="modal"] [class*="close"]',
              'button[aria-label="Close"]', 'button[aria-label="Chiudi"]',
            ];
            for (const sel of dismissSelectors) {
              const btn = page.locator(sel).first();
              if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
                await btn.click({ timeout: 500 }).catch(() => {});
                await page.waitForTimeout(300);
              }
            }
          } catch { /* ignore */ }
        }

        const buf = await page.screenshot({ fullPage: true, type: 'png', timeout: 10000 });
        screenshots.push(buf.toString('base64'));

        // Extract CSS tokens from the first page
        if (i === 0) {
          try {
            cssTokens = await page.evaluate(() => {
              function getTokens(selectors: string[]) {
                for (const sel of selectors) {
                  const el = document.querySelector(sel);
                  if (!el) continue;
                  const s = window.getComputedStyle(el);
                  return {
                    color: s.color, bg: s.backgroundColor, fontFamily: s.fontFamily,
                    fontSize: s.fontSize, fontWeight: s.fontWeight, borderRadius: s.borderRadius,
                    padding: s.padding, boxShadow: s.boxShadow, border: s.border,
                    lineHeight: s.lineHeight, maxWidth: s.maxWidth,
                  };
                }
                return null;
              }
              return {
                body: getTokens(['body']),
                heading: getTokens(['h1', 'h2', '[class*="title"]', '[class*="heading"]', '[class*="headline"]', '[class*="question"]']),
                button: getTokens(['button[class*="cta"]', 'button[class*="primary"]', 'button[class*="btn"]', 'a[class*="cta"]', 'a[class*="btn"]', 'button:not([class*="close"]):not([class*="dismiss"])']),
                card: getTokens(['[class*="option"]', '[class*="card"]', '[class*="answer"]', '[class*="choice"]', '[class*="item"]']),
                progressBar: getTokens(['[class*="progress"]', '[role="progressbar"]', '[class*="step-indicator"]']),
                container: getTokens(['[class*="container"]', '[class*="wrapper"]', 'main', '[class*="content"]', '[class*="quiz"]']),
                link: getTokens(['a[href]', '[class*="link"]']),
              };
            });
          } catch { /* best effort */ }
        }
      } catch (err) {
        console.warn(`[multiagent-v2] Screenshot failed for ${url}:`, err instanceof Error ? err.message : err);
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(`[multiagent-v2] Captured ${screenshots.length}/${totalUrls} screenshots in single browser session`);
  return { screenshots, cssTokens };
}

// =====================================================
// BRANDING GENERATOR
// =====================================================

async function generateBrandingForProduct(
  entryUrl: string,
  funnelName: string,
  product: ProductData,
  funnelMeta?: Record<string, unknown>,
): Promise<GeneratedBranding | null> {
  try {
    const crawlSteps = await fetchFunnelCrawlStepsByFunnel(entryUrl, funnelName);
    if (crawlSteps.length === 0) return null;

    const brandingInput = buildBrandingInputFromDb(
      {
        name: product.name,
        description: product.description,
        price: product.price,
        benefits: product.benefits,
        cta_text: product.ctaText,
        cta_url: product.ctaUrl,
        brand_name: product.brandName,
        image_url: product.imageUrl,
      },
      crawlSteps.map(row => ({
        step_index: row.step_index,
        url: row.url,
        title: row.title,
        step_data: row.step_data,
        vision_analysis: row.vision_analysis,
        funnel_name: row.funnel_name,
        entry_url: row.entry_url,
        funnel_tag: row.funnel_tag,
      })),
      {
        provider: 'gemini',
        tone: 'professional',
        language: 'it',
        funnelType: funnelMeta?.funnel_type as string,
        analysisSummary: funnelMeta?.analysis_summary as string,
        persuasionTechniques: funnelMeta?.persuasion_techniques as string[],
        leadCaptureMethod: funnelMeta?.lead_capture_method as string,
        notableElements: funnelMeta?.notable_elements as string[],
      },
    );

    const result = await generateBranding(brandingInput);
    return result.success && result.branding ? result.branding : null;
  } catch (err) {
    console.warn('[multiagent-v2] Branding generation failed:', err);
    return null;
  }
}

function buildFallbackBranding(
  product: ProductData,
  funnelName: string,
  funnelSteps?: AffiliateFunnelStep[],
): GeneratedBranding {
  return {
    brandIdentity: {
      brandName: product.brandName,
      tagline: '',
      voiceTone: 'professional',
      emotionalHook: '',
      uniqueSellingProposition: product.description,
      colorPalette: { primary: '#2563EB', secondary: '#1E40AF', accent: '#F59E0B', background: '#FFFFFF', text: '#1F2937', ctaBackground: '#16A34A', ctaText: '#FFFFFF' },
      typography: { headingStyle: 'Inter Bold', bodyStyle: 'Inter Regular' },
    },
    funnelSteps: (funnelSteps || []).map((s, i) => ({
      stepIndex: i,
      originalPageType: s.step_type || 'other',
      headline: s.title || '',
      subheadline: '',
      bodyCopy: s.description || '',
      ctaTexts: s.cta_text ? [s.cta_text] : [product.ctaText],
      nextStepCtas: [],
      offerDetails: null,
      pricePresentation: `€${product.price}`,
      urgencyElements: [],
      socialProof: [],
      persuasionTechniques: [],
      quizQuestion: s.step_type === 'quiz_question' ? s.title : undefined,
      quizOptions: s.options,
    })),
    globalElements: {
      socialProofStatements: [],
      urgencyElements: [],
      trustBadges: [],
      guaranteeText: '',
      disclaimerText: '',
      footerCopyright: `© ${new Date().getFullYear()} ${product.brandName}`,
      headerText: product.brandName,
    },
    swipeInstructions: '',
    metadata: {
      provider: 'fallback',
      model: 'none',
      generatedAt: new Date().toISOString(),
      referenceFunnelName: funnelName,
      referenceFunnelType: 'quiz_funnel',
      productName: product.name,
      language: 'it',
      tone: 'professional',
    },
  };
}

// =====================================================
// UNIFIED PROMPT — Single Claude call for complete HTML
// =====================================================

function buildUnifiedPrompt(
  visualBlueprint: VisualBlueprint,
  quizBlueprint: QuizBlueprint,
  branding: GeneratedBranding,
  product: ProductData,
  extraInstructions: string,
): string {
  let prompt = '';
  const ds = visualBlueprint.design_system;
  const layout = visualBlueprint.layout;
  const mood = visualBlueprint.visual_mood;
  const ux = visualBlueprint.ux_flow;
  const screens = quizBlueprint.quiz_content?.screens || [];
  const scoring = quizBlueprint.scoring_system;
  const resultProfiles = quizBlueprint.result_profiles || [];

  // ─── VISUAL DESIGN SPEC ───
  prompt += `=== VISUAL DESIGN (replica questi valori ESATTI dal quiz originale) ===\n`;
  if (ds?.colors) {
    prompt += `COLORI:\n`;
    prompt += `  Primario: ${ds.colors.primary || '#4F46E5'}\n`;
    prompt += `  Secondario: ${ds.colors.secondary || '#7C3AED'}\n`;
    prompt += `  Accento: ${ds.colors.accent || '#F59E0B'}\n`;
    prompt += `  Background pagina: ${ds.colors.background_page || '#F8FAFC'}\n`;
    prompt += `  Background card: ${ds.colors.background_card || '#FFFFFF'}\n`;
    prompt += `  Testo heading: ${ds.colors.text_heading || '#1F2937'}\n`;
    prompt += `  Testo body: ${ds.colors.text_body || '#4B5563'}\n`;
    prompt += `  Bottone BG: ${ds.colors.button_primary_bg || '#4F46E5'}\n`;
    prompt += `  Bottone testo: ${ds.colors.button_primary_text || '#FFFFFF'}\n`;
    prompt += `  Bordo default: ${ds.colors.border_default || '#E5E7EB'}\n`;
    prompt += `  Bordo selezionato: ${ds.colors.border_selected || '#4F46E5'}\n`;
    prompt += `  Progress fill: ${ds.colors.progress_fill || '#4F46E5'}\n`;
    prompt += `  Opzione selezionata BG: ${ds.colors.option_selected_bg || '#EEF2FF'}\n`;
  }
  if (ds?.gradients?.length > 0) {
    prompt += `GRADIENTI: ${ds.gradients.map(g => `${g.css} (${g.applied_to})`).join('; ')}\n`;
  }
  if (ds?.typography) {
    prompt += `TIPOGRAFIA:\n`;
    prompt += `  Font: ${ds.typography.font_family_primary || 'Inter, system-ui, sans-serif'}\n`;
    prompt += `  Heading: ${ds.typography.heading_large?.size || '28px'}/${ds.typography.heading_large?.weight || '700'}\n`;
    prompt += `  Body: ${ds.typography.body?.size || '16px'}/${ds.typography.body?.weight || '400'}\n`;
    prompt += `  Bottone: ${ds.typography.button?.size || '16px'}/${ds.typography.button?.weight || '600'}\n`;
  }
  if (ds?.spacing) {
    prompt += `SPACING: page=${ds.spacing.page_padding || '24px'}, card=${ds.spacing.card_padding || '16px 20px'}, opzioni gap=${ds.spacing.between_options || '12px'}\n`;
  }
  if (ds?.dimensions) {
    prompt += `DIMENSIONI: container=${ds.dimensions.container_max_width || '520px'}, btn-h=${ds.dimensions.button_height || '52px'}, btn-radius=${ds.dimensions.button_border_radius || '12px'}, card-radius=${ds.dimensions.card_border_radius || '12px'}, progress-h=${ds.dimensions.progress_bar_height || '6px'}\n`;
  }
  if (ds?.shadows) {
    prompt += `OMBRE: card=${ds.shadows.card_default || 'none'}, card-hover=${ds.shadows.card_hover || 'none'}, btn=${ds.shadows.button || 'none'}\n`;
  }
  if (ds?.animations) {
    prompt += `ANIMAZIONI: step-enter=${ds.animations.step_transition?.type || 'fadeIn'} ${ds.animations.step_transition?.duration_ms || 400}ms, auto-advance=${ds.animations.auto_advance_delay_ms || 700}ms\n`;
  }
  prompt += `LAYOUT: sfondo=${layout?.page_background || '#F8FAFC'}, container=${layout?.container_style || 'centered'}, opzioni=${layout?.option_layout_default || 'vertical_list'}, stile-card=${layout?.option_card_style || 'bordered-card'}, emoji=${layout?.option_has_icon_or_emoji ?? true}, btn-width=${layout?.cta_button_width || 'full-width'}\n`;
  prompt += `MOOD: ${mood?.overall_style || 'modern'}, ${mood?.color_mood || 'light'}, illustrazioni=${mood?.illustration_style || 'none'}\n\n`;

  // ─── UX FLOW ───
  prompt += `=== FLUSSO UX (${ux?.total_screens || screens.length} schermate) ===\n`;
  if (ux?.screens) {
    for (const s of ux.screens) {
      prompt += `Screen ${s.index} [${s.type}]: ${s.options_count || 0} opzioni, layout=${s.options_layout || 'list'}`;
      if (s.auto_advance) prompt += `, auto-avanza`;
      if (s.has_progress_bar) prompt += `, progress="${s.progress_format}"`;
      if (s.cta_text) prompt += `, CTA="${s.cta_text}"`;
      prompt += `\n`;
    }
  }
  prompt += `Progress bar: ${ux?.progress_bar?.type || 'continuous'}, posizione=${ux?.progress_bar?.position || 'top'}, formato="${ux?.progress_bar?.label_format || '{current}/{total}'}"\n`;
  prompt += `Auto-advance delay: ${ux?.interaction?.advance_delay_ms || 700}ms\n`;
  prompt += `Back button: ${ux?.interaction?.back_button_style || 'none'}\n\n`;

  // ─── QUIZ CONTENT FROM ORIGINAL (STRUCTURE REFERENCE ONLY) ───
  prompt += `=== STRUTTURA QUIZ ORIGINALE (usa come SCHEMA, ma RISCRIVI tutto per il nuovo prodotto) ===\n`;
  prompt += `IMPORTANTE: Questi sono i testi ORIGINALI. NON copiarli. Usali solo per capire:\n`;
  prompt += `- Quanti step ci sono e di che tipo\n`;
  prompt += `- Quante opzioni per domanda\n`;
  prompt += `- Il flow (intro → domande → info → loading → risultato)\n`;
  prompt += `DEVI riscrivere TUTTO adattandolo al prodotto "${product.name}" di "${product.brandName}".\n\n`;
  for (const s of screens) {
    prompt += `--- Screen ${s.index} [${s.type}]: `;
    if (s.question_text) prompt += `TIPO DOMANDA: "${s.question_text}" `;
    prompt += `${s.options?.length || 0} opzioni`;
    if (s.cta_text) prompt += `, CTA presente`;
    prompt += `\n`;
  }

  // ─── SCORING ───
  prompt += `\n=== SISTEMA DI SCORING ===\n`;
  prompt += `Tipo: ${scoring?.type || 'categorical'}\n`;
  prompt += `Determinazione risultato: ${scoring?.result_determination || 'highest_category_count'}\n`;
  if (scoring?.categories?.length > 0) {
    prompt += `Categorie: ${scoring.categories.map(c => `${c.id}="${c.label}"`).join(', ')}\n`;
  }

  // ─── RESULT PROFILES ───
  prompt += `\n=== PROFILI RISULTATO (${resultProfiles.length}) ===\n`;
  for (const rp of resultProfiles) {
    prompt += `[${rp.id}] "${rp.label}": ${rp.headline}`;
    if (rp.description) prompt += ` — ${rp.description.slice(0, 150)}`;
    prompt += `\n`;
  }

  // ─── LOADING SCREEN ───
  if (quizBlueprint.loading_screen?.exists) {
    prompt += `\n=== LOADING SCREEN ===\n`;
    prompt += `Messaggi: ${quizBlueprint.loading_screen.messages.join(' → ')}\n`;
  }

  // ─── LEAD CAPTURE ───
  if (quizBlueprint.lead_capture?.exists) {
    prompt += `\n=== LEAD CAPTURE ===\n`;
    prompt += `Posizione: ${quizBlueprint.lead_capture.position}, campi: ${quizBlueprint.lead_capture.fields.join(', ')}\n`;
    if (quizBlueprint.lead_capture.incentive_text) prompt += `Incentivo: "${quizBlueprint.lead_capture.incentive_text}"\n`;
  }

  // ─── NEW PRODUCT (THIS IS THE CORE — all content must be about THIS) ───
  prompt += `\n${'='.repeat(60)}\n`;
  prompt += `=== IL TUO PRODOTTO — TUTTO il quiz deve parlare di QUESTO ===\n`;
  prompt += `${'='.repeat(60)}\n`;
  prompt += `Brand: ${product.brandName}\n`;
  prompt += `Prodotto: ${product.name}\n`;
  prompt += `Descrizione: ${product.description}\n`;
  prompt += `Prezzo: €${product.price}\n`;
  prompt += `Benefici chiave:\n`;
  for (const b of product.benefits) {
    prompt += `  • ${b}\n`;
  }
  prompt += `CTA principale: "${product.ctaText}" → ${product.ctaUrl}\n\n`;

  // ─── BRANDING (USE THESE TEXTS AND COLORS) ───
  const bi = branding.brandIdentity;
  prompt += `=== BRANDING DEL NUOVO PRODOTTO (usa questi testi e colori) ===\n`;
  prompt += `Brand: ${bi.brandName}\n`;
  prompt += `Tagline: ${bi.tagline}\n`;
  prompt += `Tono di voce: ${bi.voiceTone}\n`;
  prompt += `Hook emotivo: ${bi.emotionalHook}\n`;
  prompt += `USP: ${bi.uniqueSellingProposition}\n`;
  prompt += `Colori brand: primary=${bi.colorPalette.primary}, secondary=${bi.colorPalette.secondary}, accent=${bi.colorPalette.accent}, cta_bg=${bi.colorPalette.ctaBackground}, cta_text=${bi.colorPalette.ctaText}\n\n`;

  if (branding.quizBranding) {
    const qb = branding.quizBranding;
    prompt += `COPY DEL QUIZ (usa ESATTAMENTE questi testi):\n`;
    prompt += `  Titolo quiz: "${qb.quizTitle}"\n`;
    prompt += `  Sottotitolo: "${qb.quizSubtitle}"\n`;
    prompt += `  Testo intro: "${qb.quizIntroText}"\n`;
    prompt += `  Label progress: "${qb.progressBarLabel}"\n`;
    prompt += `  Headline risultato: "${qb.resultPageHeadline}"\n`;
    prompt += `  Subheadline risultato: "${qb.resultPageSubheadline}"\n`;
    prompt += `  Body risultato: "${qb.resultPageBodyCopy}"\n`;
    prompt += `  Hook personalizzazione: "${qb.personalizationHook}"\n\n`;
  }

  prompt += `CONTENUTO DETTAGLIATO PER OGNI STEP (usa questi testi):\n`;
  for (const step of branding.funnelSteps) {
    prompt += `\n--- Step ${step.stepIndex} [${step.originalPageType}] ---\n`;
    prompt += `  Headline: "${step.headline}"\n`;
    if (step.subheadline) prompt += `  Subheadline: "${step.subheadline}"\n`;
    if (step.bodyCopy) prompt += `  Body: "${step.bodyCopy}"\n`;
    if (step.ctaTexts?.length) prompt += `  CTA: ${step.ctaTexts.map(t => `"${t}"`).join(', ')}\n`;
    if (step.quizQuestion) prompt += `  Domanda: "${step.quizQuestion}"\n`;
    if (step.quizOptions?.length) {
      prompt += `  Opzioni:\n`;
      step.quizOptions.forEach((opt, i) => {
        const sub = step.quizOptionSubtexts?.[i];
        prompt += `    ${i + 1}. ${opt}${sub ? ` — ${sub}` : ''}\n`;
      });
    }
    if (step.socialProof?.length) prompt += `  Social proof: ${step.socialProof.join('; ')}\n`;
    if (step.urgencyElements?.length) prompt += `  Urgenza: ${step.urgencyElements.join('; ')}\n`;
  }

  const ge = branding.globalElements;
  if (ge?.socialProofStatements?.length) prompt += `\nSocial proof globale: ${ge.socialProofStatements.join(' | ')}\n`;
  if (ge?.urgencyElements?.length) prompt += `Urgenza globale: ${ge.urgencyElements.join(' | ')}\n`;
  if (ge?.trustBadges?.length) prompt += `Trust badges: ${ge.trustBadges.join(', ')}\n`;
  if (ge?.guaranteeText) prompt += `Garanzia: ${ge.guaranteeText}\n`;

  if (extraInstructions) {
    prompt += `\n=== ISTRUZIONI EXTRA ===\n${extraInstructions}\n`;
  }

  return prompt;
}

// =====================================================
// V2 PIPELINE — Screenshot → Gemini Analysis → Claude Generation
// =====================================================

async function runV2Pipeline(
  body: RequestBody,
  controller: ReadableStreamDefaultController<Uint8Array>,
) {
  const {
    entryUrl,
    funnelName,
    product,
    funnelSteps,
    funnelMeta,
    extraInstructions,
  } = body;

  const anthropicKey = process.env.ANTHROPIC_API_KEY!;
  const geminiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY ?? '').trim();

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // ── PHASE 1: Fetch Screenshots ──
  controller.enqueue(sseEncode({ phase: 'fetching_screenshots', message: 'Recupero screenshot per-step...' }));

  let { screenshots, stepsInfo } = await fetchScreenshotsAndSteps(entryUrl, funnelName, funnelSteps);

  // CSS tokens extracted from live page (populated by captureLiveScreenshots)
  let cssTokens = null;

  // Fallback: if no screenshots in DB, capture live with single Playwright browser
  if (screenshots.length === 0) {
    controller.enqueue(sseEncode({
      phase: 'fetching_screenshots',
      message: 'Nessuno screenshot in DB — cattura live con Playwright...',
    }));

    const liveResult = await captureLiveScreenshots(
      entryUrl,
      funnelSteps,
      (msg) => controller.enqueue(sseEncode({ phase: 'fetching_screenshots', message: msg })),
    );
    screenshots = liveResult.screenshots;
    cssTokens = liveResult.cssTokens;
  }

  controller.enqueue(sseEncode({
    phase: 'screenshots_ready',
    message: `${screenshots.length} screenshot, ${stepsInfo.length} step info`,
    screenshotsCount: screenshots.length,
    stepsCount: stepsInfo.length,
  }));

  if (screenshots.length === 0) {
    throw new Error('Impossibile catturare screenshot del funnel. Verifica che l\'URL sia raggiungibile.');
  }

  const [visualBlueprint, quizBlueprint] = await Promise.all([
    runVisualBlueprintAnalysis({
      screenshots,
      cssTokens,
      geminiApiKey: geminiKey,
      onProgress: (msg) => controller.enqueue(sseEncode({ phase: 'analyzing_visual', message: msg })),
    }),
    runQuizLogicBlueprintAnalysis({
      screenshots,
      stepsInfo,
      geminiApiKey: geminiKey,
      onProgress: (msg) => controller.enqueue(sseEncode({ phase: 'analyzing_quiz_logic', message: msg })),
    }),
  ]);

  controller.enqueue(sseEncode({
    phase: 'analysis_done',
    message: 'Analisi Gemini completata',
    visualScreens: visualBlueprint.ux_flow?.total_screens || 0,
    quizScreens: quizBlueprint.quiz_content?.screens?.length || 0,
    scoringType: quizBlueprint.scoring_system?.type || 'unknown',
  }));

  // ── PHASE 3: Generate Branding ──
  controller.enqueue(sseEncode({ phase: 'generating_branding', message: 'Generazione branding per il tuo prodotto...' }));

  let branding = await generateBrandingForProduct(entryUrl, funnelName, product, funnelMeta);
  if (!branding) {
    branding = buildFallbackBranding(product, funnelName, funnelSteps);
  }

  controller.enqueue(sseEncode({
    phase: 'branding_done',
    message: `Branding generato (${branding.funnelSteps.length} step)`,
    brandingSteps: branding.funnelSteps.length,
  }));

  // ── PHASE 4: Single Claude call — complete HTML generation ──
  controller.enqueue(sseEncode({ phase: 'generating_html', message: 'Claude: generazione quiz HTML completo...' }));

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const systemPrompt = `Sei un ESPERTO SVILUPPATORE FRONTEND e COPYWRITER specializzato in quiz funnel ad alta conversione.

IL TUO COMPITO:
Genera un SINGOLO FILE HTML COMPLETO che:
1. REPLICA il DESIGN VISIVO di un quiz originale (colori, layout, font, stile card, progress bar, animazioni)
2. SWAPPA COMPLETAMENTE il CONTENUTO per il nuovo prodotto — OGNI testo deve parlare del NUOVO prodotto, NON copiare l'originale
3. Funzioni PERFETTAMENTE: navigazione, scoring, risultato personalizzato

HAI A DISPOSIZIONE:
- Screenshot del quiz originale → copia SOLO lo stile visivo (colori, layout, forme, animazioni)
- Visual blueprint → valori CSS esatti da replicare
- Contenuto originale → usa come STRUTTURA (numero step, tipi di domanda, flow) ma RISCRIVI tutto per il nuovo prodotto
- Branding del nuovo prodotto → USA QUESTI testi, colori brand, tono

=== REGOLA FONDAMENTALE DELLO SWAP ===
NON copiare i testi dell'originale. DEVI:
- Riscrivere OGNI headline, domanda, opzione di risposta per il NUOVO PRODOTTO
- Le domande devono essere RILEVANTI per il prodotto dell'utente (es. se il prodotto è un integratore, chiedi su dieta/salute/obiettivi; se è skincare, chiedi su tipo di pelle/routine/problemi)
- Le opzioni devono portare a raccomandare il NUOVO PRODOTTO come soluzione
- I risultati devono spiegare perché il NUOVO PRODOTTO è perfetto per l'utente
- Social proof, urgenza, trust badges devono essere per il NUOVO BRAND
- CTA devono linkare al NUOVO PRODOTTO con il testo CTA fornito
- Usa il TONO DI VOCE del nuovo brand (dal branding fornito)
- Usa i COLORI DEL BRAND del nuovo prodotto per accenti e CTA (ma mantieni il layout/stile dell'originale)

=== STRUTTURA FILE ===
<!DOCTYPE html> → <head> con <style> → <body> con markup → <script> con logica → </html>

=== CSS ===
- Colori dal visual blueprint per lo stile base (sfondo, card, bordi)
- Colori del BRAND del nuovo prodotto per CTA, accenti, progress bar
- Replica spacing, border-radius, shadows, animazioni dell'originale
- Mobile-first responsive
- Animazioni: fadeIn tra step, hover opzioni, selezione, progress smooth

=== HTML ===
- Ogni step: <div class="quiz-step" data-step="N" data-step-type="tipo">
- Solo il primo step visibile (.active)
- Opzioni: <div class="quiz-option" data-option="val" data-category="cat_id">
- Progress bar con label
- TUTTI gli step presenti (intro, domande, info, loading, risultato)

=== JAVASCRIPT ===
- Un solo <script> prima di </body>
- Navigazione step: mostra uno alla volta con transizioni
- Click opzione → .selected → salva categoria → auto-avanza dopo 700ms
- Progress bar: aggiorna percentuale
- Scoring: oggetto risposte, conta categorie, trova vincitore
- Loading: messaggi progressivi (adattati al nuovo prodotto)
- Risultato: mostra profilo vincente, CTA con URL prodotto
- Back button, scroll to top
- ZERO dipendenze esterne

OUTPUT: SOLO codice HTML da <!DOCTYPE html> a </html>.
Inizia con <!DOCTYPE html>. Zero spiegazioni, zero markdown.`;

  const userContent: Anthropic.Messages.ContentBlockParam[] = [];

  // Send up to 3 screenshots as visual reference
  const screenshotSample = screenshots.length > 3
    ? [screenshots[0], screenshots[Math.floor(screenshots.length / 2)], screenshots[screenshots.length - 1]]
    : screenshots;
  for (const ss of screenshotSample) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: ss },
    });
  }

  userContent.push({
    type: 'text',
    text: buildUnifiedPrompt(visualBlueprint, quizBlueprint, branding, product, extraInstructions || ''),
  });

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 64000,
    temperature: 0.4,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  let accumulated = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      accumulated += event.delta.text;
      controller.enqueue(sseEncode({ text: event.delta.text }));
    }
  }

  const finalMessage = await stream.finalMessage();
  totalInputTokens += finalMessage.usage.input_tokens;
  totalOutputTokens += finalMessage.usage.output_tokens;

  // Clean up any markdown wrapping
  let finalHtml = accumulated.trim();
  finalHtml = finalHtml.replace(/^```html?\s*/i, '').replace(/```\s*$/i, '').trim();

  controller.enqueue(sseEncode({ phase: 'assembling', message: 'Completato!' }));

  // ── Save to Supabase if we have a job ──
  try {
    await supabase
      .from('multiagent_jobs')
      .insert({
        entry_url: entryUrl,
        funnel_name: funnelName || '',
        params: {
          product,
          funnelSteps,
          funnelMeta,
          extraInstructions,
          pipeline: 'v2_visual_replication',
        },
        status: 'completed',
        current_phase: 'completed',
        result_html: finalHtml,
        master_spec: { visual_blueprint: visualBlueprint, quiz_blueprint: quizBlueprint },
        branding,
        usage: { input_tokens: totalInputTokens, output_tokens: totalOutputTokens },
      });
  } catch { /* non-blocking */ }

  return { totalInputTokens, totalOutputTokens, visualBlueprint, quizBlueprint };
}

// =====================================================
// MAIN HANDLER
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RequestBody;
    const { entryUrl, product } = body;

    if (!entryUrl || !product) {
      return new Response(
        JSON.stringify({ error: 'entryUrl e product sono obbligatori' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const geminiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY ?? '').trim();

    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY non configurata' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY non configurata' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // ── STREAMING MODE (SSE) — V2 Visual Replication Pipeline ──
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const result = await runV2Pipeline(body, controller);

          controller.enqueue(sseEncode({
            done: true,
            mode: 'v2_visual_replication',
            usage: {
              input_tokens: result.totalInputTokens,
              output_tokens: result.totalOutputTokens,
            },
            blueprintSummary: {
              visualScreens: result.visualBlueprint.ux_flow?.total_screens || 0,
              quizScreens: result.quizBlueprint.quiz_content?.screens?.length || 0,
              scoringType: result.quizBlueprint.scoring_system?.type || 'unknown',
            },
          }));

          controller.close();
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Errore durante la generazione V2';
          console.error('[multiagent-v2] Error:', errorMsg);
          controller.enqueue(sseEncode({ error: errorMsg }));
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
    console.error('[multiagent-v2] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Errore interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';
import {
  runMultiAgentAnalysis,
  cloneQuizHtml,
} from '@/lib/quiz-multiagent-engine';
import { generateBranding, buildBrandingInputFromDb } from '@/lib/branding-generator';
import { fetchFunnelCrawlStepsByFunnel } from '@/lib/supabase-operations';
import { CLAUDE_TRANSFORM_SYSTEM_PROMPT } from '@/lib/quiz-multiagent-prompts';
import type { MasterSpec } from '@/lib/quiz-multiagent-types';
import type { GeneratedBranding } from '@/types';

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

function sseEncode(data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Build the user prompt for Claude's HTML transformation.
 * Gives Claude the cloned HTML + MasterSpec + branding + product data.
 * Claude must surgically replace content while preserving everything else.
 */
function buildTransformPrompt(
  clonedHtml: string,
  masterSpec: MasterSpec,
  branding: GeneratedBranding,
  product: ProductData,
  extraInstructions: string
): string {
  let prompt = '';

  prompt += `=== HTML ORIGINALE DEL QUIZ (da trasformare) ===\n`;
  prompt += `Questo è il codice HTML COMPLETO del quiz originale, clonato fedelmente con Playwright.\n`;
  prompt += `DEVI mantenere questa struttura IDENTICA — modifica SOLO i testi.\n\n`;
  prompt += clonedHtml.slice(0, 120000); // Cap at ~120KB to stay within context
  prompt += '\n\n';

  // Add CRO copy analysis (so Claude knows WHAT text to replace and WHY)
  prompt += `=== ANALISI COPY & MARKETING (da Agent CRO) ===\n`;
  prompt += `Questi sono i pattern di persuasione per ogni schermata. DEVI preservarli.\n\n`;
  if (masterSpec.cro?.copy_architecture?.per_screen) {
    for (const screen of masterSpec.cro.copy_architecture.per_screen) {
      prompt += `SCREEN ${screen.screen_index} [${screen.screen_type}]:\n`;
      if (screen.headline) {
        prompt += `  Headline originale: "${screen.headline.text}" → tecnica: ${screen.headline.technique}\n`;
      }
      if (screen.subheadline) {
        prompt += `  Subheadline originale: "${screen.subheadline.text}" → tecnica: ${screen.subheadline.technique}\n`;
      }
      if (screen.cta_elements?.length > 0) {
        for (const cta of screen.cta_elements) {
          prompt += `  CTA: "${cta.text}" → tecnica: ${cta.technique}\n`;
        }
      }
      if (screen.option_copy?.length) {
        prompt += `  Opzioni quiz:\n`;
        for (const opt of screen.option_copy) {
          prompt += `    - "${opt.label}" → angolo: ${opt.persuasion_angle}\n`;
        }
      }
      if (screen.social_proof_elements?.length) {
        for (const sp of screen.social_proof_elements) {
          prompt += `  Social proof: "${sp.text}" [${sp.type}]\n`;
        }
      }
      if (screen.urgency_elements?.length) {
        for (const ue of screen.urgency_elements) {
          prompt += `  Urgency: "${ue.text}" [${ue.type}]\n`;
        }
      }
      prompt += '\n';
    }
  }

  // Add quiz logic (so Claude preserves scoring and result mapping)
  prompt += `=== LOGICA QUIZ (da Agent Quiz Logic) — NON MODIFICARE ===\n`;
  if (masterSpec.quiz_logic?.quiz_mechanics) {
    prompt += `Sistema scoring: ${masterSpec.quiz_logic.quiz_mechanics.scoring_system}\n`;
    prompt += `Categorie: ${masterSpec.quiz_logic.quiz_mechanics.categories.map(c => c.label).join(', ')}\n`;
    prompt += `Determinazione risultato: ${masterSpec.quiz_logic.quiz_mechanics.result_determination}\n\n`;
  }
  if (masterSpec.quiz_logic?.questions) {
    prompt += `Domande (${masterSpec.quiz_logic.questions.length}):\n`;
    for (const q of masterSpec.quiz_logic.questions) {
      prompt += `  Q${q.index}: "${q.question_text}" [${q.question_type}]\n`;
      if (q.options) {
        for (const opt of q.options) {
          prompt += `    - "${opt.label}" → ${opt.maps_to_categories.join(', ')}\n`;
        }
      }
    }
    prompt += '\n';
  }
  if (masterSpec.quiz_logic?.result_profiles) {
    prompt += `Profili risultato (${masterSpec.quiz_logic.result_profiles.length}):\n`;
    for (const rp of masterSpec.quiz_logic.result_profiles) {
      prompt += `  [${rp.id}] "${rp.label}": ${rp.headline}\n`;
    }
    prompt += '\n';
  }

  // Add new product branding (what to swap TO)
  prompt += `=== NUOVO PRODOTTO (swappa tutto il contenuto per questo) ===\n`;
  prompt += `Brand: ${product.brandName}\n`;
  prompt += `Prodotto: ${product.name}\n`;
  prompt += `Descrizione: ${product.description}\n`;
  prompt += `Prezzo: €${product.price}\n`;
  prompt += `Benefici: ${product.benefits.join('; ')}\n`;
  prompt += `CTA principale: ${product.ctaText}\n`;
  prompt += `URL CTA: ${product.ctaUrl}\n\n`;

  // Add branding details
  prompt += `=== BRANDING GENERATO PER IL NUOVO PRODOTTO ===\n`;
  const bi = branding.brandIdentity;
  prompt += `Tagline: ${bi.tagline}\n`;
  prompt += `Tono: ${bi.voiceTone}\n`;
  prompt += `Hook emotivo: ${bi.emotionalHook}\n`;
  prompt += `USP: ${bi.uniqueSellingProposition}\n`;
  prompt += `Colori brand: primary=${bi.colorPalette.primary}, secondary=${bi.colorPalette.secondary}, accent=${bi.colorPalette.accent}\n\n`;

  if (branding.quizBranding) {
    const qb = branding.quizBranding;
    prompt += `QUIZ COPY PER IL NUOVO PRODOTTO:\n`;
    prompt += `  Titolo: ${qb.quizTitle}\n`;
    prompt += `  Sottotitolo: ${qb.quizSubtitle}\n`;
    prompt += `  Intro: ${qb.quizIntroText}\n`;
    prompt += `  Progress label: ${qb.progressBarLabel}\n`;
    prompt += `  Risultato headline: ${qb.resultPageHeadline}\n`;
    prompt += `  Risultato subheadline: ${qb.resultPageSubheadline}\n`;
    prompt += `  Risultato body: ${qb.resultPageBodyCopy}\n\n`;
  }

  // Per-step branding content
  prompt += `CONTENUTO PER OGNI STEP:\n`;
  for (const step of branding.funnelSteps) {
    prompt += `\nStep ${step.stepIndex} [${step.originalPageType}]:\n`;
    prompt += `  Headline: ${step.headline}\n`;
    if (step.subheadline) prompt += `  Subheadline: ${step.subheadline}\n`;
    if (step.bodyCopy) prompt += `  Body: ${step.bodyCopy}\n`;
    if (step.ctaTexts.length) prompt += `  CTA: ${step.ctaTexts.join(', ')}\n`;
    if (step.quizQuestion) prompt += `  Domanda: ${step.quizQuestion}\n`;
    if (step.quizOptions?.length) {
      prompt += `  Opzioni:\n`;
      step.quizOptions.forEach((opt, i) => {
        const sub = step.quizOptionSubtexts?.[i];
        prompt += `    ${i + 1}. ${opt}${sub ? ` — ${sub}` : ''}\n`;
      });
    }
    if (step.socialProof.length) prompt += `  Social proof: ${step.socialProof.join('; ')}\n`;
    if (step.urgencyElements.length) prompt += `  Urgency: ${step.urgencyElements.join('; ')}\n`;
  }
  prompt += '\n';

  // Global elements
  const ge = branding.globalElements;
  if (ge.socialProofStatements.length) prompt += `Social proof globale: ${ge.socialProofStatements.join(' | ')}\n`;
  if (ge.urgencyElements.length) prompt += `Urgency globale: ${ge.urgencyElements.join(' | ')}\n`;
  if (ge.trustBadges.length) prompt += `Trust badges: ${ge.trustBadges.join(', ')}\n`;
  if (ge.guaranteeText) prompt += `Garanzia: ${ge.guaranteeText}\n`;
  prompt += '\n';

  // Critical preservation notes
  if (masterSpec.synthesis_notes?.critical_elements_to_preserve?.length) {
    prompt += `=== ELEMENTI CRITICI DA PRESERVARE (dalla sintesi multi-agente) ===\n`;
    for (const elem of masterSpec.synthesis_notes.critical_elements_to_preserve) {
      prompt += `⚠️ ${elem}\n`;
    }
    prompt += '\n';
  }

  if (extraInstructions) {
    prompt += `=== ISTRUZIONI AGGIUNTIVE DALL'UTENTE ===\n${extraInstructions}\n\n`;
  }

  prompt += `=== ISTRUZIONI FINALI ===\n`;
  prompt += `Trasforma l'HTML sopra swappando SOLO i contenuti testuali con il branding del nuovo prodotto.\n`;
  prompt += `PRESERVA la struttura HTML, il CSS, il JavaScript, le animazioni, il layout, tutto.\n`;
  prompt += `PRESERVA gli stessi pattern di persuasione per ogni schermata.\n`;
  prompt += `PRESERVA lo stesso numero di domande, opzioni, e profili risultato.\n`;
  prompt += `La pagina di RISULTATO è la più importante — deve essere ricca e persuasiva come l'originale.\n`;
  prompt += `Output: SOLO il file HTML completo da <!DOCTYPE html> a </html>.`;

  return prompt;
}

// =====================================================
// MAIN HANDLER
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      entryUrl,
      funnelName,
      product,
      funnelSteps,
      funnelMeta,
      extraInstructions,
    } = body as {
      entryUrl: string;
      funnelName: string;
      product: ProductData;
      funnelSteps?: AffiliateFunnelStep[];
      funnelMeta?: Record<string, unknown>;
      extraInstructions?: string;
    };

    if (!entryUrl || !product) {
      return new Response(
        JSON.stringify({ error: 'entryUrl e product sono obbligatori' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
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

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        let totalInputTokens = 0;
        let totalOutputTokens = 0;

        try {
          // ── PHASE 1: Clone original quiz HTML ──
          controller.enqueue(sseEncode({ phase: 'cloning_html', message: 'Clonazione HTML originale con Playwright...' }));

          const { clonedData, textNodes, cssTokens } = await cloneQuizHtml(entryUrl);

          controller.enqueue(sseEncode({
            phase: 'cloning_done',
            htmlSize: clonedData.renderedSize,
            textNodesCount: textNodes.length,
            cssCount: clonedData.cssCount,
            hasCssTokens: !!cssTokens,
          }));

          // ── PHASE 2: Fetch per-step screenshots ──
          controller.enqueue(sseEncode({ phase: 'fetching_screenshots', message: 'Recupero screenshot per-step...' }));

          let screenshots: string[] = [];
          let stepsInfo: Array<{ index: number; title: string; type: string; options?: string[] }> = [];

          // Try to get screenshots from DB (from previous crawl)
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

          // Fallback: use funnelSteps metadata if no screenshots
          if (stepsInfo.length === 0 && funnelSteps) {
            stepsInfo = funnelSteps.map(s => ({
              index: s.step_index,
              title: s.title,
              type: s.step_type || 'other',
              options: s.options,
            }));
          }

          controller.enqueue(sseEncode({
            phase: 'screenshots_ready',
            screenshotsCount: screenshots.length,
            stepsCount: stepsInfo.length,
          }));

          // ── PHASE 3: Multi-Agent Gemini Analysis (parallel) ──
          controller.enqueue(sseEncode({ phase: 'agents_start', message: '4 agenti Gemini in parallelo...' }));

          const extractedTexts = textNodes.map(t => ({
            index: t.index,
            text: t.originalText,
            tag: t.tagName,
            context: t.classes.split(' ')[0] || '',
          }));

          let masterSpec: MasterSpec;

          if (screenshots.length > 0) {
            const agentResult = await runMultiAgentAnalysis({
              screenshots,
              cssTokens,
              stepsInfo,
              extractedTexts,
              geminiApiKey: geminiKey,
              onProgress: (phase, message) => {
                controller.enqueue(sseEncode({ phase, message }));
              },
            });

            masterSpec = agentResult.masterSpec;
            masterSpec.metadata.original_url = entryUrl;
            masterSpec.metadata.funnel_name = funnelName;
          } else {
            // No screenshots — create minimal masterSpec from funnelSteps data
            controller.enqueue(sseEncode({ phase: 'agents_skip', message: 'Nessuno screenshot disponibile — analisi basata su metadati' }));
            masterSpec = {
              visual: {} as MasterSpec['visual'],
              ux_flow: {} as MasterSpec['ux_flow'],
              cro: { copy_architecture: { per_screen: [] } } as unknown as MasterSpec['cro'],
              quiz_logic: { quiz_mechanics: { scoring_system: 'categorical', categories: [], result_determination: 'highest_category_count', tiebreaker_rule: 'first_in_list' }, questions: [], result_profiles: [], lead_capture: { position: 'none', required: false, fields: [], incentive_text: '', skip_option: true, privacy_text: '' }, loading_screen: { exists: false, messages: [], duration_ms: 0, fake_progress: false, analysis_labels: [] }, data_tracking: { tracks_answers: false, sends_to_external: false, external_service_hints: [], utm_passthrough: false } },
              synthesis_notes: { conflicts_resolved: [], confidence_score: 0.3, warnings: ['No screenshots available — limited analysis'], critical_elements_to_preserve: [] },
              metadata: { original_url: entryUrl, funnel_name: funnelName, total_steps: stepsInfo.length, analyzed_at: new Date().toISOString(), agents_used: ['metadata_only'] },
            };
          }

          controller.enqueue(sseEncode({
            phase: 'agents_done',
            confidence: masterSpec.synthesis_notes.confidence_score,
            warnings: masterSpec.synthesis_notes.warnings.length,
          }));

          // ── PHASE 4: Generate Branding ──
          controller.enqueue(sseEncode({ phase: 'generating_branding', message: 'Generazione branding per il tuo prodotto...' }));

          let branding: GeneratedBranding | null = null;

          try {
            let crawlSteps: Awaited<ReturnType<typeof fetchFunnelCrawlStepsByFunnel>> = [];
            try {
              crawlSteps = await fetchFunnelCrawlStepsByFunnel(entryUrl, funnelName);
            } catch { /* no crawl data */ }

            if (crawlSteps.length > 0) {
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
                }
              );

              const result = await generateBranding(brandingInput);
              if (result.success && result.branding) {
                branding = result.branding;
              }
            }
          } catch (err) {
            console.warn('[multiagent] Branding generation failed:', err);
          }

          // Fallback: create minimal branding from product data
          if (!branding) {
            branding = {
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

          controller.enqueue(sseEncode({
            phase: 'branding_done',
            hasBranding: !!branding,
            brandingSteps: branding.funnelSteps.length,
          }));

          // ── PHASE 5: Claude Transform — Surgical HTML transformation ──
          controller.enqueue(sseEncode({ phase: 'transforming_html', message: 'Claude: trasformazione chirurgica dell\'HTML...' }));

          const anthropic = new Anthropic({ apiKey: anthropicKey });

          const userPrompt = buildTransformPrompt(
            clonedData.html,
            masterSpec,
            branding,
            product,
            extraInstructions || ''
          );

          const userContent: Anthropic.Messages.ContentBlockParam[] = [
            { type: 'text', text: userPrompt },
          ];

          // If we have a screenshot, add it for visual reference
          if (screenshots.length > 0) {
            userContent.unshift({
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: screenshots[0] },
            });
          }

          const stream = await anthropic.messages.stream({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 64000,
            temperature: 0.3,
            system: CLAUDE_TRANSFORM_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userContent }],
          });

          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(sseEncode({ text: event.delta.text }));
            }
          }

          const finalMessage = await stream.finalMessage();
          totalInputTokens += finalMessage.usage.input_tokens;
          totalOutputTokens += finalMessage.usage.output_tokens;

          controller.enqueue(sseEncode({
            done: true,
            mode: 'multiagent_transform',
            usage: { input_tokens: totalInputTokens, output_tokens: totalOutputTokens },
            masterSpecSummary: {
              confidence: masterSpec.synthesis_notes.confidence_score,
              warnings: masterSpec.synthesis_notes.warnings,
              agentsUsed: masterSpec.metadata.agents_used,
            },
          }));

          controller.close();
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Errore durante la generazione multiagent';
          console.error('[multiagent-generate] Error:', errorMsg);
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
    console.error('[multiagent-generate] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Errore interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

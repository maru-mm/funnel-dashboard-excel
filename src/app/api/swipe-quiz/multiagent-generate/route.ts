import { NextRequest } from 'next/server';
import { waitUntil } from '@vercel/functions';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 800;
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

type JobPhase = 'pending' | 'cloning' | 'screenshots' | 'analyzing' | 'branding' | 'transforming' | 'completed' | 'failed';

interface ProgressEntry {
  phase: string;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

// =====================================================
// SUPABASE JOB HELPERS
// =====================================================

async function createJob(body: RequestBody): Promise<string> {
  const { data, error } = await supabase
    .from('multiagent_jobs')
    .insert({
      entry_url: body.entryUrl,
      funnel_name: body.funnelName || '',
      params: {
        product: body.product,
        funnelSteps: body.funnelSteps,
        funnelMeta: body.funnelMeta,
        extraInstructions: body.extraInstructions,
      },
      status: 'pending',
      current_phase: 'pending',
      progress: [],
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create job: ${error?.message || 'unknown'}`);
  }
  return data.id;
}

async function updateJobPhase(
  jobId: string,
  status: JobPhase,
  phase: string,
  message: string,
  extraData?: Record<string, unknown>,
) {
  const progressEntry: ProgressEntry = {
    phase,
    message,
    timestamp: new Date().toISOString(),
    ...(extraData ? { data: extraData } : {}),
  };

  // Append to progress array and update status
  const { error } = await supabase.rpc('append_multiagent_progress', {
    job_id: jobId,
    new_status: status,
    new_phase: phase,
    entry: progressEntry,
  }).single();

  // Fallback if RPC doesn't exist: read-modify-write
  if (error) {
    const { data: existing } = await supabase
      .from('multiagent_jobs')
      .select('progress')
      .eq('id', jobId)
      .single();

    const currentProgress = (existing?.progress as ProgressEntry[]) || [];
    currentProgress.push(progressEntry);

    await supabase
      .from('multiagent_jobs')
      .update({
        status,
        current_phase: phase,
        progress: currentProgress,
      })
      .eq('id', jobId);
  }
}

async function completeJob(
  jobId: string,
  resultHtml: string,
  masterSpec: MasterSpec,
  branding: GeneratedBranding,
  usage: { input_tokens: number; output_tokens: number },
) {
  await supabase
    .from('multiagent_jobs')
    .update({
      status: 'completed',
      current_phase: 'completed',
      result_html: resultHtml,
      master_spec: masterSpec,
      branding,
      usage,
    })
    .eq('id', jobId);
}

async function failJob(jobId: string, error: unknown) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  await supabase
    .from('multiagent_jobs')
    .update({
      status: 'failed',
      current_phase: 'failed',
      error: errorMsg,
    })
    .eq('id', jobId);
}

// =====================================================
// PROMPT BUILDER
// =====================================================

function buildTransformPrompt(
  clonedHtml: string,
  masterSpec: MasterSpec,
  branding: GeneratedBranding,
  product: ProductData,
  extraInstructions: string
): string {
  let prompt = '';

  prompt += `=== HTML ORIGINALE DEL QUIZ (da trasformare) ===\n`;
  prompt += `Questo è il codice HTML clonato da un quiz funnel reale con Playwright.\n`;
  prompt += `ATTENZIONE: Il JavaScript originale NON funziona più (gli script sono stati rimossi/rotti durante la clonazione).\n`;
  prompt += `DEVI mantenere la struttura HTML e il CSS, ma DEVI RISCRIVERE il JavaScript da zero per rendere il quiz FUNZIONANTE.\n`;
  prompt += `RIMUOVI tutti i tag <script src="..."> esterni e tutti gli script inline rotti.\n\n`;
  prompt += clonedHtml.slice(0, 120000);
  prompt += '\n\n';

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

  prompt += `=== LOGICA QUIZ (da Agent Quiz Logic) — USA QUESTO PER SCRIVERE IL JAVASCRIPT ===\n`;
  prompt += `Usa queste informazioni per implementare il sistema di scoring nel tuo JavaScript.\n`;
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

  prompt += `=== NUOVO PRODOTTO (swappa tutto il contenuto per questo) ===\n`;
  prompt += `Brand: ${product.brandName}\n`;
  prompt += `Prodotto: ${product.name}\n`;
  prompt += `Descrizione: ${product.description}\n`;
  prompt += `Prezzo: €${product.price}\n`;
  prompt += `Benefici: ${product.benefits.join('; ')}\n`;
  prompt += `CTA principale: ${product.ctaText}\n`;
  prompt += `URL CTA: ${product.ctaUrl}\n\n`;

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

  const ge = branding.globalElements;
  if (ge.socialProofStatements.length) prompt += `Social proof globale: ${ge.socialProofStatements.join(' | ')}\n`;
  if (ge.urgencyElements.length) prompt += `Urgency globale: ${ge.urgencyElements.join(' | ')}\n`;
  if (ge.trustBadges.length) prompt += `Trust badges: ${ge.trustBadges.join(', ')}\n`;
  if (ge.guaranteeText) prompt += `Garanzia: ${ge.guaranteeText}\n`;
  prompt += '\n';

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

  // UX flow info for JS implementation
  if (masterSpec.ux_flow?.flow_structure?.screen_sequence) {
    prompt += `=== FLUSSO UX (da Agent UX Flow) — USA QUESTO PER LA NAVIGAZIONE JS ===\n`;
    prompt += `Schermate totali: ${masterSpec.ux_flow.flow_structure.total_screens}\n`;
    for (const screen of masterSpec.ux_flow.flow_structure.screen_sequence) {
      prompt += `  Screen ${screen.index}: [${screen.type}]`;
      if (screen.auto_advance_on_select) prompt += ` auto-avanza dopo ${screen.delay_before_advance_ms || 700}ms`;
      if (screen.has_progress_bar) prompt += ` | progress bar: "${screen.progress_format}"`;
      if (screen.has_back_button) prompt += ` | ha pulsante indietro`;
      prompt += `\n`;
    }
    prompt += '\n';
  }
  if (masterSpec.ux_flow?.transitions) {
    const t = masterSpec.ux_flow.transitions;
    prompt += `Transizioni:\n`;
    if (t.between_questions) prompt += `  Tra domande: ${t.between_questions.exit_animation} → ${t.between_questions.enter_animation} (${t.between_questions.duration_ms}ms)\n`;
    if (t.loading_to_result) prompt += `  Loading→Risultato: ${t.loading_to_result.type} (${t.loading_to_result.duration_ms}ms)\n`;
    prompt += '\n';
  }
  if (masterSpec.ux_flow?.loading_states?.has_loading_screen) {
    const ls = masterSpec.ux_flow.loading_states;
    prompt += `Loading screen:\n`;
    prompt += `  Messaggi: ${ls.loading_messages?.join(' → ')}\n`;
    prompt += `  Durata: ${ls.loading_duration_ms}ms\n`;
    prompt += `  Tipo: ${ls.loading_type}\n\n`;
  }

  prompt += `=== ISTRUZIONI FINALI — CRITICHE ===\n\n`;

  prompt += `1. STRUTTURA HTML & CSS: Mantieni la struttura HTML e il CSS dell'originale.\n`;
  prompt += `   Preserva classi, ID, nesting. Preserva il CSS (colori, font, layout, animazioni).\n\n`;

  prompt += `2. CONTENUTI TESTUALI: Swappa tutti i testi per il nuovo prodotto "${product.name}" di "${product.brandName}".\n`;
  prompt += `   Preserva lo stesso numero di domande, opzioni, e profili risultato.\n`;
  prompt += `   Preserva gli stessi pattern di persuasione per ogni schermata.\n`;
  prompt += `   La pagina di RISULTATO è la più importante — deve essere ricca e persuasiva.\n\n`;

  prompt += `3. JAVASCRIPT — OBBLIGATORIO, RISCRIVI DA ZERO:\n`;
  prompt += `   - RIMUOVI tutti i tag <script src="..."> (puntano al dominio originale, non funzionano)\n`;
  prompt += `   - RIMUOVI tutti gli <script> inline esistenti (sono rotti)\n`;
  prompt += `   - SCRIVI UN UNICO <script> NUOVO prima di </body> con TUTTA la logica:\n\n`;

  prompt += `   a) NAVIGAZIONE: Mostra solo uno step alla volta. Al click su un'opzione → evidenzia → salva risposta → dopo 600-800ms avanza al prossimo step con animazione fadeOut/fadeIn.\n`;
  prompt += `   b) PROGRESS BAR: Aggiorna la barra di progresso ad ogni step.\n`;
  prompt += `   c) SCORING: Ogni opzione ha un data-category="ID_CATEGORIA". Al click salva in un oggetto. Alla fine conta le categorie e determina il vincitore.\n`;
  prompt += `   d) LOADING SCREEN: Dopo l'ultima domanda, mostra una schermata con messaggi progressivi (3-5 secondi) poi mostra il risultato.\n`;
  prompt += `   e) RISULTATO: Mostra il profilo corrispondente al punteggio più alto. Popola headline, descrizione, CTA con link "${product.ctaUrl}".\n`;
  prompt += `   f) Usa SOLO vanilla JavaScript. ZERO dipendenze esterne. Il file HTML deve funzionare aprendo da solo nel browser.\n`;
  prompt += `   g) Aggiungi data-step="0", data-step="1" etc. ai contenitori di ogni schermata per la navigazione.\n`;
  prompt += `   h) Aggiungi data-category="CATEGORY_ID" ad ogni opzione cliccabile per lo scoring.\n`;
  prompt += `   i) Aggiungi data-result="PROFILE_ID" ai contenitori dei risultati per mostrare quello giusto.\n\n`;

  prompt += `4. STILE CSS PER LE SELEZIONI (aggiungi in un tag <style>):\n`;
  prompt += `   - Stile .selected per le opzioni selezionate (border colorato, scale leggero, background tint)\n`;
  prompt += `   - Stile per le transizioni tra step (opacity transition)\n`;
  prompt += `   - cursor: pointer sulle opzioni cliccabili\n\n`;

  prompt += `Output: SOLO il file HTML completo da <!DOCTYPE html> a </html>.\n`;
  prompt += `Il quiz DEVE essere navigabile e funzionante. Testalo mentalmente: intro → domande → loading → risultato.`;

  return prompt;
}

// =====================================================
// SHARED PIPELINE HELPERS
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

function buildFallbackMasterSpec(
  entryUrl: string,
  funnelName: string,
  stepsInfo: Array<{ index: number; title: string; type: string }>,
): MasterSpec {
  return {
    visual: {} as MasterSpec['visual'],
    ux_flow: {} as MasterSpec['ux_flow'],
    cro: { copy_architecture: { per_screen: [] } } as unknown as MasterSpec['cro'],
    quiz_logic: {
      quiz_mechanics: { scoring_system: 'categorical', categories: [], result_determination: 'highest_category_count', tiebreaker_rule: 'first_in_list' },
      questions: [], result_profiles: [],
      lead_capture: { position: 'none', required: false, fields: [], incentive_text: '', skip_option: true, privacy_text: '' },
      loading_screen: { exists: false, messages: [], duration_ms: 0, fake_progress: false, analysis_labels: [] },
      data_tracking: { tracks_answers: false, sends_to_external: false, external_service_hints: [], utm_passthrough: false },
    },
    synthesis_notes: { conflicts_resolved: [], confidence_score: 0.3, warnings: ['No screenshots available — limited analysis'], critical_elements_to_preserve: [] },
    metadata: { original_url: entryUrl, funnel_name: funnelName, total_steps: stepsInfo.length, analyzed_at: new Date().toISOString(), agents_used: ['metadata_only'] },
  };
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
    console.warn('[multiagent] Branding generation failed:', err);
    return null;
  }
}

// =====================================================
// BACKGROUND PIPELINE (runs via waitUntil)
// =====================================================

async function runBackgroundPipeline(jobId: string, body: RequestBody) {
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

  try {
    // ── PHASE 1: Clone HTML ──
    await updateJobPhase(jobId, 'cloning', 'cloning_html', 'Clonazione HTML originale con Playwright...');

    const { clonedData, textNodes, cssTokens } = await cloneQuizHtml(entryUrl);

    await updateJobPhase(jobId, 'screenshots', 'cloning_done', 'HTML clonato con successo', {
      htmlSize: clonedData.renderedSize,
      textNodesCount: textNodes.length,
      cssCount: clonedData.cssCount,
    });

    // ── PHASE 2: Screenshots ──
    await updateJobPhase(jobId, 'screenshots', 'fetching_screenshots', 'Recupero screenshot per-step...');

    const { screenshots, stepsInfo } = await fetchScreenshotsAndSteps(entryUrl, funnelName, funnelSteps);

    await updateJobPhase(jobId, 'analyzing', 'screenshots_ready', 'Screenshot recuperati', {
      screenshotsCount: screenshots.length,
      stepsCount: stepsInfo.length,
    });

    // ── PHASE 3: Multi-Agent Analysis ──
    await updateJobPhase(jobId, 'analyzing', 'agents_start', '4 agenti Gemini in parallelo...');

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
        onProgress: async (phase, message) => {
          await updateJobPhase(jobId, 'analyzing', phase, message).catch(() => {});
        },
      });

      masterSpec = agentResult.masterSpec;
      masterSpec.metadata.original_url = entryUrl;
      masterSpec.metadata.funnel_name = funnelName;
    } else {
      masterSpec = buildFallbackMasterSpec(entryUrl, funnelName, stepsInfo);
    }

    await updateJobPhase(jobId, 'branding', 'agents_done', 'Analisi multi-agente completata', {
      confidence: masterSpec.synthesis_notes.confidence_score,
      warningsCount: masterSpec.synthesis_notes.warnings.length,
    });

    // ── PHASE 4: Branding ──
    await updateJobPhase(jobId, 'branding', 'generating_branding', 'Generazione branding per il tuo prodotto...');

    let branding = await generateBrandingForProduct(entryUrl, funnelName, product, funnelMeta);
    if (!branding) {
      branding = buildFallbackBranding(product, funnelName, funnelSteps);
    }

    await updateJobPhase(jobId, 'transforming', 'branding_done', 'Branding generato', {
      brandingSteps: branding.funnelSteps.length,
    });

    // ── PHASE 5: Claude Transform ──
    await updateJobPhase(jobId, 'transforming', 'transforming_html', 'Claude: trasformazione chirurgica dell\'HTML...');

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const userPrompt = buildTransformPrompt(
      clonedData.html,
      masterSpec,
      branding,
      product,
      extraInstructions || '',
    );

    const userContent: Anthropic.Messages.ContentBlockParam[] = [
      { type: 'text', text: userPrompt },
    ];

    if (screenshots.length > 0) {
      userContent.unshift({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: screenshots[0] },
      });
    }

    // Non-streaming call for background mode (more robust, no connection to maintain)
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 64000,
      temperature: 0.3,
      system: CLAUDE_TRANSFORM_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    totalInputTokens += message.usage.input_tokens;
    totalOutputTokens += message.usage.output_tokens;

    const resultHtml = message.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');

    // ── DONE ──
    await completeJob(jobId, resultHtml, masterSpec, branding, {
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
    });

    console.log(`[multiagent] Job ${jobId} completed. Tokens: ${totalInputTokens}in/${totalOutputTokens}out`);
  } catch (err) {
    console.error(`[multiagent] Job ${jobId} failed:`, err);
    await failJob(jobId, err);
  }
}

// =====================================================
// SSE HELPERS (for streaming mode)
// =====================================================

function sseEncode(data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

// =====================================================
// MAIN HANDLER
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RequestBody;
    const {
      entryUrl,
      product,
      mode,
    } = body;

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

    // ── BACKGROUND MODE (default) ──
    // Returns job ID immediately, processes in background via waitUntil.
    // Client polls GET /api/swipe-quiz/multiagent-generate/[jobId] for status.
    if (mode !== 'streaming') {
      const jobId = await createJob(body);

      waitUntil(runBackgroundPipeline(jobId, body));

      return new Response(
        JSON.stringify({
          jobId,
          status: 'pending',
          message: 'Job creato. Pipeline in esecuzione in background.',
          pollUrl: `/api/swipe-quiz/multiagent-generate/${jobId}`,
        }),
        {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // ── STREAMING MODE (legacy SSE) ──
    // Kept for backward compatibility. Streams progress + HTML via SSE.
    const funnelName = body.funnelName;
    const funnelSteps = body.funnelSteps;
    const funnelMeta = body.funnelMeta;
    const extraInstructions = body.extraInstructions;

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        let totalInputTokens = 0;
        let totalOutputTokens = 0;

        try {
          controller.enqueue(sseEncode({ phase: 'cloning_html', message: 'Clonazione HTML originale con Playwright...' }));

          const { clonedData, textNodes, cssTokens } = await cloneQuizHtml(entryUrl);

          controller.enqueue(sseEncode({
            phase: 'cloning_done',
            htmlSize: clonedData.renderedSize,
            textNodesCount: textNodes.length,
            cssCount: clonedData.cssCount,
            hasCssTokens: !!cssTokens,
          }));

          controller.enqueue(sseEncode({ phase: 'fetching_screenshots', message: 'Recupero screenshot per-step...' }));

          const { screenshots, stepsInfo } = await fetchScreenshotsAndSteps(entryUrl, funnelName, funnelSteps);

          controller.enqueue(sseEncode({
            phase: 'screenshots_ready',
            screenshotsCount: screenshots.length,
            stepsCount: stepsInfo.length,
          }));

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
            controller.enqueue(sseEncode({ phase: 'agents_skip', message: 'Nessuno screenshot disponibile — analisi basata su metadati' }));
            masterSpec = buildFallbackMasterSpec(entryUrl, funnelName, stepsInfo);
          }

          controller.enqueue(sseEncode({
            phase: 'agents_done',
            confidence: masterSpec.synthesis_notes.confidence_score,
            warnings: masterSpec.synthesis_notes.warnings.length,
          }));

          controller.enqueue(sseEncode({ phase: 'generating_branding', message: 'Generazione branding per il tuo prodotto...' }));

          let branding = await generateBrandingForProduct(entryUrl, funnelName, product, funnelMeta);
          if (!branding) {
            branding = buildFallbackBranding(product, funnelName, funnelSteps);
          }

          controller.enqueue(sseEncode({
            phase: 'branding_done',
            hasBranding: !!branding,
            brandingSteps: branding.funnelSteps.length,
          }));

          controller.enqueue(sseEncode({ phase: 'transforming_html', message: 'Claude: trasformazione chirurgica dell\'HTML...' }));

          const anthropic = new Anthropic({ apiKey: anthropicKey });

          const userPrompt = buildTransformPrompt(
            clonedData.html,
            masterSpec,
            branding,
            product,
            extraInstructions || '',
          );

          const userContent: Anthropic.Messages.ContentBlockParam[] = [
            { type: 'text', text: userPrompt },
          ];

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
          console.error('[multiagent-generate] SSE Error:', errorMsg);
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
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

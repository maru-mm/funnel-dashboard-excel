import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { DesignSpec } from '../design-analysis/route';
import type { CssTokens } from '../screenshot/route';
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

interface FunnelStep {
  step_index: number;
  url?: string;
  title?: string;
  step_type?: string;
  input_type?: string;
  options?: string[];
  description?: string;
  cta_text?: string;
}

// =====================================================
// SYSTEM PROMPTS — Legacy modes (simple + swap)
// =====================================================

const SYSTEM_PROMPT_SIMPLE = `Sei un esperto sviluppatore frontend specializzato nella creazione di quiz interattivi per il marketing.
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

const SYSTEM_PROMPT_SWAP = `Sei un esperto sviluppatore frontend e un esperto di quiz funnel marketing.
Il tuo compito è REPLICARE ESATTAMENTE la struttura e il design di un quiz funnel di riferimento, 
ma SWAPPARE tutto il contenuto, il branding e il copy per adattarlo a un NUOVO PRODOTTO.

COSA DEVI FARE:
1. ANALIZZARE il quiz originale (screenshot + struttura step fornita)
2. REPLICARE la stessa identica struttura: stesso numero di domande, stessi tipi di risposta, stessa logica di risultato, stessa progress bar, stessi pattern di design
3. SWAPPARE tutto per il nuovo prodotto: testi, colori del brand, headline, opzioni di risposta, risultati, CTA
4. GENERARE il branding adeguato basandoti sul brief prodotto

REGOLE DI OUTPUT:
1. Genera un SINGOLO file HTML completo e autosufficiente (CSS + JS embedded)
2. Il quiz deve funzionare immediatamente in un iframe
3. Design moderno, responsive (mobile-first), con gradient, ombre, transizioni e animazioni
4. NON usare librerie esterne (no CDN, no framework)
5. Genera SOLO il codice HTML puro — nessuna spiegazione, nessun markdown, nessun backtick
6. Inizia DIRETTAMENTE con <!DOCTYPE html> e termina con </html>
7. I testi devono essere nella stessa lingua del quiz originale (se italiano, mantieni italiano)

STRUTTURA DA REPLICARE FEDELMENTE:
- Stessa sequenza di step (intro → domande → risultato)
- Stesse tipologie di domanda (scelta singola, multipla, slider, ecc.)
- Stesso numero di opzioni per domanda
- Stessa logica di calcolo risultato (profili, punteggio, raccomandazione)
- Stessi pattern di persuasione (urgency, social proof, authority)
- Stessa disposizione visiva (layout, progress bar, animazioni)

BRANDING DEL NUOVO PRODOTTO:
- Genera una palette colori adeguata al prodotto
- Crea headline e copy persuasivo
- Adatta le domande al contesto del prodotto
- I risultati devono raccomandare il prodotto con CTA appropriata
- Mantieni lo stesso livello di qualità e professionalità del quiz originale`;

// =====================================================
// CHUNKED MODE — System prompts for each chunk
// =====================================================

const SYSTEM_PROMPT_CHUNK_CSS = `Sei un esperto CSS developer specializzato in quiz funnel design.
Il tuo compito è generare SOLO il CSS (contenuto del tag <style>) per un quiz funnel.

REGOLE:
1. Usa CSS custom properties (--var) per tutti i colori, font, spacing, border-radius
2. Includi: variabili root, reset minimale, layout container, progress bar, bottoni, card opzioni, animazioni, transizioni, responsive breakpoints
3. Il design deve essere mobile-first e responsive
4. Includi animazioni per: transizione tra step (fadeIn/slideUp), hover sui bottoni, selezione opzione, progress bar
5. NON generare HTML o JavaScript — SOLO CSS puro
6. NON usare librerie esterne
7. Genera SOLO il codice CSS, senza spiegazioni, senza markdown, senza backtick, senza tag <style>
8. Il CSS deve usare i VALORI ESATTI di colori/font/spacing forniti nella design spec
9. Genera classi specifiche per OGNI tipo di input fornito (multiple_choice, image_select, checkbox, text_input, numeric_input, slider, body_mapping)
10. Includi classi per: .quiz-result (pagina risultati), .quiz-checkout (pagina offerta), .quiz-info-screen (schermate informative), .quiz-lead-capture (form email)`;

const SYSTEM_PROMPT_CHUNK_JS = `Sei un esperto JavaScript developer specializzato in quiz interattivi.
Il tuo compito è generare SOLO il JavaScript (contenuto del tag <script>) per un quiz funnel engine.

REGOLE:
1. Implementa: state machine per navigazione step, tracking risposte, calcolo progress, logica risultati, animazioni tra step
2. Il quiz deve gestire TUTTI questi tipi di step: intro, quiz_question, info_screen, lead_capture, results, checkout
3. Per quiz_question: click su opzione seleziona e auto-avanza dopo 300ms
4. Per info_screen: mostra info + bottone Continue
5. Per lead_capture: form email con validazione, bottone submit
6. Per results: mostra risultato personalizzato basato sulle risposte raccolte
7. Per checkout: mostra offerta con CTA link
8. Usa le classi CSS definite nella design spec (verranno fornite)
9. Il codice deve essere vanilla JS — NO framework, NO librerie esterne
10. NON generare HTML o CSS — SOLO JavaScript puro
11. NON usare document.write
12. Genera SOLO il codice JavaScript, senza spiegazioni, senza markdown, senza backtick, senza tag <script>
13. Il JS deve trovare gli elementi nel DOM tramite data-attributes (data-step, data-step-type, data-option)
14. Includi animazioni CSS class toggle per transizioni tra step
15. Includi un bottone back/indietro funzionante per ogni step (tranne il primo)
16. La progress bar deve mostrare il progresso reale basato sul numero di step completati`;

const SYSTEM_PROMPT_CHUNK_HTML = `Sei un esperto frontend developer che genera il MARKUP HTML per quiz funnel.
Il CSS e il JavaScript verranno inseriti automaticamente dal server. Tu genera SOLO il markup HTML del body.

REGOLE:
1. Genera SOLO il contenuto del <body> — NO <!DOCTYPE>, NO <html>, NO <head>, NO <style>, NO <script>
2. Inizia direttamente con il primo div del quiz (es. <div class="quiz-container">)
3. Genera TUTTO il markup HTML per ogni step del quiz: intro, domande, info screen, lead capture, risultati, checkout
4. Usa data-step="N" e data-step-type="tipo" su ogni screen
5. Il primo step ha anche la classe "active"
6. Usa le classi CSS che verranno fornite
7. NON usare librerie esterne
8. Genera SOLO markup HTML puro, senza spiegazioni, senza markdown, senza backtick
9. OGNI step del quiz DEVE essere presente — non saltare nessuno step
10. Includi SEMPRE: una pagina risultati (data-step-type="results") e una pagina offerta (data-step-type="checkout") alla fine`;

// =====================================================
// HELPERS
// =====================================================

function buildDesignSpecText(
  designSpec?: DesignSpec | null,
  cssTokens?: CssTokens | null
): string {
  let text = '';

  if (designSpec) {
    const cp = designSpec.color_palette;
    text += `=== DESIGN SPEC (usa questi valori ESATTI) ===\n`;
    text += `COLORI:\n`;
    text += `  --color-primary: ${cp.primary}\n`;
    text += `  --color-secondary: ${cp.secondary}\n`;
    text += `  --color-accent: ${cp.accent}\n`;
    text += `  --color-background: ${cp.background}\n`;
    text += `  --color-text: ${cp.text_primary}\n`;
    text += `  --color-text-secondary: ${cp.text_secondary}\n`;
    text += `  --color-button-bg: ${cp.button_bg}\n`;
    text += `  --color-button-text: ${cp.button_text}\n`;
    text += `  --color-progress: ${cp.progress_bar}\n`;
    text += `  --color-progress-bg: ${cp.progress_bar_bg}\n`;
    text += `  --color-card-bg: ${cp.card_bg}\n`;
    text += `  --color-border: ${cp.border}\n`;
    if (designSpec.gradients.length > 0) {
      text += `GRADIENTI: ${designSpec.gradients.join(' | ')}\n`;
    }
    text += `TIPOGRAFIA:\n`;
    text += `  Heading: ${designSpec.typography.heading_style}\n`;
    text += `  Body: ${designSpec.typography.body_style}\n`;
    text += `  Font family: ${designSpec.typography.font_family_detected}\n`;
    text += `LAYOUT:\n`;
    text += `  Max width: ${designSpec.layout.max_width}\n`;
    text += `  Alignment: ${designSpec.layout.alignment}\n`;
    text += `  Card style: ${designSpec.layout.card_style}\n`;
    text += `  Border radius: ${designSpec.layout.border_radius}\n`;
    text += `  Shadow: ${designSpec.layout.shadow_style}\n`;
    text += `  Spacing: ${designSpec.layout.spacing}\n`;
    text += `PROGRESS BAR:\n`;
    text += `  Style: ${designSpec.progress_bar.style}\n`;
    text += `  Position: ${designSpec.progress_bar.position}\n`;
    text += `  Color: ${designSpec.progress_bar.color}, BG: ${designSpec.progress_bar.bg_color}\n`;
    text += `BOTTONI:\n`;
    text += `  Shape: ${designSpec.button_style.shape}\n`;
    text += `  Size: ${designSpec.button_style.size}\n`;
    text += `  Shadow: ${designSpec.button_style.has_shadow ? 'sì' : 'no'}\n`;
    text += `  Icon: ${designSpec.button_style.has_icon ? 'sì' : 'no'}\n`;
    text += `OPZIONI RISPOSTA:\n`;
    text += `  Layout: ${designSpec.options_style.layout}\n`;
    text += `  Item style: ${designSpec.options_style.item_style}\n`;
    text += `  Icons: ${designSpec.options_style.has_icons ? 'sì' : 'no'}\n`;
    text += `  Images: ${designSpec.options_style.has_images ? 'sì' : 'no'}\n`;
    text += `  Selezione: ${designSpec.options_style.selected_indicator}\n`;
    text += `MOOD GENERALE: ${designSpec.overall_mood}\n`;
    text += `ANIMAZIONI: ${designSpec.visual_elements.animation_style}\n`;
    text += '\n';
  }

  if (cssTokens) {
    text += `=== CSS TOKENS REALI (estratti dal DOM originale) ===\n`;
    const printTokens = (label: string, tokens: typeof cssTokens.body) => {
      if (!tokens) return;
      text += `${label}:\n`;
      text += `  color: ${tokens.color}, bg: ${tokens.bg}\n`;
      text += `  font: ${tokens.fontFamily} ${tokens.fontSize} ${tokens.fontWeight}\n`;
      text += `  border-radius: ${tokens.borderRadius}\n`;
      if (tokens.boxShadow && tokens.boxShadow !== 'none') {
        text += `  box-shadow: ${tokens.boxShadow}\n`;
      }
    };
    printTokens('Body', cssTokens.body);
    printTokens('Heading', cssTokens.heading);
    printTokens('Button', cssTokens.button);
    printTokens('Card/Option', cssTokens.card);
    printTokens('Progress Bar', cssTokens.progressBar);
    printTokens('Container', cssTokens.container);
    text += '\n';
  }

  return text;
}

function buildBrandingText(branding: GeneratedBranding): string {
  let text = `=== BRANDING GENERATO ===\n`;
  const bi = branding.brandIdentity;
  text += `Brand: ${bi.brandName}\n`;
  text += `Tagline: ${bi.tagline}\n`;
  text += `Voice/Tone: ${bi.voiceTone}\n`;
  text += `Hook emotivo: ${bi.emotionalHook}\n`;
  text += `USP: ${bi.uniqueSellingProposition}\n`;
  text += `Colori brand: primary=${bi.colorPalette.primary}, secondary=${bi.colorPalette.secondary}, accent=${bi.colorPalette.accent}, bg=${bi.colorPalette.background}, text=${bi.colorPalette.text}, cta_bg=${bi.colorPalette.ctaBackground}, cta_text=${bi.colorPalette.ctaText}\n`;
  text += `Typography: heading=${bi.typography.headingStyle}, body=${bi.typography.bodyStyle}\n\n`;

  if (branding.quizBranding) {
    const qb = branding.quizBranding;
    text += `QUIZ BRANDING:\n`;
    text += `  Titolo quiz: ${qb.quizTitle}\n`;
    text += `  Sottotitolo: ${qb.quizSubtitle}\n`;
    text += `  Intro text: ${qb.quizIntroText}\n`;
    text += `  Progress label: ${qb.progressBarLabel}\n`;
    text += `  Result headline: ${qb.resultPageHeadline}\n`;
    text += `  Result subheadline: ${qb.resultPageSubheadline}\n`;
    text += `  Result body: ${qb.resultPageBodyCopy}\n`;
    text += `  Personalization hook: ${qb.personalizationHook}\n\n`;
  }

  text += `STEP DEL QUIZ (contenuto per ogni step):\n`;
  for (const step of branding.funnelSteps) {
    text += `\n--- STEP ${step.stepIndex} [${step.originalPageType}] ---\n`;
    text += `Headline: ${step.headline}\n`;
    if (step.subheadline) text += `Subheadline: ${step.subheadline}\n`;
    if (step.bodyCopy) text += `Body: ${step.bodyCopy}\n`;
    if (step.ctaTexts.length > 0) text += `CTA: ${step.ctaTexts.join(', ')}\n`;
    if (step.quizQuestion) text += `Domanda: ${step.quizQuestion}\n`;
    if (step.quizOptions && step.quizOptions.length > 0) {
      text += `Opzioni:\n`;
      step.quizOptions.forEach((opt, i) => {
        const sub = step.quizOptionSubtexts?.[i];
        text += `  ${i + 1}. ${opt}${sub ? ` — ${sub}` : ''}\n`;
      });
    }
    if (step.urgencyElements.length > 0) text += `Urgenza: ${step.urgencyElements.join(', ')}\n`;
    if (step.socialProof.length > 0) text += `Social proof: ${step.socialProof.join(', ')}\n`;
  }
  text += '\n';

  const ge = branding.globalElements;
  text += `ELEMENTI GLOBALI:\n`;
  if (ge.socialProofStatements.length > 0) text += `Social proof: ${ge.socialProofStatements.join(' | ')}\n`;
  if (ge.urgencyElements.length > 0) text += `Urgenza: ${ge.urgencyElements.join(' | ')}\n`;
  if (ge.trustBadges.length > 0) text += `Trust badges: ${ge.trustBadges.join(', ')}\n`;
  if (ge.guaranteeText) text += `Garanzia: ${ge.guaranteeText}\n`;
  text += '\n';

  if (branding.swipeInstructions) {
    text += `ISTRUZIONI SWIPE: ${branding.swipeInstructions}\n\n`;
  }

  return text;
}

function sseEncode(data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

// =====================================================
// CHUNKED GENERATION — 3 focused Claude calls
// =====================================================

async function runChunkedGeneration(
  client: Anthropic,
  designSpec: DesignSpec | null,
  cssTokens: CssTokens | null,
  branding: GeneratedBranding,
  funnelSteps: FunnelStep[] | undefined,
  funnelMeta: Record<string, unknown> | undefined,
  screenshot: string | undefined,
  extraPrompt: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
) {
  const designText = buildDesignSpecText(designSpec, cssTokens);
  const brandingText = buildBrandingText(branding);
  const totalSteps = branding.funnelSteps.length;

  // Extract unique input types and step-type mapping from funnel steps
  const inputTypes = new Set<string>();
  const stepTypeMapping: Record<number, string> = {};
  if (funnelSteps) {
    for (const s of funnelSteps) {
      if (s.input_type) inputTypes.add(s.input_type);
      stepTypeMapping[s.step_index] = s.step_type || 'other';
    }
  }
  // Also extract from branding steps
  for (const s of branding.funnelSteps) {
    stepTypeMapping[s.stepIndex] = s.originalPageType || 'other';
  }

  // Ensure results and checkout are in the mapping
  const hasResults = Object.values(stepTypeMapping).some(t => t === 'results' || t === 'thank_you');
  const hasCheckout = Object.values(stepTypeMapping).some(t => t === 'checkout');
  if (!hasResults) stepTypeMapping[totalSteps] = 'results';
  if (!hasCheckout) stepTypeMapping[totalSteps + (hasResults ? 0 : 1)] = 'checkout';

  const inputTypesStr = inputTypes.size > 0
    ? Array.from(inputTypes).join(', ')
    : 'multiple_choice, text_input, button';

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // ── CHUNK 1: CSS Design System ──
  controller.enqueue(sseEncode({ phase: 'css', phaseLabel: 'Generazione CSS Design System...' }));

  const cssUserPrompt =
    `Genera il CSS design system completo per un quiz funnel di ${totalSteps} step.\n\n` +
    designText +
    `Il CSS DEVE usare i colori hex ESATTI dalla design spec sopra come CSS custom properties.\n\n` +
    `TIPI DI INPUT PRESENTI NEL QUIZ: ${inputTypesStr}\n` +
    `Genera classi CSS specifiche per OGNI tipo di input elencato sopra.\n\n` +
    `Includi: :root variables, *, body reset, .quiz-container, .quiz-step (hidden by default), .quiz-step.active (visible), ` +
    `.progress-bar, .progress-fill, .quiz-question, .quiz-options, .quiz-option (card stile), .quiz-option.selected, ` +
    `.quiz-btn (CTA button), .quiz-btn-back (back button), .quiz-result, .quiz-intro, .quiz-lead-capture, .quiz-checkout, .quiz-info-screen, ` +
    `animazioni (@keyframes fadeIn, slideUp), transizioni hover, responsive media queries.\n\n` +
    `Output SOLO il CSS puro senza tag <style> e senza spiegazioni.`;

  const cssStream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    temperature: 0.3,
    system: SYSTEM_PROMPT_CHUNK_CSS,
    messages: [{ role: 'user', content: cssUserPrompt }],
  });

  let cssCode = '';
  for await (const event of cssStream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      cssCode += event.delta.text;
      controller.enqueue(sseEncode({ chunk: 'css', text: event.delta.text }));
    }
  }
  const cssFinal = await cssStream.finalMessage();
  totalInputTokens += cssFinal.usage.input_tokens;
  totalOutputTokens += cssFinal.usage.output_tokens;

  cssCode = cssCode.replace(/^```css\s*/i, '').replace(/```\s*$/i, '').trim();
  cssCode = cssCode.replace(/^<style[^>]*>/i, '').replace(/<\/style>\s*$/i, '').trim();

  controller.enqueue(sseEncode({ phase: 'css_done', cssLength: cssCode.length }));

  // ── CHUNK 2: Quiz JS Engine ──
  controller.enqueue(sseEncode({ phase: 'js', phaseLabel: 'Generazione Quiz Engine JS...' }));

  let stepsDescription = '';
  for (const step of branding.funnelSteps) {
    const stepType = stepTypeMapping[step.stepIndex] || step.originalPageType || 'other';
    stepsDescription += `Step ${step.stepIndex} [${stepType}]: `;
    if (step.quizQuestion) {
      stepsDescription += `Domanda: "${step.quizQuestion}"`;
      if (step.quizOptions && step.quizOptions.length > 0) {
        stepsDescription += ` | Opzioni: ${step.quizOptions.map((o, i) => `${i + 1}.${o}`).join(', ')}`;
      }
    } else {
      stepsDescription += `${step.headline}`;
    }
    stepsDescription += '\n';
  }

  const stepMappingStr = JSON.stringify(stepTypeMapping, null, 2);

  const jsUserPrompt =
    `Genera il JavaScript engine per un quiz di ${totalSteps} step.\n\n` +
    `STEP-TYPE MAPPING (usa questo per capire COSA fa ogni step):\n${stepMappingStr}\n\n` +
    `STRUTTURA STEP:\n${stepsDescription}\n` +
    `CLASSI CSS DA USARE:\n` +
    `- .quiz-step: ogni schermata (nascosta per default)\n` +
    `- .quiz-step.active: schermata visibile\n` +
    `- .quiz-option: opzione cliccabile\n` +
    `- .quiz-option.selected: opzione selezionata\n` +
    `- .quiz-btn: bottone CTA/avanti\n` +
    `- .quiz-btn-back: bottone indietro\n` +
    `- .progress-fill: barra progresso (width in %)\n` +
    `- data-step="N": attributo su ogni screen\n` +
    `- data-step-type="tipo": attributo con il tipo di step\n` +
    `- data-option: attributo su ogni opzione\n\n` +
    `LOGICA PER TIPO DI STEP:\n` +
    `- "intro": mostra intro, bottone avanti\n` +
    `- "quiz_question": click su opzione → seleziona → auto-avanza dopo 300ms\n` +
    `- "info_screen": mostra info + bottone Continue\n` +
    `- "lead_capture": form email con validazione base, bottone submit\n` +
    `- "results": mostra risultato personalizzato (usa le risposte raccolte per personalizzare il testo)\n` +
    `- "checkout": mostra offerta con CTA link esterno\n\n` +
    `Il JS deve:\n` +
    `1. Inizializzare mostrando step 0\n` +
    `2. Gestire il comportamento diverso per ogni data-step-type\n` +
    `3. Navigare tra step con animazione (fadeIn/slideUp)\n` +
    `4. Aggiornare la progress bar in base allo step corrente\n` +
    `5. Raccogliere tutte le risposte in un oggetto\n` +
    `6. Bottone back funzionante (tranne primo step)\n` +
    `7. Nella pagina results, personalizzare il testo con le risposte raccolte\n\n` +
    `Output SOLO il JavaScript puro senza tag <script> e senza spiegazioni.`;

  const jsStream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 12000,
    temperature: 0.3,
    system: SYSTEM_PROMPT_CHUNK_JS,
    messages: [{ role: 'user', content: jsUserPrompt }],
  });

  let jsCode = '';
  for await (const event of jsStream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      jsCode += event.delta.text;
      controller.enqueue(sseEncode({ chunk: 'js', text: event.delta.text }));
    }
  }
  const jsFinal = await jsStream.finalMessage();
  totalInputTokens += jsFinal.usage.input_tokens;
  totalOutputTokens += jsFinal.usage.output_tokens;

  jsCode = jsCode.replace(/^```(?:javascript|js)\s*/i, '').replace(/```\s*$/i, '').trim();
  jsCode = jsCode.replace(/^<script[^>]*>/i, '').replace(/<\/script>\s*$/i, '').trim();

  controller.enqueue(sseEncode({ phase: 'js_done', jsLength: jsCode.length }));

  // ── CHUNK 3: HTML Markup Only (server assembles final file) ──
  controller.enqueue(sseEncode({ phase: 'html', phaseLabel: 'Generazione markup HTML...' }));

  const htmlUserContent: Anthropic.Messages.ContentBlockParam[] = [];

  if (screenshot) {
    htmlUserContent.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: screenshot },
    });
  }

  let htmlTextPrompt =
    `Genera SOLO il markup HTML del body per il quiz funnel (il CSS e JS verranno inseriti automaticamente dal server).\n\n` +
    brandingText +
    designText;

  if (funnelMeta) {
    htmlTextPrompt += `FUNNEL ORIGINALE: ${JSON.stringify(funnelMeta)}\n\n`;
  }

  if (extraPrompt) {
    htmlTextPrompt += `ISTRUZIONI AGGIUNTIVE: ${extraPrompt}\n\n`;
  }

  htmlTextPrompt +=
    `STEP-TYPE MAPPING: ${stepMappingStr}\n\n` +
    `GENERA SOLO il markup HTML del body:\n` +
    `- Progress bar: <div class="progress-bar"><div class="progress-fill"></div></div>\n` +
    `- Quiz container: <div class="quiz-container">...</div>\n` +
    `- Ogni step: <div class="quiz-step" data-step="N" data-step-type="tipo">...</div>\n` +
    `- Il primo step ha anche la classe "active"\n` +
    `- Opzioni: <div class="quiz-option" data-option="valore">...</div>\n` +
    `- Bottone avanti: <button class="quiz-btn">...</button>\n` +
    `- Bottone back: <button class="quiz-btn-back">...</button>\n` +
    `- Usa i testi ESATTI dal branding fornito sopra\n` +
    `- DEVI includere TUTTI gli step dal branding — non saltare nessuno\n` +
    `- DEVI includere step results e checkout alla fine\n` +
    `- NON generare <!DOCTYPE>, <html>, <head>, <style> o <script> — SOLO il markup body\n` +
    `- Output: dal primo <div> all'ultimo </div>, niente altro.`;

  htmlUserContent.push({ type: 'text', text: htmlTextPrompt });

  const htmlStream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    temperature: 0.4,
    system: SYSTEM_PROMPT_CHUNK_HTML,
    messages: [{ role: 'user', content: htmlUserContent }],
  });

  let htmlMarkup = '';
  for await (const event of htmlStream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      htmlMarkup += event.delta.text;
      controller.enqueue(sseEncode({ chunk: 'html_markup', text: event.delta.text }));
    }
  }
  const htmlFinal = await htmlStream.finalMessage();
  totalInputTokens += htmlFinal.usage.input_tokens;
  totalOutputTokens += htmlFinal.usage.output_tokens;

  // Clean HTML markup
  htmlMarkup = htmlMarkup.replace(/^```html?\s*/i, '').replace(/```\s*$/i, '').trim();
  // Remove any accidental full HTML wrapping
  htmlMarkup = htmlMarkup.replace(/^<!DOCTYPE[^>]*>/i, '').replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head>[\s\S]*?<\/head>/gi, '').replace(/<\/?body[^>]*>/gi, '').trim();

  // ── SERVER-SIDE ASSEMBLY ──
  controller.enqueue(sseEncode({ phase: 'assembling', phaseLabel: 'Assemblaggio finale lato server...' }));

  const title = (funnelMeta as Record<string, unknown>)?.funnel_name || 'Quiz Funnel';
  const finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
${cssCode}
</style>
</head>
<body>
${htmlMarkup}
<script>
${jsCode}
</script>
</body>
</html>`;

  // Send the assembled HTML as the final output
  controller.enqueue(sseEncode({ assembled: true, html: finalHtml, htmlLength: finalHtml.length }));

  return { totalInputTokens, totalOutputTokens };
}

// =====================================================
// MAIN HANDLER
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      temperature,
      screenshot,
      product,
      funnelSteps,
      funnelMeta,
      // New chunked mode fields
      designSpec,
      cssTokens,
      branding,
      mode,
    } = body as {
      prompt: string;
      temperature?: number;
      screenshot?: string;
      product?: ProductData;
      funnelSteps?: FunnelStep[];
      funnelMeta?: Record<string, unknown>;
      designSpec?: DesignSpec | null;
      cssTokens?: CssTokens | null;
      branding?: GeneratedBranding | null;
      mode?: 'simple' | 'swap' | 'chunked';
    };

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

    // Determine mode
    const isChunkedMode = mode === 'chunked' && branding;
    const isSwapMode = !isChunkedMode && !!(screenshot || product || funnelSteps?.length);

    // ── CHUNKED MODE: 3 focused Claude calls ──
    if (isChunkedMode && branding) {
      console.log(`[swipe-quiz] Chunked generation: ${branding.funnelSteps.length} steps, designSpec=${!!designSpec}, cssTokens=${!!cssTokens}`);

      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            const usage = await runChunkedGeneration(
              client,
              designSpec ?? null,
              cssTokens ?? null,
              branding,
              funnelSteps,
              funnelMeta,
              screenshot,
              prompt,
              controller,
            );

            controller.enqueue(sseEncode({
              done: true,
              mode: 'chunked',
              usage: {
                input_tokens: usage.totalInputTokens,
                output_tokens: usage.totalOutputTokens,
              },
            }));
            controller.close();
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Errore durante la generazione chunked';
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
    }

    // ── LEGACY MODES: simple + swap (unchanged behavior) ──

    const userContent: Anthropic.Messages.ContentBlockParam[] = [];

    if (screenshot) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: screenshot },
      });
    }

    let textPrompt = '';

    if (isSwapMode) {
      textPrompt += `RICHIESTA: Replica questo quiz funnel swappando il contenuto per il mio prodotto.\n\n`;

      if (funnelMeta) {
        textPrompt += `=== QUIZ FUNNEL DI RIFERIMENTO ===\n`;
        const fm = funnelMeta as Record<string, unknown>;
        if (fm.funnel_name) textPrompt += `Nome: ${fm.funnel_name}\n`;
        if (fm.brand_name) textPrompt += `Brand originale: ${fm.brand_name}\n`;
        if (fm.entry_url) textPrompt += `URL: ${fm.entry_url}\n`;
        if (fm.funnel_type) textPrompt += `Tipo: ${fm.funnel_type}\n`;
        if (fm.category) textPrompt += `Categoria: ${fm.category}\n`;
        if (fm.total_steps) textPrompt += `Totale step: ${fm.total_steps}\n`;
        if (fm.lead_capture_method) textPrompt += `Metodo lead capture: ${fm.lead_capture_method}\n`;
        if (fm.analysis_summary) textPrompt += `Analisi: ${fm.analysis_summary}\n`;
        if (Array.isArray(fm.persuasion_techniques) && fm.persuasion_techniques.length) {
          textPrompt += `Tecniche di persuasione: ${fm.persuasion_techniques.join(', ')}\n`;
        }
        if (Array.isArray(fm.notable_elements) && fm.notable_elements.length) {
          textPrompt += `Elementi notevoli: ${fm.notable_elements.join(', ')}\n`;
        }
        textPrompt += '\n';
      }

      // Inject design spec into legacy swap mode too (if available)
      if (designSpec || cssTokens) {
        textPrompt += buildDesignSpecText(designSpec, cssTokens);
      }

      if (funnelSteps && funnelSteps.length > 0) {
        textPrompt += `=== STRUTTURA COMPLETA DEGLI STEP (replica fedelmente) ===\n`;
        for (const step of funnelSteps) {
          textPrompt += `\n--- STEP ${step.step_index} ---\n`;
          if (step.title) textPrompt += `Titolo: ${step.title}\n`;
          if (step.step_type) textPrompt += `Tipo: ${step.step_type}\n`;
          if (step.input_type) textPrompt += `Input: ${step.input_type}\n`;
          if (step.description) textPrompt += `Descrizione: ${step.description}\n`;
          if (step.cta_text) textPrompt += `CTA: ${step.cta_text}\n`;
          if (step.url) textPrompt += `URL: ${step.url}\n`;
          if (step.options && step.options.length > 0) {
            textPrompt += `Opzioni di risposta:\n`;
            step.options.forEach((opt, i) => {
              textPrompt += `  ${i + 1}. ${opt}\n`;
            });
          }
        }
        textPrompt += '\n';
      }

      if (product) {
        textPrompt += `=== IL MIO PRODOTTO (usa questi dati per il branding) ===\n`;
        textPrompt += `Nome prodotto: ${product.name}\n`;
        textPrompt += `Brand: ${product.brandName}\n`;
        textPrompt += `Descrizione: ${product.description}\n`;
        textPrompt += `Prezzo: €${product.price}\n`;
        if (product.benefits.length > 0) {
          textPrompt += `Benefici:\n`;
          product.benefits.forEach((b, i) => {
            textPrompt += `  ${i + 1}. ${b}\n`;
          });
        }
        textPrompt += `CTA principale: ${product.ctaText}\n`;
        textPrompt += `URL CTA: ${product.ctaUrl}\n`;
        textPrompt += '\n';
      }

      if (screenshot) {
        textPrompt += `Ho allegato uno SCREENSHOT del quiz originale. Replica fedelmente il design visivo che vedi:\n`;
        textPrompt += `- Stessa disposizione e layout\n`;
        textPrompt += `- Stessi pattern grafici (progress bar, card, bottoni)\n`;
        textPrompt += `- Stesse animazioni e transizioni\n`;
        textPrompt += `- MA con colori, testi e branding del MIO prodotto\n\n`;
      }

      textPrompt += `ISTRUZIONI AGGIUNTIVE: ${prompt}\n\n`;
      textPrompt += `Genera SOLO il codice HTML completo del quiz swappato. Nessuna spiegazione.`;
    } else {
      textPrompt = `Crea un quiz interattivo HTML/CSS/JS completo per: ${prompt}\n\nGenera SOLO il codice HTML completo. Nessuna spiegazione aggiuntiva.`;
    }

    userContent.push({ type: 'text', text: textPrompt });

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 32000,
      temperature: temperature ?? (isSwapMode ? 0.5 : 0.7),
      system: isSwapMode ? SYSTEM_PROMPT_SWAP : SYSTEM_PROMPT_SIMPLE,
      messages: [{ role: 'user', content: userContent }],
    });

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(sseEncode({ text: event.delta.text }));
            }
          }

          const finalMessage = await stream.finalMessage();
          controller.enqueue(sseEncode({
            done: true,
            mode: isSwapMode ? 'swap' : 'simple',
            usage: {
              input_tokens: finalMessage.usage.input_tokens,
              output_tokens: finalMessage.usage.output_tokens,
            },
          }));
          controller.close();
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Errore durante la generazione';
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
    console.error('Swipe Quiz generate error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Errore interno del server',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

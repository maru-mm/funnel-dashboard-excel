import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

type OutputStack = 'pure_css' | 'bootstrap' | 'tailwind' | 'foundation' | 'bulma' | 'custom';

interface StackConfig {
  label: string;
  cdn: string;
  instructions: string;
}

const STACK_CONFIGS: Record<OutputStack, StackConfig> = {
  pure_css: {
    label: 'CSS Puro',
    cdn: '',
    instructions: `- Usa SOLO HTML + CSS puro, NESSUN framework.
- Includi un tag <style> con TUTTI gli stili necessari.
- Tutti gli stili CSS devono essere SCOPED usando un wrapper con classe unica (es. .saved-section-XXXX).
- NON usare classi di framework (no .container, .row, .col-*, ecc. di Bootstrap/Tailwind).
- Scrivi le media queries necessarie per la responsività.`,
  },
  bootstrap: {
    label: 'Bootstrap 5',
    cdn: `<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YcnS/1tMn4WRjNkMBfdzn0J6w/mK2+Gj0gE" crossorigin="anonymous">
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"><\/script>`,
    instructions: `- Usa classi Bootstrap 5 per layout, griglia, tipografia, spaziatura, componenti.
- Usa il sistema a griglia Bootstrap: .container, .row, .col-* con breakpoint (col-sm, col-md, col-lg, col-xl).
- Usa le utility Bootstrap: text-center, d-flex, justify-content-*, align-items-*, p-*, m-*, bg-*, text-*, rounded, shadow, etc.
- Usa componenti Bootstrap dove appropriato: .btn, .card, .badge, .alert, .list-group, etc.
- INCLUDI un commento in cima che indica la dipendenza da Bootstrap 5 CDN.
- Aggiungi il link CDN di Bootstrap 5 in un commento <!-- Bootstrap 5 CDN required --> prima della sezione.
- Per interattività (collapse, modal, tooltip), usa gli attributi data-bs-* di Bootstrap 5.
- Eventuali stili custom extra vanno in un tag <style> separato con classe scoped.
- Il JavaScript deve essere SOLO vanilla JS o Bootstrap JS (no jQuery, no React, no Vue).`,
  },
  tailwind: {
    label: 'Tailwind CSS',
    cdn: `<script src="https://cdn.tailwindcss.com"><\/script>`,
    instructions: `- Usa classi utility Tailwind CSS per TUTTO lo styling.
- Usa il sistema di responsive: sm:, md:, lg:, xl: prefixes.
- Usa flex, grid, gap, padding, margin, text, bg, border, rounded, shadow utilities.
- NON creare un tag <style> separato — tutto via classi Tailwind inline.
- INCLUDI un commento in cima: <!-- Tailwind CSS CDN required -->
- Per hover, focus: usa hover:, focus: prefixes.
- Per dark mode: usa dark: prefix se appropriato.`,
  },
  foundation: {
    label: 'Foundation 6',
    cdn: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/foundation-sites@6.8.1/dist/css/foundation.min.css">`,
    instructions: `- Usa classi Foundation 6 per layout e componenti.
- Usa il grid system Foundation: .grid-container, .grid-x, .cell, .small-*, .medium-*, .large-*.
- Usa componenti Foundation dove appropriato: .button, .callout, .card, .badge, etc.
- INCLUDI un commento in cima: <!-- Foundation 6 CDN required -->
- Eventuali stili custom extra vanno in un tag <style> separato.`,
  },
  bulma: {
    label: 'Bulma',
    cdn: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@1.0.0/css/bulma.min.css">`,
    instructions: `- Usa classi Bulma per layout e componenti.
- Usa il sistema a colonne Bulma: .columns, .column, .is-*, .is-offset-*.
- Usa componenti Bulma: .button, .card, .tag, .notification, .box, .hero, .section, etc.
- Usa utility Bulma: has-text-centered, is-flex, is-justify-content-*, p-*, m-*, etc.
- INCLUDI un commento in cima: <!-- Bulma CSS CDN required -->
- Eventuali stili custom extra vanno in un tag <style> separato.`,
  },
  custom: {
    label: 'Custom',
    cdn: '',
    instructions: '',
  },
};

function buildSystemPrompt(stack: OutputStack, customInstructions?: string): string {
  const stackConfig = STACK_CONFIGS[stack];
  const stackBlock = stack === 'custom' && customInstructions
    ? customInstructions
    : stackConfig.instructions;

  return `Sei un esperto sviluppatore front-end specializzato in landing page e funnel di marketing.
Il tuo compito è RISCRIVERE una sezione HTML estratta da una pagina, rendendola COMPLETAMENTE STANDALONE e riutilizzabile.

STACK DI OUTPUT: ${stackConfig.label}
${stackBlock}

REGOLE GENERALI:
1. Restituisci SOLO il codice HTML della sezione riscritta, NIENTE altro testo, spiegazioni o markdown.
2. NON aggiungere backtick, \`\`\`html o blocchi di codice. Output puro HTML.
3. La sezione deve funzionare AUTONOMAMENTE come blocco HTML inseribile in qualsiasi pagina.
4. Mantieni il design visivo e la struttura originale il più fedelmente possibile.
5. Mantieni le immagini con URL assoluti.
6. Rimuovi script non necessari e event handler inline (onclick, etc.).
7. Mantieni i link (href) funzionali.
8. Assicurati che la sezione sia RESPONSIVE e si adatti a mobile/tablet/desktop.
9. Se la sezione contiene interattività (accordion, tabs, toggle), ricreala con JavaScript vanilla${stack === 'bootstrap' ? ' o Bootstrap JS' : ''}.
10. Il codice deve essere PULITO, ben indentato e pronto per la produzione.`;
}

function cleanAiOutput(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:html)?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?```\s*$/i, '');
  return cleaned.trim();
}

async function rewriteWithClaude(
  sectionHtml: string,
  systemPrompt: string,
  context?: string,
): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userPrompt = `Riscrivi questa sezione HTML per renderla completamente standalone e riutilizzabile con lo stack indicato.
${context ? `\nContesto sulla pagina di origine: ${context}` : ''}

SEZIONE HTML DA RISCRIVERE:
${sectionHtml}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const result = response.content[0].type === 'text' ? response.content[0].text : '';
  return cleanAiOutput(result);
}

async function rewriteWithGemini(
  sectionHtml: string,
  systemPrompt: string,
  context?: string,
): Promise<string> {
  const apiKey = (process.env.GOOGLE_GEMINI_API_KEY ?? '').trim();
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY not configured');

  const userPrompt = `Riscrivi questa sezione HTML per renderla completamente standalone e riutilizzabile con lo stack indicato.
${context ? `\nContesto sulla pagina di origine: ${context}` : ''}

SEZIONE HTML DA RISCRIVERE:
${sectionHtml}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: 32768, temperature: 0.7 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return cleanAiOutput(text);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      html: string;
      model?: 'claude' | 'gemini';
      context?: string;
      outputStack?: OutputStack;
      customStackInstructions?: string;
    };

    const { html, context, customStackInstructions } = body;

    if (!html || html.trim().length < 10) {
      return NextResponse.json({ error: 'HTML sezione mancante o troppo corto.' }, { status: 400 });
    }

    const useModel = body.model || 'claude';
    const stack: OutputStack = body.outputStack || 'pure_css';
    const systemPrompt = buildSystemPrompt(stack, customStackInstructions);

    let rewritten: string;

    if (useModel === 'gemini') {
      rewritten = await rewriteWithGemini(html, systemPrompt, context);
    } else {
      rewritten = await rewriteWithClaude(html, systemPrompt, context);
    }

    return NextResponse.json({
      success: true,
      html: rewritten,
      model: useModel,
      outputStack: stack,
      originalLength: html.length,
      rewrittenLength: rewritten.length,
    });
  } catch (error) {
    console.error('Rewrite section API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Errore sconosciuto' },
      { status: 500 }
    );
  }
}

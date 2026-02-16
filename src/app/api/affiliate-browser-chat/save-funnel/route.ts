import { NextRequest, NextResponse } from 'next/server';
import {
  createAffiliateSavedFunnel,
  fetchAffiliateBrowserChatByJobId,
} from '@/lib/supabase-operations';

// =====================================================
// Claude prompt per strutturare il risultato dell'agente
// =====================================================

const STRUCTURING_PROMPT = `Sei un esperto di marketing e funnel di vendita. Ti viene dato il risultato testuale di un agente browser che ha navigato e analizzato un funnel online (quiz funnel, sales funnel, landing page, ecc.).

Il tuo compito è ESTRARRE e STRUTTURARE tutte le informazioni in un oggetto JSON preciso.

Restituisci SOLO un oggetto JSON valido (senza markdown, senza blocchi di codice, senza commenti), con ESATTAMENTE queste chiavi:

{
  "funnel_name": "Nome descrittivo del funnel (es: 'Bioma Health Weight Loss Quiz Funnel')",
  "brand_name": "Nome del brand/azienda (es: 'Bioma Health') oppure null se non identificabile",
  "entry_url": "URL della prima pagina del funnel",
  "funnel_type": "UNO tra: quiz_funnel | sales_funnel | landing_page | webinar_funnel | tripwire_funnel | lead_magnet | vsl_funnel | other",
  "category": "UNO tra: weight_loss | supplements | skincare | fitness | finance | saas | ecommerce | health | education | dating | real_estate | crypto | other",
  "tags": ["array", "di", "tag", "rilevanti", "per", "questo", "funnel"],
  "total_steps": 19,
  "steps": [
    {
      "step_index": 1,
      "url": "https://esempio.com/step1",
      "title": "Titolo o domanda dello step",
      "step_type": "UNO tra: quiz_question | info_screen | lead_capture | checkout | upsell | downsell | thank_you | landing | product_page | processing | other",
      "input_type": "UNO tra: multiple_choice | checkbox | text_input | numeric_input | image_select | email_input | button | slider | date_picker | none",
      "options": ["Opzione 1", "Opzione 2"],
      "description": "Breve descrizione degli elementi visibili nella pagina",
      "cta_text": "Testo del pulsante/CTA principale oppure null"
    }
  ],
  "analysis_summary": "Paragrafo di analisi del funnel: struttura, punti di forza, strategia, user experience, lunghezza, engagement. Scrivi in italiano.",
  "persuasion_techniques": ["scarcity", "social_proof", "authority", "progress_bar", "personalization", "loss_aversion", "reciprocity", "commitment_consistency"],
  "lead_capture_method": "UNO tra: email | phone | form | social_login | none",
  "notable_elements": ["Barra di progresso X di Y", "Mix di tipi di input", "Domanda di segmentazione iniziale", "Schermata intermedia motivazionale"]
}

REGOLE IMPORTANTI:
- Estrai TUTTI gli step menzionati nel testo, anche se hanno formati diversi
- Se un'informazione non è disponibile, usa null per stringhe e [] per array
- Per funnel_type: se ci sono domande/quiz → quiz_funnel; se c'è una pagina di vendita → sales_funnel; ecc.
- Per category: deduci dal contenuto delle domande e del prodotto
- I tags devono essere specifici e utili per filtrare (es: "probiotics", "gut_health", "weight_loss", "quiz", "email_capture")
- L'analysis_summary deve essere un'analisi professionale di marketing in italiano (2-4 frasi)
- Identifica TUTTE le tecniche di persuasione usate nel funnel
- I notable_elements sono caratteristiche di design/UX notevoli del funnel`;

// =====================================================
// Helpers
// =====================================================

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

function ensureStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((x) => typeof x === 'string').map(String);
}

function ensureString(val: unknown, fallback: string | null = null): string | null {
  if (typeof val === 'string' && val.trim()) return val.trim();
  return fallback;
}

const VALID_FUNNEL_TYPES = [
  'quiz_funnel', 'sales_funnel', 'landing_page', 'webinar_funnel',
  'tripwire_funnel', 'lead_magnet', 'vsl_funnel', 'other',
];

const VALID_CATEGORIES = [
  'weight_loss', 'supplements', 'skincare', 'fitness', 'finance',
  'saas', 'ecommerce', 'health', 'education', 'dating',
  'real_estate', 'crypto', 'other',
];

// =====================================================
// API Route
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentResult, jobId, saveType } = body as {
      agentResult: string;
      jobId?: string;
      saveType?: 'quiz' | 'funnel';
    };

    if (!agentResult || agentResult.trim().length < 50) {
      return NextResponse.json(
        { success: false, error: 'agentResult is required and must contain enough data to analyze' },
        { status: 400 }
      );
    }

    // Get Anthropic API key
    const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Chiave mancante: aggiungi ANTHROPIC_API_KEY in .env.local e riavvia il server.',
        },
        { status: 400 }
      );
    }

    // Find the chat record if jobId provided
    let chatId: string | null = null;
    if (jobId) {
      const chat = await fetchAffiliateBrowserChatByJobId(jobId);
      chatId = chat?.id ?? null;
    }

    // Build the user message with context about what to save
    const saveContext = saveType === 'quiz'
      ? 'L\'utente vuole salvare questo come QUIZ FUNNEL. Classifica di conseguenza il funnel_type come "quiz_funnel" a meno che il contenuto non sia chiaramente diverso.'
      : saveType === 'funnel'
        ? 'L\'utente vuole salvare questo come FUNNEL DI VENDITA. Classifica il funnel_type in base al contenuto effettivo.'
        : 'Classifica il funnel_type in base al contenuto effettivo.';

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `${STRUCTURING_PROMPT}\n\n${saveContext}\n\n--- RISULTATO AGENTE BROWSER ---\n\n${agentResult}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json(
        { success: false, error: `Claude API error ${response.status}: ${err.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const claudeData = (await response.json()) as {
      content?: { type: string; text?: string }[];
    };
    const rawText = claudeData.content?.find((c) => c.type === 'text')?.text ?? '';

    if (!rawText) {
      return NextResponse.json(
        { success: false, error: 'Claude returned empty response' },
        { status: 502 }
      );
    }

    // Parse JSON from Claude response
    const parsed = parseJsonFromResponse(rawText);
    if (!parsed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not parse structured JSON from Claude response',
          rawResponse: rawText.slice(0, 500),
        },
        { status: 500 }
      );
    }

    // Normalize and validate the parsed data
    const funnelType = typeof parsed.funnel_type === 'string' && VALID_FUNNEL_TYPES.includes(parsed.funnel_type)
      ? parsed.funnel_type
      : 'other';

    const category = typeof parsed.category === 'string' && VALID_CATEGORIES.includes(parsed.category)
      ? parsed.category
      : 'other';

    const steps = Array.isArray(parsed.steps) ? parsed.steps : [];

    const funnelData = {
      chat_id: chatId,
      funnel_name: ensureString(parsed.funnel_name) ?? 'Funnel senza nome',
      brand_name: ensureString(parsed.brand_name),
      entry_url: ensureString(parsed.entry_url) ?? '',
      funnel_type: funnelType,
      category,
      tags: ensureStringArray(parsed.tags),
      total_steps: typeof parsed.total_steps === 'number' ? parsed.total_steps : steps.length,
      steps: steps as unknown as import('@/types/database').Json,
      analysis_summary: ensureString(parsed.analysis_summary),
      persuasion_techniques: ensureStringArray(parsed.persuasion_techniques),
      lead_capture_method: ensureString(parsed.lead_capture_method),
      notable_elements: ensureStringArray(parsed.notable_elements),
      raw_agent_result: agentResult,
    };

    // Save to Supabase
    const saved = await createAffiliateSavedFunnel(funnelData);

    return NextResponse.json({
      success: true,
      funnel: {
        id: saved.id,
        funnel_name: saved.funnel_name,
        brand_name: saved.brand_name,
        funnel_type: saved.funnel_type,
        category: saved.category,
        total_steps: saved.total_steps,
        tags: saved.tags,
        analysis_summary: saved.analysis_summary,
      },
      message: `Funnel "${saved.funnel_name}" salvato con successo come ${saved.funnel_type} (${saved.category})`,
    });
  } catch (error) {
    console.error('Save funnel error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save funnel',
      },
      { status: 500 }
    );
  }
}

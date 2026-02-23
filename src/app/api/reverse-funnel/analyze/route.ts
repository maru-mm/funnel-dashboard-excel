import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const MODEL = 'gpt-4.1';

const SYSTEM_PROMPT = `Sei un esperto mondiale di funnel marketing, direct response copywriting, persuasione e ingegneria dei funnel.
Il tuo compito è fare REVERSE ENGINEERING completo di un funnel.

Ti verranno forniti uno o più dei seguenti materiali:
- Dati strutturati di un funnel (JSON con step, URL, ecc.)
- Screenshot delle pagine del funnel (immagini)
- Documenti PDF con informazioni sul funnel
- Contenuto HTML/testo delle pagine web recuperato dai link
- Note aggiuntive dell'analista

Usa TUTTI i materiali disponibili per ricostruire e analizzare l'intero funnel in profondità.

Per ogni step del funnel che riesci a identificare, analizza:
1. **Meccanismo Unico (Unique Mechanism)**: Qual è l'elemento differenziante che rende questo step unico? Qual è la "big idea" o il "big promise"?
2. **Obiettivo dello Step**: Cosa vuole ottenere questo step nel percorso dell'utente?
3. **Trigger Psicologici**: Quali leve psicologiche vengono utilizzate (scarcity, urgency, social proof, authority, reciprocity, curiosity gap, ecc.)?
4. **Pattern di Copywriting**: Che framework di copy viene usato (PAS, AIDA, BAB, 4Ps, Star-Story-Solution, ecc.)?
5. **Hook & Angolo**: Qual è l'hook principale e l'angolo di attacco?
6. **Transizione al Prossimo Step**: Come viene guidato l'utente allo step successivo? Qual è il "bridge"?
7. **Elementi di Conversione**: CTA, form, bottoni — come sono strutturati per massimizzare la conversione?
8. **Obiezioni Gestite**: Quali obiezioni dell'utente vengono affrontate in questo step?

Inoltre, fornisci un'analisi globale del funnel:
- **Architettura del Funnel**: Il blueprint strategico complessivo
- **Customer Journey Map**: Il percorso emotivo dell'utente attraverso il funnel
- **Meccanismo Unico Globale**: Il Big Mechanism che differenzia l'intero funnel
- **Scoring di Efficacia**: Valutazione 1-10 di vari aspetti (copy, design, persuasione, flow, CTA)
- **Punti di Forza**: Cosa funziona eccezionalmente bene
- **Punti Deboli**: Dove il funnel potrebbe migliorare
- **Suggerimenti di Ottimizzazione**: Come potresti migliorare il funnel
- **Proposta Funnel Rigenerato**: Descrivi step-by-step come ricostruiresti/ottimizzeresti il funnel

Rispondi SOLO con un JSON valido (senza markdown, senza blocchi di codice) con questa struttura:

{
  "funnel_overview": {
    "funnel_architecture": "descrizione dell'architettura strategica",
    "global_unique_mechanism": "il meccanismo unico che differenzia l'intero funnel",
    "big_promise": "la grande promessa del funnel",
    "target_avatar": "avatar del cliente ideale",
    "awareness_level": "livello di consapevolezza del target (unaware, problem-aware, solution-aware, product-aware, most-aware)",
    "sophistication_level": "livello di sofisticazione del mercato (1-5 secondo Eugene Schwartz)",
    "customer_journey_emotions": ["emozione1", "emozione2", "emozione3"],
    "overall_effectiveness_score": 1-10,
    "copy_score": 1-10,
    "design_score": 1-10,
    "persuasion_score": 1-10,
    "flow_score": 1-10,
    "cta_score": 1-10,
    "strengths": ["punto di forza 1", "punto di forza 2"],
    "weaknesses": ["punto debole 1", "punto debole 2"],
    "optimization_suggestions": ["suggerimento 1", "suggerimento 2"]
  },
  "steps_analysis": [
    {
      "step_index": 1,
      "step_name": "nome/titolo dello step",
      "step_type": "tipo (landing, quiz_question, lead_capture, checkout, upsell, info_screen, thank_you, other)",
      "unique_mechanism": "il meccanismo unico di questo specifico step",
      "objective": "obiettivo principale dello step",
      "psychological_triggers": ["trigger1", "trigger2"],
      "copywriting_framework": "framework utilizzato",
      "hook": "hook principale",
      "angle": "angolo di attacco",
      "bridge_to_next": "come guida al prossimo step",
      "conversion_elements": {
        "primary_cta": "testo CTA principale",
        "cta_style": "stile/design della CTA",
        "secondary_ctas": ["CTA secondarie"],
        "form_elements": ["elementi del form se presenti"],
        "trust_signals": ["segnali di fiducia"]
      },
      "objections_handled": ["obiezione 1", "obiezione 2"],
      "micro_commitments": ["micro-impegno richiesto all'utente"],
      "emotional_state": {
        "entry_emotion": "emozione dell'utente quando entra nello step",
        "exit_emotion": "emozione dell'utente quando esce dallo step"
      },
      "effectiveness_notes": "note sull'efficacia di questo step"
    }
  ],
  "regenerated_funnel": {
    "concept": "concetto generale del funnel rigenerato/ottimizzato",
    "improvements_applied": ["miglioramento 1", "miglioramento 2"],
    "steps": [
      {
        "step_index": 1,
        "step_name": "nome dello step rigenerato",
        "step_type": "tipo",
        "headline": "headline proposta",
        "subheadline": "subheadline proposta",
        "body_copy": "riassunto del body copy proposto",
        "cta_text": "testo CTA proposto",
        "key_elements": ["elemento 1", "elemento 2"],
        "why_improved": "perché questo step è migliore dell'originale"
      }
    ]
  }
}`;

interface MaterialFile {
  data: string;
  name: string;
}

interface Materials {
  links?: string[];
  images?: MaterialFile[];
  documents?: MaterialFile[];
  notes?: string;
  funnelName?: string;
}

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

async function fetchUrlContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#\d+;/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return text.substring(0, 10000);
  } catch (e) {
    return `[Errore nel recuperare ${url}: ${e instanceof Error ? e.message : 'errore sconosciuto'}]`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { funnel, materials } = body as {
      funnel?: Record<string, unknown>;
      materials?: Materials;
    };

    if (!funnel && !materials) {
      return NextResponse.json(
        { error: 'Fornisci un funnel salvato o carica materiali per l\'analisi' },
        { status: 400 }
      );
    }

    const apiKey = (process.env.OPENAI_API_KEY ?? '').trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY non configurata. Aggiungi la chiave in .env.local e riavvia il server.' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentParts: any[] = [];
    let contextText = '';

    if (funnel) {
      contextText += `\n\n## DATI FUNNEL SALVATO:\n${JSON.stringify(funnel, null, 2)}`;
    }

    if (materials) {
      if (materials.funnelName) {
        contextText += `\n\n## NOME FUNNEL: ${materials.funnelName}`;
      }

      if (materials.links && materials.links.length > 0) {
        contextText += '\n\n## CONTENUTO PAGINE WEB RECUPERATO:';
        const urlResults = await Promise.all(
          materials.links.map(async (link) => {
            const content = await fetchUrlContent(link);
            return `\n\n### URL: ${link}\n${content}`;
          })
        );
        contextText += urlResults.join('');
      }

      if (materials.notes) {
        contextText += `\n\n## NOTE AGGIUNTIVE DELL'ANALISTA:\n${materials.notes}`;
      }
    }

    contentParts.push({
      type: 'text',
      text: `Analizza questo funnel e fai il reverse engineering completo basandoti su tutti i materiali forniti. Identifica ogni step, analizzalo in profondità, e proponi una versione rigenerata/ottimizzata.\n${contextText}`,
    });

    if (materials?.images && materials.images.length > 0) {
      for (const img of materials.images) {
        contentParts.push({
          type: 'image_url',
          image_url: { url: img.data, detail: 'high' as const },
        });
      }
    }

    if (materials?.documents && materials.documents.length > 0) {
      for (const doc of materials.documents) {
        try {
          contentParts.push({
            type: 'file',
            file: {
              filename: doc.name,
              file_data: doc.data,
            },
          });
        } catch {
          contextText += `\n\n[Documento "${doc.name}" caricato ma non processabile direttamente. Usa screenshot per migliori risultati.]`;
        }
      }
    }

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: contentParts },
      ],
      temperature: 0.4,
      max_tokens: 16384,
      response_format: { type: 'json_object' },
    });

    const rawText = completion.choices[0]?.message?.content ?? '';
    const analysis = parseJsonResponse(rawText);

    return NextResponse.json({
      success: true,
      analysis: analysis ?? rawText,
      analysisRaw: !analysis ? rawText : undefined,
      usage: completion.usage,
      model: MODEL,
    });
  } catch (error) {
    console.error('[reverse-funnel/analyze] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Errore durante l\'analisi reverse funnel',
      },
      { status: 500 }
    );
  }
}

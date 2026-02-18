import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `Sei un esperto mondiale di funnel marketing, direct response copywriting, persuasione e ingegneria dei funnel.
Il tuo compito è fare REVERSE ENGINEERING completo di un funnel analizzando ogni singolo step.

Per ogni step del funnel, devi identificare:
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

Rispondi SOLO con un JSON valido (senza markdown, senza blocchi di codice) con questa struttura:

{
  "funnel_overview": {
    "funnel_architecture": "descrizione dell'architettura strategica",
    "global_unique_mechanism": "il meccanismo unico che differenzia l'intero funnel",
    "big_promise": "la grande promessa del funnel",
    "target_avatar": "avatar del cliente ideale",
    "awareness_level": "livello di consapevolezza del target (unaware, problem-aware, solution-aware, product-aware, most-aware)",
    "sophistication_level": "livello di sofisticazione del mercato (1-5 secondo Eugene Schwartz)",
    "customer_journey_emotions": ["emozione1 → emozione2 → emozione3..."],
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
      "step_type": "tipo (landing, quiz_question, lead_capture, checkout, upsell, ecc.)",
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
  ]
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
  try {
    const body = await request.json();
    const { funnel } = body as { funnel: Record<string, unknown> };

    if (!funnel) {
      return NextResponse.json(
        { error: 'Il campo "funnel" è obbligatorio' },
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

    const funnelContext = JSON.stringify(funnel, null, 2);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analizza questo funnel e fai il reverse engineering completo:\n\n${funnelContext}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
    });

    const rawText = completion.choices[0]?.message?.content ?? '';
    const analysis = parseJsonResponse(rawText);

    return NextResponse.json({
      success: true,
      analysis: analysis ?? rawText,
      analysisRaw: !analysis ? rawText : undefined,
      usage: completion.usage,
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

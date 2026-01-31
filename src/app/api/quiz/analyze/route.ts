import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url, name } = await request.json();

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL è richiesto' },
        { status: 400 }
      );
    }

    // Fetch della pagina quiz per estrarre contenuti
    const pageResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; QuizAnalyzer/1.0)',
      },
    });

    if (!pageResponse.ok) {
      return NextResponse.json(
        { success: false, error: `Impossibile caricare la pagina: ${pageResponse.status}` },
        { status: 400 }
      );
    }

    const html = await pageResponse.text();
    const contentLength = html.length;

    // Estrai elementi specifici del quiz dalla pagina
    const extractedElements = {
      forms: (html.match(/<form[^>]*>[\s\S]*?<\/form>/gi) || []).length,
      radioInputs: (html.match(/<input[^>]*type="radio"[^>]*>/gi) || []).length,
      checkboxInputs: (html.match(/<input[^>]*type="checkbox"[^>]*>/gi) || []).length,
      buttons: (html.match(/<button[^>]*>[\s\S]*?<\/button>/gi) || []).length,
      progressBars: (html.match(/progress|step|indicator/gi) || []).length,
      questions: (html.match(/<h[1-6][^>]*>.*\?<\/h[1-6]>/gi) || []).length,
      images: (html.match(/<img[^>]*>/gi) || []).length,
    };

    // Estrai testi delle domande
    const questionTexts: string[] = [];
    const questionMatches = html.match(/<h[1-6][^>]*>([^<]*\?)[^<]*<\/h[1-6]>/gi) || [];
    questionMatches.forEach((match) => {
      const text = match.replace(/<[^>]*>/g, '').trim();
      if (text.length > 5 && text.length < 300) {
        questionTexts.push(text);
      }
    });

    // Estrai opzioni di risposta
    const optionTexts: string[] = [];
    const labelMatches = html.match(/<label[^>]*>([\s\S]*?)<\/label>/gi) || [];
    labelMatches.forEach((match) => {
      const text = match.replace(/<[^>]*>/g, '').trim();
      if (text.length > 2 && text.length < 200) {
        optionTexts.push(text);
      }
    });

    // Estrai CTA finali
    const ctaElements: string[] = [];
    const ctaMatches = html.match(/<(button|a)[^>]*class="[^"]*(?:btn|cta|submit|next)[^"]*"[^>]*>([\s\S]*?)<\/(button|a)>/gi) || [];
    ctaMatches.forEach((match) => {
      const text = match.replace(/<[^>]*>/g, '').trim();
      if (text && text.length < 100) {
        ctaElements.push(text);
      }
    });

    // Costruisci il prompt per l'analisi AI del quiz
    const prompt = `Sei un esperto di Quiz Funnel Marketing. Analizza in dettaglio questo quiz funnel:

NOME TEMPLATE: ${name || 'Quiz Template'}
URL: ${url}

ELEMENTI ESTRATTI:
- Numero form rilevati: ${extractedElements.forms}
- Input radio (scelta singola): ${extractedElements.radioInputs}
- Input checkbox (scelta multipla): ${extractedElements.checkboxInputs}
- Bottoni: ${extractedElements.buttons}
- Elementi progress/step: ${extractedElements.progressBars}
- Domande con "?" rilevate: ${extractedElements.questions}
- Immagini: ${extractedElements.images}
- Lunghezza contenuto HTML: ${contentLength} caratteri

DOMANDE ESTRATTE:
${questionTexts.slice(0, 10).map((q, i) => `${i + 1}. ${q}`).join('\n') || 'Nessuna domanda trovata con "?"'}

OPZIONI DI RISPOSTA SAMPLE:
${optionTexts.slice(0, 15).map((o, i) => `- ${o}`).join('\n') || 'Nessuna opzione trovata'}

CTA/BOTTONI:
${ctaElements.slice(0, 10).map((c) => `- "${c}"`).join('\n') || 'Nessun CTA trovato'}

Fornisci un'analisi strutturata JSON con questi campi:
{
  "totalQuestions": <numero stimato di domande nel quiz>,
  "questionTypes": [<lista dei tipi di domande: "multiple_choice", "single_choice", "scale", "open_text", "image_selection", etc>],
  "flowStructure": "<descrizione del flusso del quiz: lineare, ramificato, condizionale, etc>",
  "resultsLogic": "<come vengono calcolati/mostrati i risultati: score-based, personality-based, product-recommendation, etc>",
  "designPatterns": [<pattern di design utilizzati: progress bar, step counter, animations, etc>],
  "ctaElements": [<elementi CTA principali e loro posizionamento>],
  "engagementTechniques": [<tecniche di engagement: gamification, personalization, urgency, social proof, etc>],
  "recommendations": [<5-7 suggerimenti specifici per replicare o migliorare questo quiz>],
  "rawAnalysis": "<analisi completa in formato narrativo di 200-300 parole>"
}

IMPORTANTE: Rispondi SOLO con il JSON valido, senza markdown o testo aggiuntivo.`;

    // Chiama l'API agent per analisi approfondita
    const analyzerResponse = await fetch(
      'https://claude-code-agents.fly.dev/api/agent/run/copy_analyzer',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      }
    );

    if (!analyzerResponse.ok) {
      return NextResponse.json(
        { success: false, error: `Errore API analyzer: ${analyzerResponse.status}` },
        { status: 500 }
      );
    }

    const analysisResult = await analyzerResponse.json();

    // Prova a parsare la risposta JSON dall'AI
    let parsedAnalysis = {
      totalQuestions: extractedElements.questions || Math.max(extractedElements.radioInputs / 3, 1),
      questionTypes: ['multiple_choice'],
      flowStructure: 'Lineare',
      resultsLogic: 'Score-based',
      designPatterns: extractedElements.progressBars > 0 ? ['progress bar'] : [],
      ctaElements: ctaElements.slice(0, 5),
      engagementTechniques: [],
      recommendations: [],
      rawAnalysis: '',
    };

    try {
      // L'API restituisce un oggetto con un campo response o result
      const aiResponse = analysisResult.response || analysisResult.result || analysisResult.output || '';
      
      // Cerca JSON nella risposta
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        parsedAnalysis = {
          ...parsedAnalysis,
          ...parsed,
        };
      } else {
        parsedAnalysis.rawAnalysis = aiResponse;
      }
    } catch {
      // Se non riesce a parsare, usa rawAnalysis
      parsedAnalysis.rawAnalysis = JSON.stringify(analysisResult);
    }

    return NextResponse.json({
      success: true,
      url,
      name,
      extractedElements,
      questionTexts: questionTexts.slice(0, 10),
      optionSamples: optionTexts.slice(0, 15),
      analysis: parsedAnalysis,
    });
  } catch (error) {
    console.error('Errore durante l\'analisi del quiz:', error);
    return NextResponse.json(
      { success: false, error: 'Errore durante l\'analisi del quiz' },
      { status: 500 }
    );
  }
}

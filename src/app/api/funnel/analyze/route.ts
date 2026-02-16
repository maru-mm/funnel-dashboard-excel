import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url, pageType, template } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL è richiesto' },
        { status: 400 }
      );
    }

    // Fetch della pagina per estrarre contenuti
    const pageResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FunnelAnalyzer/1.0)',
      },
    });

    if (!pageResponse.ok) {
      return NextResponse.json(
        { error: `Impossibile caricare la pagina: ${pageResponse.status}` },
        { status: 400 }
      );
    }

    const html = await pageResponse.text();

    // Estrai elementi chiave dalla pagina
    const extractedData: {
      headline: string;
      subheadline: string;
      cta: string[];
      price: string | null;
      benefits: string[];
    } = {
      headline: '',
      subheadline: '',
      cta: [],
      price: null,
      benefits: [],
    };

    // Estrai headline (h1)
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi);
    if (h1Match && h1Match.length > 0) {
      extractedData.headline = h1Match[0].replace(/<[^>]*>/g, '').trim();
    }

    // Estrai subheadline (primo h2 o primo p dopo h1)
    const h2Match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (h2Match) {
      extractedData.subheadline = h2Match[1].replace(/<[^>]*>/g, '').trim();
    }

    // Estrai CTA (bottoni)
    const buttonMatches = html.match(/<button[^>]*>([\s\S]*?)<\/button>/gi) || [];
    const linkButtonMatches = html.match(/<a[^>]*class="[^"]*btn[^"]*"[^>]*>([\s\S]*?)<\/a>/gi) || [];
    
    [...buttonMatches, ...linkButtonMatches].forEach((btn) => {
      const text = btn.replace(/<[^>]*>/g, '').trim();
      if (text && text.length < 50 && !extractedData.cta.includes(text)) {
        extractedData.cta.push(text);
      }
    });

    // Estrai prezzi
    const priceMatch = html.match(/[€$£]\s*\d+[.,]?\d*/);
    if (priceMatch) {
      extractedData.price = priceMatch[0];
    }

    // Estrai benefici (li dentro ul)
    const liMatches = html.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
    liMatches.slice(0, 10).forEach((li) => {
      const text = li.replace(/<[^>]*>/g, '').trim();
      if (text && text.length > 10 && text.length < 200) {
        extractedData.benefits.push(text);
      }
    });

    // Costruisci il prompt per l'analisi
    const prompt = `Analizza questo step del funnel (${pageType || 'landing page'}, template: ${template || 'standard'}):

HEADLINE: ${extractedData.headline || 'Non trovata'}

SUBHEADLINE: ${extractedData.subheadline || 'Non trovata'}

CTA BUTTONS: ${extractedData.cta.join(', ') || 'Non trovati'}

PREZZO: ${extractedData.price || 'Non trovato'}

BENEFICI/PUNTI CHIAVE:
${extractedData.benefits.slice(0, 5).map((b, i) => `${i + 1}. ${b}`).join('\n') || 'Non trovati'}

Fornisci un'analisi dettagliata includendo:
1. Valutazione della headline (punteggio 1-10 e suggerimenti)
2. Efficacia del CTA
3. Struttura del copy
4. Punti di forza
5. Aree di miglioramento
6. Suggerimenti specifici per ottimizzare la conversione`;

    // Chiama l'API copy_analyzer (timeout 30s)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let analyzerResponse: Response;
    try {
      analyzerResponse = await fetch(
        'https://claude-code-agents.fly.dev/api/agent/run/copy_analyzer',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
          signal: controller.signal,
        }
      );
    } catch (fetchErr) {
      clearTimeout(timeout);
      const msg = fetchErr instanceof Error ? fetchErr.message : 'Errore';
      if (msg.includes('abort')) {
        return NextResponse.json(
          { error: 'Timeout: l\'API copy_analyzer esterna non ha risposto in 30 secondi' },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { error: `Impossibile raggiungere copy_analyzer: ${msg}` },
        { status: 503 }
      );
    }
    clearTimeout(timeout);

    if (!analyzerResponse.ok) {
      return NextResponse.json(
        { error: `Errore API analyzer: ${analyzerResponse.status}` },
        { status: 500 }
      );
    }

    const analysisResult = await analyzerResponse.json();

    return NextResponse.json({
      url,
      pageType,
      template,
      extractedData,
      analysis: analysisResult,
    });
  } catch (error) {
    console.error('Errore durante l\'analisi del funnel:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'analisi del funnel' },
      { status: 500 }
    );
  }
}

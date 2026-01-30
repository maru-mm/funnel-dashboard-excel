import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL è richiesto' },
        { status: 400 }
      );
    }

    // Fetch della pagina per estrarre la headline
    const pageResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HeadlineAnalyzer/1.0)',
      },
    });

    if (!pageResponse.ok) {
      return NextResponse.json(
        { error: `Impossibile caricare la pagina: ${pageResponse.status}` },
        { status: 400 }
      );
    }

    const html = await pageResponse.text();

    // Estrai la headline dalla pagina
    let headline = '';

    // Prova prima con h1
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      headline = h1Match[1].replace(/<[^>]*>/g, '').trim();
    }

    // Se non c'è h1, prova con il title
    if (!headline) {
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) {
        headline = titleMatch[1].replace(/<[^>]*>/g, '').trim();
      }
    }

    // Prova anche con og:title
    if (!headline) {
      const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
      if (ogTitleMatch) {
        headline = ogTitleMatch[1].trim();
      }
    }

    if (!headline) {
      return NextResponse.json(
        { error: 'Nessuna headline trovata nella pagina' },
        { status: 400 }
      );
    }

    // Chiama l'API copy_analyzer
    const analyzerResponse = await fetch(
      'https://claude-code-agents.fly.dev/api/agent/run/copy_analyzer',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Analizza questa headline: ${headline}`,
        }),
      }
    );

    if (!analyzerResponse.ok) {
      return NextResponse.json(
        { error: `Errore API copy_analyzer: ${analyzerResponse.status}` },
        { status: 500 }
      );
    }

    const analysisResult = await analyzerResponse.json();

    return NextResponse.json({
      headline,
      url,
      analysis: analysisResult,
    });
  } catch (error) {
    console.error('Errore durante l\'analisi:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'analisi della pagina' },
      { status: 500 }
    );
  }
}

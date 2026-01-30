import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url, targetProduct, adaptationStyle } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL è richiesto' },
        { status: 400 }
      );
    }

    // Chiama l'API di clonazione
    const cloneUrl = `https://claude-code-agents.fly.dev/api/landing/clone?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(cloneUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json,text/html',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Errore durante la clonazione: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const responseText = await response.text();
    
    // Prova a parsare come JSON (l'API restituisce {url, html})
    try {
      const jsonData = JSON.parse(responseText);
      
      // Se contiene html, lo estrae
      if (jsonData.html) {
        return NextResponse.json({
          success: true,
          url: jsonData.url || url,
          type: 'html',
          html: jsonData.html,
          targetProduct,
          adaptationStyle,
        });
      }
      
      // Altrimenti restituisce tutto il JSON
      return NextResponse.json({
        success: true,
        url,
        type: 'json',
        data: jsonData,
      });
    } catch {
      // Se non è JSON, è HTML diretto
      return NextResponse.json({
        success: true,
        url,
        type: 'html',
        html: responseText,
        targetProduct,
        adaptationStyle,
      });
    }
  } catch (error) {
    console.error('Errore durante la clonazione:', error);
    return NextResponse.json(
      { error: 'Errore durante la clonazione della pagina' },
      { status: 500 }
    );
  }
}

// Endpoint per swipe/adattamento
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { source_url, target_product, adaptation_style } = body;

    if (!source_url) {
      return NextResponse.json(
        { error: 'source_url è richiesto' },
        { status: 400 }
      );
    }

    // Chiama l'API di swipe
    const response = await fetch(
      'https://claude-code-agents.fly.dev/api/funnel/swipe',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_url,
          target_product,
          adaptation_style,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Errore durante lo swipe: ${response.status}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Errore durante lo swipe:', error);
    return NextResponse.json(
      { error: 'Errore durante lo swipe della pagina' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function extractPageContent(html: string) {
  // Remove script and style tags
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // Extract headline (h1)
  let headline = '';
  const h1Match = cleaned.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    headline = h1Match[1].replace(/<[^>]*>/g, '').trim();
  }

  // Extract sub-headlines (h2)
  const subHeadlines: string[] = [];
  const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let h2Match;
  while ((h2Match = h2Regex.exec(cleaned)) !== null) {
    const text = h2Match[1].replace(/<[^>]*>/g, '').trim();
    if (text) subHeadlines.push(text);
  }

  // Extract h3s
  const h3s: string[] = [];
  const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  let h3Match;
  while ((h3Match = h3Regex.exec(cleaned)) !== null) {
    const text = h3Match[1].replace(/<[^>]*>/g, '').trim();
    if (text) h3s.push(text);
  }

  // Extract meta description
  let metaDescription = '';
  const metaMatch = cleaned.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  if (metaMatch) {
    metaDescription = metaMatch[1].trim();
  }

  // Extract title
  let title = '';
  const titleMatch = cleaned.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
  }

  // Extract CTA buttons text
  const ctaTexts: string[] = [];
  const buttonRegex = /<button[^>]*>([\s\S]*?)<\/button>/gi;
  let btnMatch;
  while ((btnMatch = buttonRegex.exec(cleaned)) !== null) {
    const text = btnMatch[1].replace(/<[^>]*>/g, '').trim();
    if (text && text.length < 100) ctaTexts.push(text);
  }
  // Also check for <a> tags with common CTA classes
  const ctaLinkRegex = /<a[^>]*class="[^"]*(?:btn|button|cta)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let ctaMatch;
  while ((ctaMatch = ctaLinkRegex.exec(cleaned)) !== null) {
    const text = ctaMatch[1].replace(/<[^>]*>/g, '').trim();
    if (text && text.length < 100) ctaTexts.push(text);
  }

  // Extract all visible text (limited to avoid token overflow)
  const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let bodyText = '';
  if (bodyMatch) {
    bodyText = bodyMatch[1]
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } else {
    bodyText = cleaned
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Limit body text to ~4000 chars to stay within token limits
  if (bodyText.length > 4000) {
    bodyText = bodyText.substring(0, 4000) + '...';
  }

  return {
    title,
    headline: headline || title,
    subHeadlines: subHeadlines.slice(0, 10),
    h3s: h3s.slice(0, 10),
    metaDescription,
    ctaTexts: Array.from(new Set(ctaTexts)).slice(0, 10),
    bodyText,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL è richiesto' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY non configurata nel server' },
        { status: 500 }
      );
    }

    // Fetch the page
    const pageResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
      },
      redirect: 'follow',
    });

    if (!pageResponse.ok) {
      return NextResponse.json(
        { error: `Impossibile caricare la pagina: ${pageResponse.status} ${pageResponse.statusText}` },
        { status: 400 }
      );
    }

    const html = await pageResponse.text();
    const pageContent = extractPageContent(html);

    if (!pageContent.bodyText && !pageContent.headline) {
      return NextResponse.json(
        { error: 'Nessun contenuto testuale trovato nella pagina' },
        { status: 400 }
      );
    }

    // Build the prompt for Claude
    const analysisPrompt = `Sei un esperto di copywriting e marketing diretto. Analizza la seguente landing page e fornisci un'analisi dettagliata.

**URL:** ${url}

**Titolo pagina:** ${pageContent.title || 'N/A'}

**Headline principale (H1):** ${pageContent.headline || 'Non trovata'}

**Sub-headlines (H2):**
${pageContent.subHeadlines.length > 0 ? pageContent.subHeadlines.map((h, i) => `${i + 1}. ${h}`).join('\n') : 'Nessuna trovata'}

**H3:**
${pageContent.h3s.length > 0 ? pageContent.h3s.map((h, i) => `${i + 1}. ${h}`).join('\n') : 'Nessuna trovata'}

**Meta Description:** ${pageContent.metaDescription || 'N/A'}

**Testi CTA (bottoni):**
${pageContent.ctaTexts.length > 0 ? pageContent.ctaTexts.map((c, i) => `${i + 1}. "${c}"`).join('\n') : 'Nessuno trovato'}

**Testo visibile della pagina:**
${pageContent.bodyText}

---

Fornisci un'analisi strutturata con i seguenti punti:

1. **Punteggio Generale** (da 1 a 10): Valuta la qualità complessiva del copy.

2. **Headline Analysis**: 
   - La headline è chiara e comprensibile?
   - Comunica un beneficio specifico?
   - Crea urgenza o curiosità?
   - Suggerimenti per migliorarla

3. **Proposta di Valore**: 
   - La proposta di valore è chiara?
   - Si differenzia dalla concorrenza?

4. **CTA (Call to Action)**:
   - I CTA sono chiari e persuasivi?
   - Suggerimenti per migliorarli

5. **Struttura del Copy**:
   - Il flusso logico è efficace?
   - La gerarchia delle informazioni è corretta?

6. **Persuasion Techniques**:
   - Quali tecniche di persuasione vengono usate? (social proof, scarcity, authority, ecc.)
   - Quali mancano e potrebbero essere aggiunte?

7. **Punti di Forza**: Lista dei punti migliori del copy

8. **Aree di Miglioramento**: Lista dei punti deboli con suggerimenti concreti

9. **3 Headline Alternative**: Proponi 3 headline alternative potenzialmente più efficaci

Rispondi in italiano.`;

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
    });

    // Extract text from response
    const analysisText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => {
        if (block.type === 'text') return block.text;
        return '';
      })
      .join('\n');

    return NextResponse.json({
      headline: pageContent.headline,
      url,
      pageContent: {
        title: pageContent.title,
        subHeadlines: pageContent.subHeadlines,
        ctaTexts: pageContent.ctaTexts,
        metaDescription: pageContent.metaDescription,
      },
      analysis: {
        status: 'completed',
        result: analysisText,
        model: message.model,
        usage: message.usage,
      },
    });
  } catch (error) {
    console.error('Errore durante l\'analisi:', error);
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
    return NextResponse.json(
      { error: `Errore durante l'analisi della pagina: ${errorMessage}` },
      { status: 500 }
    );
  }
}

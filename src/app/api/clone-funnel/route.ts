import { NextRequest, NextResponse } from 'next/server';
import { chromium, type Browser } from 'playwright';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Reusable browser instance (avoid cold start on every request)
let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }
  browserInstance = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  return browserInstance;
}

// Clone a page using Playwright headless browser - renders JS, captures full DOM + CSS
async function cloneWithBrowser(url: string): Promise<{
  html: string;
  title: string;
  renderedSize: number;
  cssCount: number;
  imgCount: number;
  isJsRendered: boolean;
}> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  try {
    // Navigate: use 'load' (more reliable than 'networkidle' which hangs on analytics/websockets)
    // then wait extra time for JS rendering to complete
    await page.goto(url, {
      waitUntil: 'load',
      timeout: 20000,
    });

    // Wait for JS rendering to complete
    await page.waitForTimeout(3000);

    // Scroll down to trigger lazy loading, then back to top
    await page.evaluate(async () => {
      const scrollStep = window.innerHeight;
      const maxScroll = document.body.scrollHeight;
      for (let y = 0; y < maxScroll; y += scrollStep) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 200));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1500);

    // Extract the FULL rendered page with all CSS inlined
    const result = await page.evaluate((pageUrl: string) => {
      const origin = new URL(pageUrl).origin;
      const pathDir = pageUrl.substring(0, pageUrl.lastIndexOf('/') + 1) || origin + '/';

      // Resolve relative URL to absolute
      function abs(relative: string): string {
        if (!relative || relative.startsWith('data:') || relative.startsWith('blob:') || 
            relative.startsWith('#') || relative.startsWith('mailto:') || relative.startsWith('tel:') ||
            relative.startsWith('javascript:')) return relative;
        if (relative.startsWith('http://') || relative.startsWith('https://')) return relative;
        try { return new URL(relative, pageUrl).href; } catch { return relative; }
      }

      // 1. Collect ALL CSS (inline + external computed styles)
      const allCss: string[] = [];
      
      // Get all loaded stylesheets content
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          let cssText = rules.map(r => r.cssText).join('\n');
          
          // Fix relative URLs in CSS
          cssText = cssText.replace(/url\(\s*["']?(?!data:|https?:|blob:)([^"')]+)["']?\s*\)/gi, (_m: string, u: string) => {
            const baseUrl = sheet.href || pageUrl;
            try {
              return `url("${new URL(u.trim(), baseUrl).href}")`;
            } catch {
              return `url("${u}")`;
            }
          });
          
          if (cssText.trim()) {
            const source = sheet.href ? `/* From: ${sheet.href.substring(0, 120)} */\n` : '';
            allCss.push(source + cssText);
          }
        } catch (e) {
          // CORS: can't read cross-origin stylesheet rules, keep the <link> tag
          if (sheet.href) {
            allCss.push(`/* CORS blocked: ${sheet.href} - keeping <link> tag */`);
          }
        }
      }

      // 2. Get the rendered DOM
      const docClone = document.documentElement.cloneNode(true) as HTMLElement;

      // 3. Remove all <script> tags
      docClone.querySelectorAll('script').forEach(s => s.remove());
      
      // 4. Remove inline event handlers
      docClone.querySelectorAll('*').forEach(el => {
        const attrs = Array.from(el.attributes);
        attrs.forEach(attr => {
          if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
        });
      });

      // 5. Remove <link rel="stylesheet"> tags (CSS is now inlined)
      const corsBlockedLinks: string[] = [];
      docClone.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        const href = link.getAttribute('href');
        // Check if this stylesheet was CORS blocked (keep the link tag)
        const wasCorsBlocked = allCss.some(c => c.includes('CORS blocked') && href && c.includes(href));
        if (wasCorsBlocked && href) {
          // Keep the link but make URL absolute
          link.setAttribute('href', abs(href));
          corsBlockedLinks.push(href);
        } else {
          link.remove();
        }
      });

      // 6. Fix all URLs to absolute
      const urlAttrs: Record<string, string[]> = {
        'img': ['src', 'data-src', 'data-lazy-src', 'data-original'],
        'source': ['src', 'srcset'],
        'video': ['src', 'poster'],
        'audio': ['src'],
        'a': ['href'],
        'link': ['href'],
        'form': ['action'],
        'iframe': ['src'],
        'picture source': ['srcset'],
      };

      // Fix src, href, poster, data-src on ALL elements
      docClone.querySelectorAll('[src],[href],[poster],[data-src],[data-lazy-src],[data-original],[data-bg],[srcset],[action]').forEach(el => {
        ['src', 'href', 'poster', 'data-src', 'data-lazy-src', 'data-original', 'data-bg', 'action'].forEach(attr => {
          const val = el.getAttribute(attr);
          if (val && !val.startsWith('data:') && !val.startsWith('blob:') && !val.startsWith('#') && !val.startsWith('mailto:') && !val.startsWith('tel:')) {
            el.setAttribute(attr, abs(val));
          }
        });
        // Fix srcset
        const srcset = el.getAttribute('srcset');
        if (srcset) {
          const fixed = srcset.split(',').map((entry: string) => {
            const parts = entry.trim().split(/\s+/);
            if (parts[0]) parts[0] = abs(parts[0]);
            return parts.join(' ');
          }).join(', ');
          el.setAttribute('srcset', fixed);
        }
      });

      // 7. Fix background-image in inline styles
      docClone.querySelectorAll('[style]').forEach(el => {
        const style = el.getAttribute('style') || '';
        if (style.includes('url(')) {
          const fixed = style.replace(/url\(\s*["']?(?!data:|https?:|blob:)([^"')]+)["']?\s*\)/gi, (_m: string, u: string) => {
            return `url("${abs(u.trim())}")`;
          });
          el.setAttribute('style', fixed);
        }
      });

      // 8. Build final HTML with inlined CSS
      const head = docClone.querySelector('head');
      if (head) {
        // Remove existing <style> tags (we'll add consolidated ones)
        head.querySelectorAll('style').forEach(s => s.remove());
        
        // Add consolidated CSS
        if (allCss.length > 0) {
          const styleEl = document.createElement('style');
          styleEl.textContent = allCss.filter(c => !c.includes('CORS blocked')).join('\n\n');
          // Insert at the beginning of head (after meta charset if present)
          const firstChild = head.querySelector('meta[charset]')?.nextSibling || head.firstChild;
          if (firstChild) {
            head.insertBefore(styleEl, firstChild);
          } else {
            head.appendChild(styleEl);
          }
        }
      }

      // Also preserve <style> tags from body (some pages put CSS there)
      // These are already in the cloned DOM

      const finalHtml = '<!DOCTYPE html>\n' + docClone.outerHTML;
      
      return {
        html: finalHtml,
        title: document.title || '',
        cssCount: allCss.length,
        imgCount: docClone.querySelectorAll('img').length,
        corsLinks: corsBlockedLinks,
      };
    }, url);

    const rawHtmlSize = (await page.content()).length;

    return {
      html: result.html,
      title: result.title,
      renderedSize: result.html.length,
      cssCount: result.cssCount,
      imgCount: result.imgCount,
      isJsRendered: false, // If we got here with Playwright, it's rendered
    };
  } finally {
    await context.close();
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cloneMode, url } = body;

    // IDENTICAL MODE: use Playwright headless browser for full page rendering
    if (cloneMode === 'identical' && url) {
      console.log(`🔄 Clone IDENTICAL con Playwright: ${url}`);

      try {
        const result = await cloneWithBrowser(url);
        
        console.log(`✅ Clone completato: ${result.renderedSize.toLocaleString()} chars, ${result.cssCount} CSS, ${result.imgCount} immagini`);

        return NextResponse.json({
          success: true,
          content: result.html,
          format: 'html',
          mode: 'identical',
          originalSize: result.renderedSize,
          finalSize: result.html.length,
          cssInlined: true,
          cssCount: result.cssCount,
          imgCount: result.imgCount,
          jsRendered: false,
          title: result.title,
        });
      } catch (playwrightErr) {
        console.error('❌ Playwright error:', playwrightErr);
        
        // Fallback: simple fetch if Playwright fails
        console.log('⚠️ Fallback a fetch semplice...');
        try {
          const htmlResponse = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(15000),
          });

          if (!htmlResponse.ok) {
            return NextResponse.json(
              { error: `Errore scaricamento: HTTP ${htmlResponse.status}` },
              { status: 502 }
            );
          }

          const fallbackHTML = await htmlResponse.text();
          return NextResponse.json({
            success: true,
            content: fallbackHTML,
            format: 'html',
            mode: 'identical',
            originalSize: fallbackHTML.length,
            finalSize: fallbackHTML.length,
            cssInlined: false,
            jsRendered: true,
            warning: 'Rendering browser non disponibile. HTML scaricato senza rendering JS - potrebbe essere incompleto.',
          });
        } catch (fetchErr) {
          return NextResponse.json(
            { error: `Impossibile clonare la pagina: ${fetchErr instanceof Error ? fetchErr.message : 'errore sconosciuto'}` },
            { status: 502 }
          );
        }
      }
    }

    // REWRITE EXTRACT PHASE: render with Playwright first, then send rendered HTML to Edge Function
    if (cloneMode === 'rewrite' && body.phase === 'extract' && url) {
      console.log(`🔄 Rewrite EXTRACT con Playwright: ${url}`);

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return NextResponse.json(
          { error: 'Supabase non configurato.' },
          { status: 500 }
        );
      }

      try {
        // Step 1: Render the page with Playwright to get full DOM
        const browser = await getBrowser();
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          viewport: { width: 1440, height: 900 },
          ignoreHTTPSErrors: true,
        });
        const page = await context.newPage();

        await page.goto(url, { waitUntil: 'load', timeout: 20000 });
        await page.waitForTimeout(3000);

        // Scroll to trigger lazy loading
        await page.evaluate(async () => {
          const step = window.innerHeight;
          const max = document.body.scrollHeight;
          for (let y = 0; y < max; y += step) {
            window.scrollTo(0, y);
            await new Promise(r => setTimeout(r, 200));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(1500);

        // Get rendered HTML (full DOM after JS execution)
        const renderedHTML = await page.content();
        await context.close();

        console.log(`✅ Playwright rendered: ${renderedHTML.length} chars`);

        // Step 2: Send rendered HTML to Edge Function with a special flag
        // The Edge Function will use this HTML instead of fetching the URL
        const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/smooth-responder`;
        const edgeBody = {
          ...body,
          // Pass rendered HTML so Edge Function doesn't need to fetch
          renderedHtml: renderedHTML,
        };

        const response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(edgeBody),
        });

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const text = await response.text();
          return NextResponse.json(
            { error: `Edge function error (${response.status}): ${text.substring(0, 300)}` },
            { status: response.status }
          );
        }

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
      } catch (err) {
        console.error('❌ Playwright rewrite extract error:', err);
        // Fallback: send to Edge Function without rendered HTML (it will fetch itself)
        console.log('⚠️ Fallback: Edge Function fetchera\' direttamente...');
      }
    }

    // ALL OTHER MODES: proxy to Supabase Edge Function
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: 'Supabase non configurato. Imposta NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local' },
        { status: 500 }
      );
    }

    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/smooth-responder`;

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Edge function error (${response.status}): ${text.substring(0, 300)}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Clone funnel API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Errore sconosciuto' },
      { status: 500 }
    );
  }
}

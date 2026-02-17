import { NextRequest, NextResponse } from 'next/server';
import { getSingletonBrowser, type Browser } from '@/lib/get-browser';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function getBrowser(): Promise<Browser> {
  return getSingletonBrowser();
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

    // REWRITE EXTRACT PHASE: render with Playwright, extract texts locally, save to Supabase DB
    if (cloneMode === 'rewrite' && body.phase === 'extract' && url) {
      console.log(`🔄 Rewrite EXTRACT con Playwright: ${url}`);

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return NextResponse.json({ error: 'Supabase non configurato.' }, { status: 500 });
      }

      try {
        // Step 1: Render the page with Playwright
        const browser = await getBrowser();
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          viewport: { width: 1440, height: 900 },
          ignoreHTTPSErrors: true,
        });
        const pwPage = await context.newPage();

        await pwPage.goto(url, { waitUntil: 'load', timeout: 20000 });
        await pwPage.waitForTimeout(3000);

        await pwPage.evaluate(async () => {
          const step = window.innerHeight;
          const max = document.body.scrollHeight;
          for (let y = 0; y < max; y += step) {
            window.scrollTo(0, y);
            await new Promise(r => setTimeout(r, 200));
          }
          window.scrollTo(0, 0);
        });
        await pwPage.waitForTimeout(1500);

        // Step 2: Extract texts directly from the rendered DOM via Playwright
        const extractResult = await pwPage.evaluate(() => {
          const skipTags: Record<string, boolean> = {
            SCRIPT:true, STYLE:true, NOSCRIPT:true, IFRAME:true, SVG:true, META:true, LINK:true, BR:true, HR:true, IMG:true, INPUT:true, SELECT:true, TEXTAREA:true
          };
          const texts: Array<{
            index: number; originalText: string; tagName: string; fullTag: string;
            classes: string; attributes: string; context: string; position: number; rawText?: string;
          }> = [];
          let idx = 0;

          // Extract visible text from all elements
          const allEls = document.body.querySelectorAll('*');
          const extracted = new Set<string>();

          allEls.forEach((el) => {
            if (skipTags[el.tagName]) return;
            const rect = el.getBoundingClientRect();
            if (rect.width < 5 || rect.height < 5) return;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;

            // Get direct text content (not from children)
            let directText = '';
            el.childNodes.forEach(node => {
              if (node.nodeType === 3) directText += node.textContent || '';
            });
            directText = directText.replace(/\s+/g, ' ').trim();

            if (directText.length < 2 || !directText.match(/[a-zA-Z]/)) return;
            // Skip duplicates and code-like content
            if (extracted.has(directText)) return;
            if (directText.includes('{') || directText.includes('}') || directText.includes('=>')) return;
            if (directText.startsWith('http') || directText.startsWith('//')) return;

            extracted.add(directText);
            const tag = el.tagName.toLowerCase();
            const cls = el.getAttribute('class') || '';
            const attrs = Array.from(el.attributes).map(a => `${a.name}="${a.value}"`).join(' ').substring(0, 200);

            texts.push({
              index: idx++,
              originalText: directText,
              tagName: tag,
              fullTag: `<${tag}${cls ? ` class="${cls}"` : ''}>`,
              classes: cls,
              attributes: attrs,
              context: tag,
              position: Math.round(rect.top),
            });
          });

          // Also extract alt/title/placeholder attributes
          document.querySelectorAll('[alt],[title],[placeholder],[aria-label]').forEach(el => {
            ['alt', 'title', 'placeholder', 'aria-label'].forEach(attr => {
              const val = el.getAttribute(attr);
              if (val && val.length >= 3 && val.match(/[a-zA-Z]/) && !extracted.has(val) && !val.startsWith('http')) {
                extracted.add(val);
                texts.push({
                  index: idx++,
                  originalText: val,
                  tagName: '',
                  fullTag: `${attr}="${val}"`,
                  classes: '',
                  attributes: `${attr}="${val}"`,
                  context: `attr:${attr}`,
                  position: 0,
                });
              }
            });
          });

          return texts;
        });

        // Step 2b: Get clean HTML with CSS inlined and URLs fixed (same logic as cloneWithBrowser)
        const renderedHTML = await pwPage.evaluate((pageUrl: string) => {
          function abs(relative: string): string {
            if (!relative || relative.startsWith('data:') || relative.startsWith('blob:') ||
                relative.startsWith('#') || relative.startsWith('mailto:') || relative.startsWith('tel:') ||
                relative.startsWith('javascript:')) return relative;
            if (relative.startsWith('http://') || relative.startsWith('https://')) return relative;
            try { return new URL(relative, pageUrl).href; } catch { return relative; }
          }

          // Collect all CSS from loaded stylesheets
          const allCss: string[] = [];
          for (const sheet of Array.from(document.styleSheets)) {
            try {
              const rules = Array.from(sheet.cssRules || []);
              let cssText = rules.map(r => r.cssText).join('\n');
              cssText = cssText.replace(/url\(\s*["']?(?!data:|https?:|blob:)([^"')]+)["']?\s*\)/gi, (_m: string, u: string) => {
                const baseUrl = sheet.href || pageUrl;
                try { return `url("${new URL(u.trim(), baseUrl).href}")`; } catch { return `url("${u}")`; }
              });
              if (cssText.trim()) allCss.push(cssText);
            } catch { /* CORS - skip */ }
          }

          const docClone = document.documentElement.cloneNode(true) as HTMLElement;
          // Remove scripts
          docClone.querySelectorAll('script').forEach(s => s.remove());
          // Remove event handlers
          docClone.querySelectorAll('*').forEach(el => {
            Array.from(el.attributes).forEach(attr => {
              if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
            });
          });
          // Remove stylesheet links (CSS is inlined)
          docClone.querySelectorAll('link[rel="stylesheet"]').forEach(l => l.remove());
          // Fix all URLs to absolute
          docClone.querySelectorAll('[src],[href],[poster],[data-src],[data-lazy-src],[data-original],[data-bg],[action]').forEach(el => {
            ['src', 'href', 'poster', 'data-src', 'data-lazy-src', 'data-original', 'data-bg', 'action'].forEach(attr => {
              const val = el.getAttribute(attr);
              if (val && !val.startsWith('data:') && !val.startsWith('blob:') && !val.startsWith('#') && !val.startsWith('mailto:')) {
                el.setAttribute(attr, abs(val));
              }
            });
            const srcset = el.getAttribute('srcset');
            if (srcset) {
              el.setAttribute('srcset', srcset.split(',').map((e: string) => {
                const p = e.trim().split(/\s+/); if (p[0]) p[0] = abs(p[0]); return p.join(' ');
              }).join(', '));
            }
          });
          // Fix inline style url()
          docClone.querySelectorAll('[style]').forEach(el => {
            const s = el.getAttribute('style') || '';
            if (s.includes('url(')) {
              el.setAttribute('style', s.replace(/url\(\s*["']?(?!data:|https?:|blob:)([^"')]+)["']?\s*\)/gi,
                (_m: string, u: string) => `url("${abs(u.trim())}")`));
            }
          });
          // Inject consolidated CSS
          const head = docClone.querySelector('head');
          if (head && allCss.length > 0) {
            head.querySelectorAll('style').forEach(s => s.remove());
            const styleEl = document.createElement('style');
            styleEl.textContent = allCss.join('\n\n');
            const after = head.querySelector('meta[charset]')?.nextSibling || head.firstChild;
            if (after) head.insertBefore(styleEl, after); else head.appendChild(styleEl);
          }
          return '<!DOCTYPE html>\n' + docClone.outerHTML;
        }, url);

        await context.close();

        console.log(`✅ Playwright: ${renderedHTML.length} chars (CSS inlined), ${extractResult.length} testi estratti`);

        if (extractResult.length === 0) {
          return NextResponse.json({ error: 'Nessun testo trovato nella pagina renderizzata.' }, { status: 400 });
        }

        // Step 3: Save job and texts to Supabase DB directly
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

        const { data: job, error: jobError } = await supabase
          .from('cloning_jobs')
          .insert({
            user_id: body.userId || '00000000-0000-0000-0000-000000000001',
            url,
            clone_mode: 'rewrite',
            product_name: body.productName || '',
            product_description: body.productDescription || '',
            framework: body.framework || null,
            target: body.target || null,
            custom_prompt: body.customPrompt || null,
            original_html: renderedHTML,
            total_texts: extractResult.length,
            status: 'ready',
          })
          .select()
          .single();

        if (jobError || !job) {
          console.error('❌ Job creation error:', jobError);
          return NextResponse.json({ error: `Errore creazione job: ${jobError?.message}` }, { status: 500 });
        }

        // Insert texts in batches
        const textsToInsert = extractResult.map(t => ({
          job_id: job.id,
          index: t.index,
          original_text: t.originalText,
          raw_text: t.rawText || null,
          tag_name: t.tagName,
          full_tag: t.fullTag,
          classes: t.classes,
          attributes: t.attributes,
          context: t.context,
          position: t.position,
          processed: false,
        }));

        for (let i = 0; i < textsToInsert.length; i += 500) {
          const batch = textsToInsert.slice(i, i + 500);
          const { error: insertError } = await supabase.from('cloning_texts').insert(batch);
          if (insertError) {
            await supabase.from('cloning_jobs').delete().eq('id', job.id);
            return NextResponse.json({ error: `Errore salvataggio testi: ${insertError.message}` }, { status: 500 });
          }
        }

        console.log(`✅ Job ${job.id} creato con ${extractResult.length} testi (Playwright + Supabase diretto)`);

        return NextResponse.json({
          success: true,
          phase: 'extract',
          jobId: job.id,
          totalTexts: extractResult.length,
          message: 'Testi estratti con Playwright e salvati. Procedi con fase process.',
        });
      } catch (err) {
        console.error('❌ Playwright rewrite extract error:', err);
        console.log('⚠️ Fallback: Edge Function fetchera\' direttamente...');
        // Fall through to Edge Function proxy
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

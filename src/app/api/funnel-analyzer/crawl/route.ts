import { NextRequest, NextResponse } from 'next/server';
import type { Browser } from 'playwright';
import type {
  FunnelCrawlStep,
  FunnelCrawlLink,
  FunnelCrawlForm,
  FunnelCrawlNetworkRequest,
  FunnelCrawlCookie,
  FunnelCrawlResult,
} from '@/types';

const DEFAULT_MAX_STEPS = 15;
const DEFAULT_TIMEOUT_MS = 90_000;
const NAV_TIMEOUT_MS = 25_000;

const TRACKING_PATTERNS = /facebook|google|analytics|pixel|track|doubleclick|hotjar|segment|gtm|tag_manager|clarity|mixpanel|amplitude/i;
const CHECKOUT_PATTERNS = /checkout|cart|pay|stripe|paypal|payment|order|purchase/i;

function isTrackingUrl(url: string): boolean {
  return TRACKING_PATTERNS.test(url);
}

function isCheckoutUrl(url: string): boolean {
  return CHECKOUT_PATTERNS.test(url);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let browser: Browser | null = null;
  let entryUrl = '';

  try {
    const body = await request.json();
    const {
      entryUrl: bodyEntryUrl,
      headless = true,
      maxSteps = DEFAULT_MAX_STEPS,
      maxDepth = 3,
      followSameOriginOnly = true,
      captureScreenshots = true,
      captureNetwork = true,
      captureCookies = true,
      viewportWidth = 1280,
      viewportHeight = 720,
    } = body as {
      entryUrl: string;
      headless?: boolean;
      maxSteps?: number;
      maxDepth?: number;
      followSameOriginOnly?: boolean;
      captureScreenshots?: boolean;
      captureNetwork?: boolean;
      captureCookies?: boolean;
      viewportWidth?: number;
      viewportHeight?: number;
    };

    entryUrl = typeof bodyEntryUrl === 'string' ? bodyEntryUrl : '';
    if (!entryUrl) {
      return NextResponse.json(
        { success: false, error: 'entryUrl is required' },
        { status: 400 }
      );
    }

    const normalizedEntry = new URL(entryUrl).origin + new URL(entryUrl).pathname;
    const visited = new Set<string>();
    const steps: FunnelCrawlStep[] = [];
    const queue: { url: string; depth: number }[] = [{ url: normalizedEntry, depth: 0 }];

    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      headless: headless ?? true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
    });

    const networkRequests: FunnelCrawlNetworkRequest[] = [];
    if (captureNetwork) {
      context.on('request', (req) => {
        const u = req.url();
        const method = req.method();
        const resourceType = req.resourceType();
        networkRequests.push({
          url: u,
          method,
          resourceType,
          isTracking: isTrackingUrl(u),
          isCheckout: isCheckoutUrl(u),
        });
      });
      context.on('response', (res) => {
        const req = res.request();
        const idx = networkRequests.findIndex((r) => r.url === req.url() && r.method === req.method());
        if (idx !== -1) networkRequests[idx].status = res.status();
      });
    }

    while (queue.length > 0 && steps.length < maxSteps) {
      const { url: currentUrl, depth } = queue.shift()!;
      if (visited.has(currentUrl) || depth > maxDepth) continue;
      visited.add(currentUrl);

      networkRequests.length = 0;

      const page = await context.newPage();
      page.setDefaultTimeout(NAV_TIMEOUT_MS);

      try {
        const response = await page.goto(currentUrl, {
          waitUntil: 'domcontentloaded',
          timeout: NAV_TIMEOUT_MS,
        });
        if (!response) {
          await page.close();
          continue;
        }
        const finalUrl = page.url();
        if (followSameOriginOnly) {
          try {
            const entryOrigin = new URL(entryUrl).origin;
            const currentOrigin = new URL(finalUrl).origin;
            if (currentOrigin !== entryOrigin) {
              await page.close();
              continue;
            }
          } catch {
            await page.close();
            continue;
          }
        }

        await page.waitForLoadState('networkidle').catch(() => {});

        const title = await page.title();
        let screenshotBase64: string | undefined;
        if (captureScreenshots) {
          const buf = await page.screenshot({ fullPage: true, type: 'png' });
          screenshotBase64 = buf.toString('base64');
        }

        const links: FunnelCrawlLink[] = [];
        const ctaButtons: FunnelCrawlLink[] = [];
        const ctaSelectors = [
          'a[href][class*="btn"], a[href][class*="button"], a[href][class*="cta"]',
          'button',
          'input[type="submit"]',
          '[role="button"]',
        ];

        const allLinks = await page.$$eval('a[href]', (anchors) =>
          anchors.map((a) => ({
            href: (a as HTMLAnchorElement).href,
            text: (a as HTMLAnchorElement).textContent?.trim().slice(0, 200) || '',
          }))
        );

        for (const { href, text } of allLinks) {
          try {
            const full = new URL(href, currentUrl).href;
            const isCta = !!(
              /btn|button|cta|submit|buy|order|get|start|join|sign|claim/i.test(text || '') ||
              (text && text.length < 50)
            );
            links.push({ href: full, text: text || '', isCta });
            if (isCta) ctaButtons.push({ href: full, text: text || '', isCta: true });
          } catch {
            // skip invalid URLs
          }
        }

        const forms: FunnelCrawlForm[] = await page.$$eval('form[action]', (formsEl) =>
          formsEl.map((f) => {
            const form = f as HTMLFormElement;
            const action = form.action || '';
            const method = (form.method || 'get').toLowerCase();
            const inputs = Array.from(form.querySelectorAll('input, select, textarea'))
              .filter((el) => (el as HTMLInputElement).name)
              .map((el) => {
                const input = el as HTMLInputElement;
                return {
                  name: input.name,
                  type: (input.type || 'text').toLowerCase(),
                  required: input.required ?? false,
                };
              });
            const submit = form.querySelector('button[type="submit"], input[type="submit"]');
            return {
              action,
              method,
              inputs,
              submitButtonText: submit ? (submit as HTMLElement).textContent?.trim()?.slice(0, 100) : undefined,
            };
          })
        );

        let cookies: FunnelCrawlCookie[] = [];
        if (captureCookies) {
          const cks = await context.cookies();
          cookies = cks.map((c) => ({
            name: c.name,
            domain: c.domain,
            path: c.path,
            expires: c.expires,
            httpOnly: c.httpOnly,
            secure: c.secure,
          }));
        }

        const domLength = captureNetwork
          ? await page.evaluate(() => document.documentElement.outerHTML.length)
          : 0;

        const step: FunnelCrawlStep = {
          stepIndex: steps.length + 1,
          url: finalUrl,
          title,
          screenshotBase64,
          links: [...links],
          ctaButtons: [...ctaButtons],
          forms: [...forms],
          networkRequests: captureNetwork ? [...networkRequests] : [],
          cookies,
          domLength,
          timestamp: new Date().toISOString(),
        };
        steps.push(step);

        if (depth < maxDepth && followSameOriginOnly) {
          const entryOrigin = new URL(entryUrl).origin;
          const toEnqueue = new Set<string>();
          for (const link of links) {
            try {
              const full = new URL(link.href);
              if (full.origin === entryOrigin && full.href !== finalUrl && !visited.has(full.href)) {
                const pathQuery = full.origin + full.pathname + full.search;
                toEnqueue.add(pathQuery);
              }
            } catch {
              // skip
            }
          }
          toEnqueue.forEach((u) => queue.push({ url: u, depth: depth + 1 }));
        }
      } catch (err) {
        console.error('Crawl step error:', currentUrl, err);
      } finally {
        await page.close();
      }
    }

    const result: FunnelCrawlResult = {
      success: true,
      entryUrl,
      steps,
      totalSteps: steps.length,
      durationMs: Date.now() - startTime,
      visitedUrls: Array.from(visited),
    };

    return NextResponse.json(result);
  } catch (error) {
    const result: FunnelCrawlResult = {
      success: false,
      entryUrl,
      steps: [],
      totalSteps: 0,
      durationMs: Date.now() - startTime,
      visitedUrls: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    return NextResponse.json(result, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}

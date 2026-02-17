import { NextRequest, NextResponse } from 'next/server';
import { generateBranding, buildBrandingInputFromDb } from '@/lib/branding-generator';
import { fetchFunnelCrawlStepsByFunnel } from '@/lib/supabase-operations';

/**
 * Generates a complete branding package for quiz swapping.
 * 
 * Accepts either:
 *   A) Direct branding input (product + referenceFunnel + options)
 *   B) Simplified input (product + entryUrl + funnelName) — fetches crawl data from DB
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Mode B: simplified — fetch crawl steps from DB and build input
    if (body.entryUrl && body.funnelName && body.product) {
      const { entryUrl, funnelName, product, options, funnelMeta } = body as {
        entryUrl: string;
        funnelName: string;
        product: {
          name: string;
          description: string;
          price: number;
          benefits: string[];
          ctaText: string;
          ctaUrl: string;
          brandName: string;
          imageUrl?: string;
        };
        options?: {
          provider?: 'claude' | 'gemini';
          tone?: 'professional' | 'casual' | 'urgent' | 'friendly' | 'luxury' | 'scientific' | 'empathetic';
          targetAudience?: string;
          niche?: string;
          language?: string;
        };
        funnelMeta?: {
          funnel_type?: string;
          category?: string;
          analysis_summary?: string;
          persuasion_techniques?: string[];
          lead_capture_method?: string;
          notable_elements?: string[];
        };
      };

      // Try to fetch crawl steps with vision analysis from DB
      let crawlSteps: Awaited<ReturnType<typeof fetchFunnelCrawlStepsByFunnel>> = [];
      try {
        crawlSteps = await fetchFunnelCrawlStepsByFunnel(entryUrl, funnelName);
      } catch {
        // If no crawl steps, we'll use funnelMeta steps instead
      }

      if (crawlSteps.length > 0) {
        // Build from DB data (has vision analysis)
        const input = buildBrandingInputFromDb(
          {
            name: product.name,
            description: product.description,
            price: product.price,
            benefits: product.benefits,
            cta_text: product.ctaText,
            cta_url: product.ctaUrl,
            brand_name: product.brandName,
            image_url: product.imageUrl,
          },
          crawlSteps.map(row => ({
            step_index: row.step_index,
            url: row.url,
            title: row.title,
            step_data: row.step_data,
            vision_analysis: row.vision_analysis,
            funnel_name: row.funnel_name,
            entry_url: row.entry_url,
            funnel_tag: row.funnel_tag,
          })),
          {
            provider: options?.provider || 'gemini',
            tone: options?.tone || 'professional',
            targetAudience: options?.targetAudience,
            niche: options?.niche || funnelMeta?.category,
            language: options?.language || 'it',
            funnelType: funnelMeta?.funnel_type,
            analysisSummary: funnelMeta?.analysis_summary || undefined,
            persuasionTechniques: funnelMeta?.persuasion_techniques,
            leadCaptureMethod: funnelMeta?.lead_capture_method || undefined,
            notableElements: funnelMeta?.notable_elements,
          }
        );

        const result = await generateBranding(input);
        return NextResponse.json(result);
      }

      // Fallback: no crawl steps — build minimal input from funnelMeta
      return NextResponse.json({
        success: false,
        error: 'No crawl steps found in database. Run funnel analysis first to get vision data.',
      }, { status: 404 });
    }

    // Mode A: direct branding input
    if (body.product && body.referenceFunnel) {
      const result = await generateBranding(body);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { success: false, error: 'Missing required fields. Provide (product + entryUrl + funnelName) or (product + referenceFunnel).' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Generate branding error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Branding generation failed' },
      { status: 500 }
    );
  }
}

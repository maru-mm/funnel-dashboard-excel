import { NextRequest, NextResponse } from 'next/server';
import { createFunnelCrawlSteps } from '@/lib/supabase-operations';
import type { FunnelCrawlStep } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entryUrl, funnelName, funnelTag, steps } = body as {
      entryUrl: string;
      funnelName?: string;
      funnelTag?: string;
      steps: FunnelCrawlStep[];
    };

    if (!entryUrl || typeof entryUrl !== 'string') {
      return NextResponse.json(
        { success: false, error: 'entryUrl is required' },
        { status: 400 }
      );
    }
    if (!Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { success: false, error: 'steps array is required and must not be empty' },
        { status: 400 }
      );
    }

    const name = typeof funnelName === 'string' ? funnelName.trim() : '';
    const tag = typeof funnelTag === 'string' ? funnelTag.trim() || null : null;

    const { count, ids } = await createFunnelCrawlSteps(
      entryUrl,
      name || 'Senza nome',
      tag,
      steps
    );

    return NextResponse.json({
      success: true,
      saved: count,
      ids,
    });
  } catch (error) {
    console.error('Save funnel steps error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Errore nel salvataggio su Supabase',
      },
      { status: 500 }
    );
  }
}

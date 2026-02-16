import { NextRequest, NextResponse } from 'next/server';

/**
 * DEPRECATO: usa POST /api/funnel-analyzer/crawl/start per avviare un crawl in background.
 * Il crawl sincrono è stato rimosso per evitare timeout HTTP.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Endpoint deprecato. Usa POST /api/funnel-analyzer/crawl/start per avviare il crawl in background, poi GET /api/funnel-analyzer/crawl/status/[jobId] per lo stato.',
      migration: {
        start: '/api/funnel-analyzer/crawl/start',
        status: '/api/funnel-analyzer/crawl/status/{jobId}',
      },
    },
    { status: 410 }
  );
}

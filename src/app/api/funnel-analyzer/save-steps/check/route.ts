import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/funnel-analyzer/save-steps/check
 * Verifica che Supabase sia configurato e che la tabella funnel_crawl_steps esista.
 * Utile su Fly.dev per diagnosticare errori di salvataggio.
 */
export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return NextResponse.json({
        ok: false,
        error: 'Variabili Supabase mancanti',
        hasUrl: !!url,
        hasKey: !!key,
      });
    }
    const { data, error } = await supabase
      .from('funnel_crawl_steps')
      .select('id')
      .limit(1);
    if (error) {
      return NextResponse.json({
        ok: false,
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }
    return NextResponse.json({
      ok: true,
      tableExists: true,
      message: 'Supabase configurato e tabella funnel_crawl_steps accessibile',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg });
  }
}

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Helper function to check connection
export async function checkSupabaseConnection(): Promise<{
  connected: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase.from('products').select('count').limit(1);
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = table doesn't exist, which is expected if not created yet
      return { connected: false, error: error.message };
    }
    return { connected: true };
  } catch (err) {
    return { 
      connected: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}

import { supabase } from '../lib/supabase';

export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true }).limit(1);
    return !error;
  } catch (err) {
    console.error('Supabase connection test failed:', err);
    return false;
  }
}

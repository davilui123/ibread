import { createClient } from '@supabase/supabase-js';

// Usando os nomes exatos que estão no seu .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://szsbiaigkneegtprkezs.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'sb_publishable_atzv3ADWnP8igFhnbxHfHQ_uMQTBL1C';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Aviso: Variáveis do Supabase não encontradas. Verifique o .env.local");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
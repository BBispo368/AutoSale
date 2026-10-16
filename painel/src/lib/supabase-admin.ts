import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.warn('Atenção: Variáveis de ambiente de backend do Supabase não configuradas adequadamente.');
}

/**
 * Cliente Supabase Administrativo para uso EXCLUSIVO em rotas de backend (API routes / server).
 * Utiliza a chave com privilégios elevados (Service Role).
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

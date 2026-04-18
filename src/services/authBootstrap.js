import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

export async function ensureAuthBootstrap() {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Supabase nao configurado.' };
  }

  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error) {
    return { success: false, error: sessionResult.error.message };
  }

  let session = sessionResult.data.session;
  if (!session) {
    return { success: false, error: 'Sessao nao autenticada.' };
  }

  const bootstrapResult = await supabase.rpc('beca_bootstrap_user', { p_tenant_name: 'BECA Operacao' });
  if (bootstrapResult.error) {
    return { success: false, error: bootstrapResult.error.message };
  }

  return {
    success: true,
    data: {
      userId: session?.user?.id || null,
      tenant: bootstrapResult.data || null,
    },
  };
}

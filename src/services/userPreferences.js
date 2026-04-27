import { supabase } from '../lib/supabaseClient';

export async function getUserPreferences(userId) {
  if (!supabase || !userId) return { success: false, error: 'Supabase nao configurado ou userId ausente.' };
  try {
    const { data, error } = await supabase.from('user_preferences').select('preferences').eq('user_id', userId).single();
    if (error) return { success: false, error: error.message };
    return { success: true, data: data?.preferences || {} };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function upsertUserPreferences(userId, preferences) {
  if (!supabase || !userId) return { success: false, error: 'Supabase nao configurado ou userId ausente.' };
  try {
    const payload = { user_id: userId, preferences };
    const { data, error } = await supabase.from('user_preferences').upsert(payload, { onConflict: 'user_id' });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

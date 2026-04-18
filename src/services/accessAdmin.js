import { supabase } from '../lib/supabaseClient';

const fail = (error) => ({ success: false, error: error?.message || 'Operacao falhou.' });

export async function listMembers() {
  const { data, error } = await supabase.rpc('beca_list_memberships');
  if (error) return fail(error);
  return { success: true, data: Array.isArray(data) ? data : [] };
}

export async function addMemberByEmail(email, role) {
  const { data, error } = await supabase.rpc('beca_add_member_by_email', {
    p_email: email,
    p_role: role,
  });
  if (error) return fail(error);
  return { success: true, data };
}

export async function setMemberRole(userId, role) {
  const { data, error } = await supabase.rpc('beca_set_member_role', {
    p_user_id: userId,
    p_role: role,
  });
  if (error) return fail(error);
  return { success: true, data };
}

export async function removeMember(userId) {
  const { data, error } = await supabase.rpc('beca_remove_member', {
    p_user_id: userId,
  });
  if (error) return fail(error);
  return { success: true, data };
}

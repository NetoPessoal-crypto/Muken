import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const emptyState = {
  products: [],
  equipments: [],
  metrics: {},
  orders: [],
  stockMoves: [],
  auditLogs: [],
};

const asArray = (v) => (Array.isArray(v) ? v : []);
const asObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

export const isRemoteStateEnabled = () => isSupabaseConfigured && Boolean(supabase);

export async function loadRemoteState() {
  if (!isRemoteStateEnabled()) {
    return { success: false, error: 'Supabase nao configurado.' };
  }

  const { data, error } = await supabase.rpc('beca_get_app_state');
  if (error) return { success: false, error: error.message };

  const payload = data || emptyState;
  return {
    success: true,
    data: {
      products: asArray(payload.products),
      equipments: asArray(payload.equipments),
      metrics: asObject(payload.metrics),
      orders: asArray(payload.orders),
      stockMoves: asArray(payload.stockMoves),
      auditLogs: asArray(payload.auditLogs),
    },
  };
}

export async function saveRemoteState(payload) {
  if (!isRemoteStateEnabled()) {
    return { success: false, error: 'Supabase nao configurado.' };
  }

  const normalized = {
    products: asArray(payload?.products),
    equipments: asArray(payload?.equipments),
    metrics: asObject(payload?.metrics),
    orders: asArray(payload?.orders),
    stockMoves: asArray(payload?.stockMoves),
    auditLogs: asArray(payload?.auditLogs),
  };

  const { data, error } = await supabase.rpc('beca_replace_app_state', { p_payload: normalized });
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export function isStateEffectivelyEmpty(state) {
  if (!state) return true;
  return (
    asArray(state.products).length === 0 &&
    asArray(state.equipments).length === 0 &&
    asArray(state.orders).length === 0 &&
    asArray(state.stockMoves).length === 0 &&
    asArray(state.auditLogs).length === 0 &&
    Object.keys(asObject(state.metrics)).length === 0
  );
}

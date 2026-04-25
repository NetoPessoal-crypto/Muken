import { supabase } from '../lib/supabaseClient';

const fail = (error) => ({ success: false, error: error?.message || 'Operacao falhou.' });
const ensureClient = () => {
  if (!supabase) {
    return { ok: false, error: 'Supabase nao configurado.' };
  }
  return { ok: true };
};

export async function createOrderRemote(payload) {
  const client = ensureClient();
  if (!client.ok) return { success: false, error: client.error };
  const { data, error } = await supabase.rpc('beca_create_order', {
    p_cliente: payload?.cliente,
    p_produto_final_id: payload?.produtoFinalId,
    p_quantidade: Number(payload?.quantidade),
    p_prazo: payload?.prazo || null,
  });
  if (error) return fail(error);
  return { success: true, data };
}

export async function upsertProductRemote(productPayload) {
  const client = ensureClient();
  if (!client.ok) return { success: false, error: client.error };
  const { data, error } = await supabase.rpc('beca_upsert_product', {
    p_product: productPayload,
  });
  if (error) return fail(error);
  return { success: true, data };
}

export async function deleteOrInactivateProductRemote(productId) {
  const client = ensureClient();
  if (!client.ok) return { success: false, error: client.error };
  const { data, error } = await supabase.rpc('beca_delete_or_inactivate_product', {
    p_product_id: productId,
  });
  if (error) return fail(error);
  return { success: true, data };
}

export async function advanceOrderStatusRemote(orderId, newStatus, reason = null) {
  const client = ensureClient();
  if (!client.ok) return { success: false, error: client.error };
  const { data, error } = await supabase.rpc('beca_advance_order_status', {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_reason: reason,
  });
  if (error) return fail(error);
  return { success: true, data };
}

export async function setLogisticsStepRemote(orderId, step) {
  const client = ensureClient();
  if (!client.ok) return { success: false, error: client.error };
  const { data, error } = await supabase.rpc('beca_set_logistics_step', {
    p_order_id: orderId,
    p_step: step,
  });
  if (error) return fail(error);
  return { success: true, data };
}

export async function completeOrderRemote(orderId, reason = null) {
  const client = ensureClient();
  if (!client.ok) return { success: false, error: client.error };
  const { data, error } = await supabase.rpc('beca_complete_order', {
    p_order_id: orderId,
    p_reason: reason,
  });
  if (error) return fail(error);
  return { success: true, data };
}

export async function listProductionOrdersRemote() {
  const client = ensureClient();
  if (!client.ok) return { success: false, error: client.error };
  const { data, error } = await supabase.rpc('beca_list_production_orders');
  if (error) return fail(error);
  return { success: true, data: Array.isArray(data) ? data : [] };
}

export async function listEquipmentEventsRemote(equipmentId = null, limit = 100) {
  const client = ensureClient();
  if (!client.ok) return { success: false, error: client.error };
  const { data, error } = await supabase.rpc('beca_list_equipment_events', {
    p_equipment_id: equipmentId,
    p_limit: Number(limit),
  });
  if (error) return fail(error);
  return { success: true, data: Array.isArray(data) ? data : [] };
}

export async function getLotGenealogyRemote({ loteId = null, productId = null, orderId = null } = {}) {
  const client = ensureClient();
  if (!client.ok) return { success: false, error: client.error };
  const { data, error } = await supabase.rpc('beca_get_lot_genealogy', {
    p_lote_id: loteId,
    p_product_id: productId,
    p_order_id: orderId,
  });
  if (error) return fail(error);
  return { success: true, data: Array.isArray(data) ? data : [] };
}

export async function logEquipmentEventRemote(payload) {
  const client = ensureClient();
  if (!client.ok) return { success: false, error: client.error };
  const { data, error } = await supabase.rpc('beca_log_equipment_event', {
    p_equipment_id: payload?.equipmentId,
    p_event_type: payload?.eventType,
    p_note: payload?.note || null,
    p_metadata: payload?.metadata || {},
  });
  if (error) return fail(error);
  return { success: true, data };
}

export async function startProductionOrderRemote(productionOrderId) {
  const client = ensureClient();
  if (!client.ok) return { success: false, error: client.error };
  const { data, error } = await supabase.rpc('beca_start_production_order', {
    p_production_order_id: productionOrderId,
  });
  if (error) return fail(error);
  return { success: true, data };
}

export async function finalizeProductionOrderRemote(productionOrderId) {
  const client = ensureClient();
  if (!client.ok) return { success: false, error: client.error };
  const { data, error } = await supabase.rpc('beca_finalize_production_order', {
    p_production_order_id: productionOrderId,
  });
  if (error) return fail(error);
  return { success: true, data };
}

export async function cancelProductionOrderRemote(productionOrderId) {
  const client = ensureClient();
  if (!client.ok) return { success: false, error: client.error };
  const { data, error } = await supabase.rpc('beca_cancel_production_order', {
    p_production_order_id: productionOrderId,
  });
  if (error) return fail(error);
  return { success: true, data };
}

export async function inventoryCountRemote(payload) {
  const client = ensureClient();
  if (!client.ok) return { success: false, error: client.error };
  const { data, error } = await supabase.rpc('beca_inventory_count', {
    p_product_id: payload?.productId,
    p_physical_qty: Number(payload?.physicalQty),
    p_reason: payload?.reason,
    p_lote_id: payload?.loteId || null,
  });
  if (error) return fail(error);
  return { success: true, data };
}

export async function stockMoveRemote(payload) {
  const client = ensureClient();
  if (!client.ok) return { success: false, error: client.error };
  const { data, error } = await supabase.rpc('beca_stock_move', {
    p_product_id: payload?.productId,
    p_move_type: payload?.type,
    p_qty: Number(payload?.qty),
    p_reason: payload?.reason || null,
    p_lote_id: payload?.loteId || null,
    p_validade: payload?.validade || null,
  });
  if (error) return fail(error);
  return { success: true, data };
}

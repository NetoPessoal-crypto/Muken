import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { initialProducts, initialEquipments, initialMetrics, initialOrders } from '../data/mockDB';
import { isRemoteStateEnabled, isStateEffectivelyEmpty, loadRemoteState, saveRemoteState } from '../services/remoteState';
import { ensureAuthBootstrap } from '../services/authBootstrap';
import {
  createOrderRemote,
  upsertProductRemote,
  deleteOrInactivateProductRemote,
  advanceOrderStatusRemote,
  setLogisticsStepRemote,
  completeOrderRemote,
  startProductionOrderRemote,
  finalizeProductionOrderRemote,
  cancelProductionOrderRemote,
  inventoryCountRemote,
  stockMoveRemote,
} from '../services/operationsApi';
import {
  ORDER_STATUS,
  canCancelByRole,
  isTransitionAllowed,
  getConversionFactor,
  consumeFromLotesAtomic,
  restoreConsumedLote,
  revertProducedOutputFromLotes,
} from '../utils/businessRules';

const StoreContext = createContext();

const PRODUCT_TYPES = ['ingrediente', 'embalagem', 'produto_final'];

const STOCK_MOVE_TYPES = ['ENTRADA', 'SAIDA', 'AJUSTE', 'PERDA', 'DEVOLUCAO'];

const STORAGE_KEYS = {
  products: 'crmProducts',
  equips: 'crmEquips',
  metrics: 'crmMetrics',
  orders: 'crmOrders',
  stockMoves: 'crmStockMoves',
  auditLogs: 'crmAuditLogs',
};

const safeLoad = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const nowIso = () => new Date().toISOString();

const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const normalizeLegacyProducts = (items) =>
  (Array.isArray(items) ? items : []).map((p) => ({
    ...p,
    ativo: p.ativo !== false,
    lotes: Array.isArray(p.lotes) ? p.lotes : [],
  }));

const normalizeLegacyOrders = (items) =>
  (Array.isArray(items) ? items : []).map((o) => ({
    ...o,
    status: o.status || ORDER_STATUS.PENDENTE,
    estoqueBaixado: Boolean(o.estoqueBaixado),
    moveRefs: Array.isArray(o.moveRefs) ? o.moveRefs : [],
    history: Array.isArray(o.history)
      ? o.history
      : [{ at: o.data || nowIso(), from: null, to: o.status || ORDER_STATUS.PENDENTE, reason: 'legacy-import' }],
  }));

export function StoreProvider({ children }) {
  const [products, setProducts] = useState(() =>
    normalizeLegacyProducts(safeLoad(STORAGE_KEYS.products, initialProducts))
  );
  const [equipments, setEquipments] = useState(() => safeLoad(STORAGE_KEYS.equips, initialEquipments));
  const [metrics, setMetrics] = useState(() => safeLoad(STORAGE_KEYS.metrics, initialMetrics));
  const [orders, setOrders] = useState(() => normalizeLegacyOrders(safeLoad(STORAGE_KEYS.orders, initialOrders)));
  const [stockMoves, setStockMoves] = useState(() => safeLoad(STORAGE_KEYS.stockMoves, []));
  const [auditLogs, setAuditLogs] = useState(() => safeLoad(STORAGE_KEYS.auditLogs, []));
  const [lastError, setLastError] = useState(null);
  const [isRemoteSyncEnabled] = useState(() => isRemoteStateEnabled());
  const [authContext, setAuthContext] = useState(null);
  const remoteHydratedRef = useRef(false);
  const hydrateRef = useRef(false);
  const persistTimerRef = useRef(null);
  const bootstrapPayloadRef = useRef({
    products,
    equipments,
    metrics,
    orders,
    stockMoves,
    auditLogs,
  });

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.equips, JSON.stringify(equipments)); }, [equipments]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.metrics, JSON.stringify(metrics)); }, [metrics]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.stockMoves, JSON.stringify(stockMoves)); }, [stockMoves]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.auditLogs, JSON.stringify(auditLogs)); }, [auditLogs]);

  useEffect(() => {
    if (!isRemoteSyncEnabled) {
      remoteHydratedRef.current = true;
      return;
    }

    let cancelled = false;
    const hydrate = async () => {
      const authResult = await ensureAuthBootstrap();
      if (!authResult.success) {
        if (!cancelled) {
          setLastError(`Falha ao autenticar no Supabase: ${authResult.error}`);
          remoteHydratedRef.current = true;
        }
        return;
      }

      if (!cancelled) {
        setAuthContext(authResult.data);
      }

      const remoteResult = await loadRemoteState();
      if (cancelled) return;

      if (!remoteResult.success) {
        setLastError(`Falha ao carregar Supabase: ${remoteResult.error}`);
        remoteHydratedRef.current = true;
        return;
      }

      const remoteState = remoteResult.data;
      if (isStateEffectivelyEmpty(remoteState)) {
        await saveRemoteState(bootstrapPayloadRef.current);
      } else {
        hydrateRef.current = true;
        setProducts(normalizeLegacyProducts(remoteState.products));
        setEquipments(Array.isArray(remoteState.equipments) ? remoteState.equipments : []);
        setMetrics(remoteState.metrics || {});
        setOrders(normalizeLegacyOrders(remoteState.orders));
        setStockMoves(Array.isArray(remoteState.stockMoves) ? remoteState.stockMoves : []);
        setAuditLogs(Array.isArray(remoteState.auditLogs) ? remoteState.auditLogs : []);
      }

      remoteHydratedRef.current = true;
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [isRemoteSyncEnabled]);

  useEffect(() => {
    if (isRemoteSyncEnabled) return;
    if (!remoteHydratedRef.current) return;

    if (hydrateRef.current) {
      hydrateRef.current = false;
      return;
    }

    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = setTimeout(async () => {
      const result = await saveRemoteState({
        products,
        equipments,
        metrics,
        orders,
        stockMoves,
        auditLogs,
      });
      if (!result.success) {
        setLastError(`Falha ao salvar no Supabase: ${result.error}`);
      }
    }, 500);

    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [products, equipments, metrics, orders, stockMoves, auditLogs, isRemoteSyncEnabled]);

  const applyRemoteSnapshot = (remoteState) => {
    hydrateRef.current = true;
    setProducts(normalizeLegacyProducts(remoteState?.products));
    setEquipments(Array.isArray(remoteState?.equipments) ? remoteState.equipments : []);
    setMetrics(remoteState?.metrics || {});
    setOrders(normalizeLegacyOrders(remoteState?.orders));
    setStockMoves(Array.isArray(remoteState?.stockMoves) ? remoteState.stockMoves : []);
    setAuditLogs(Array.isArray(remoteState?.auditLogs) ? remoteState.auditLogs : []);
  };

  const clearLastError = () => setLastError(null);

  const currentRole = authContext?.tenant?.role || null;
  const canWrite = currentRole === 'admin' || currentRole === 'operacao';
  const canAdmin = currentRole === 'admin';

  const fail = (message) => {
    setLastError(message);
    return { success: false, error: message };
  };

  const addAudit = (action, entity, before = null, after = null, reason = null) => {
    const actorUserId = authContext?.userId || null;
    setAuditLogs((prev) => [
      ...prev,
      { id: makeId('AUD'), action, entity, before, after, reason, actor_user_id: actorUserId, at: nowIso() },
    ]);
  };

  const getActiveProducts = () => products.filter((p) => p.ativo !== false);

  const getValorPatrimonial = () => {
    let total = 0;
    getActiveProducts().forEach((p) => {
      if (p.type === 'ingrediente' || p.type === 'embalagem') {
        const lotes = Array.isArray(p.lotes) ? p.lotes : [];
        total += lotes.reduce((acc, lote) => {
          const qty = Number(lote.qtd) || 0;
          const unitCost = Number(lote.unitCost ?? lote.unit_cost ?? p.custo_producao) || 0;
          return acc + (qty * unitCost);
        }, 0);
      }
    });
    return total;
  };

  const getEstoqueVirtual = (id) => {
    const prod = products.find((p) => p.id === id);
    if (!prod) return 0;
    return (prod.lotes || []).reduce((acc, lote) => acc + (Number(lote.qtd) || 0), 0);
  };

  const addStockMovement = async (payload) => {
    clearLastError();
    if (!canWrite) return fail('Sem permissão para movimentar estoque.');

    const productId = payload?.productId;
    const moveType = (payload?.type || '').toString().trim().toUpperCase();
    const reason = (payload?.reason || '').toString().trim();
    const loteIdInput = (payload?.loteId || '').toString().trim();
    const validadeInput = (payload?.validade || '').toString().trim();
    const rawQty = Number(payload?.qty);

    if (!productId) return fail('Produto e obrigatorio.');
    if (!STOCK_MOVE_TYPES.includes(moveType)) return fail('Tipo de movimentacao invalido.');
    if (!Number.isFinite(rawQty) || rawQty === 0) return fail('Quantidade invalida.');
    if ((moveType === 'AJUSTE' || moveType === 'PERDA') && !reason) {
      return fail('Motivo obrigatorio para ajuste e perda.');
    }

    if (isRemoteSyncEnabled) {
      const result = await stockMoveRemote({
        productId,
        type: moveType,
        qty: rawQty,
        reason,
        loteId: loteIdInput || null,
        validade: validadeInput || null,
      });
      if (!result.success) return fail(result.error);
      applyRemoteSnapshot(result.data || {});
      return { success: true };
    }

    const productIndex = products.findIndex((p) => p.id === productId);
    if (productIndex < 0) return fail('Produto nao encontrado.');
    const product = products[productIndex];
    if (product.ativo === false) return fail('Produto inativo nao pode ser movimentado.');

    const nextProducts = clone(products);
    const target = nextProducts[productIndex];
    const moveQty = Math.abs(rawQty);
    const lotesAtual = Array.isArray(target.lotes) ? target.lotes : [];
    const nextMoves = [];
    let operationKind = moveType;

    const registerInbound = () => {
      const loteId = loteIdInput || makeId('L');
      const validade = validadeInput || '2099-12-31';
      const lotes = [...lotesAtual];
      const existingIndex = lotes.findIndex((l) => l.loteId === loteId);

      if (existingIndex >= 0) {
        lotes[existingIndex].qtd = Number((Number(lotes[existingIndex].qtd || 0) + moveQty).toFixed(6));
      } else {
        lotes.push({ loteId, qtd: moveQty, validade });
      }

      target.lotes = lotes;
      nextMoves.push({
        id: makeId('MOV'),
        kind: operationKind,
        refType: 'manual-stock',
        refId: target.id,
        productId: target.id,
        loteId,
        qty: moveQty,
        unit: target.unit,
        at: nowIso(),
      });
    };

    const registerOutbound = (forcedLoteId = null) => {
      const consumeResult = consumeFromLotesAtomic(lotesAtual, moveQty, forcedLoteId);
      if (!consumeResult.success) return consumeResult;

      target.lotes = consumeResult.lotes;
      consumeResult.allocations.forEach((alloc) => {
        nextMoves.push({
          id: makeId('MOV'),
          kind: operationKind,
          refType: 'manual-stock',
          refId: target.id,
          productId: target.id,
          loteId: alloc.loteId,
          qty: alloc.qty,
          unit: target.unit,
          at: nowIso(),
        });
      });

      return { success: true };
    };

    if (moveType === 'ENTRADA' || moveType === 'DEVOLUCAO') {
      registerInbound();
    } else if (moveType === 'SAIDA' || moveType === 'PERDA') {
      const outboundResult = registerOutbound(loteIdInput || null);
      if (!outboundResult.success) return fail(outboundResult.error);
    } else if (moveType === 'AJUSTE') {
      if (rawQty > 0) {
        operationKind = 'AJUSTE';
        registerInbound();
      } else {
        operationKind = 'AJUSTE';
        const outboundResult = registerOutbound(loteIdInput || null);
        if (!outboundResult.success) return fail(outboundResult.error);
      }
    }

    setProducts(nextProducts);
    setStockMoves((prev) => [...prev, ...nextMoves]);
    addAudit(
      'stock.manual-move',
      'stock',
      null,
      {
        productId: target.id,
        productName: target.name,
        type: moveType,
        qty: rawQty,
        lotesAfetados: nextMoves.map((m) => ({ loteId: m.loteId, qty: m.qty })),
      },
      reason || 'manual-stock-move'
    );

    return { success: true, data: nextMoves };
  };

  const validateProductData = (prodData, currentId = null) => {
    if (!prodData?.name?.trim()) return 'Nome do produto e obrigatorio.';
    if (!prodData?.sku?.trim()) return 'SKU do produto e obrigatorio.';
    if (!PRODUCT_TYPES.includes(prodData.type)) return 'Tipo de produto invalido.';
    if (!prodData?.unit?.trim()) return 'Unidade do produto e obrigatoria.';

    const skuInUse = products.find((p) => p.sku === prodData.sku && p.id !== currentId);
    if (skuInUse) return `SKU ja utilizado por ${skuInUse.name}.`;

    if (prodData.type === 'produto_final') {
      const receita = prodData.receita;
      if (!receita || Number(receita.rendimento) <= 0) return 'Receita precisa de rendimento maior que zero.';
      if (!Array.isArray(receita.ingredientes) || receita.ingredientes.length === 0) {
        return 'Receita precisa ter ao menos um insumo.';
      }
      for (const item of receita.ingredientes) {
        if (!item?.id) return 'Cada item da receita precisa de um insumo valido.';
        if (Number(item.uso) <= 0) return 'Uso por insumo deve ser maior que zero.';
        const perda = Number(item.perda_pct || 0);
        if (perda < 0 || perda > 100) return 'Perda deve estar entre 0 e 100.';
      }
    }

    return null;
  };

  const addOrUpdateProduct = async (prodData) => {
    clearLastError();
    if (!canWrite) return fail('Sem permissão para alterar produtos.');
    const id = prodData.id || null;
    const validationError = validateProductData(prodData, id);
    if (validationError) return fail(validationError);

    if (isRemoteSyncEnabled) {
      const normalizedPayload = {
        ...prodData,
        id: prodData.id || null,
        ativo: prodData.ativo !== false,
        lotes: Array.isArray(prodData.lotes)
          ? prodData.lotes
          : [{
            loteId: makeId('L'),
            qtd: parseFloat(prodData._initialQtd) || 0,
            validade: '2099-12-31',
          }],
      };
      const result = await upsertProductRemote(normalizedPayload);
      if (!result.success) return fail(result.error);
      applyRemoteSnapshot(result.data || {});
      return { success: true };
    }

    const index = products.findIndex((p) => p.id === prodData.id);
    if (index > -1) {
      const before = products[index];
      const updated = {
        ...before,
        ...prodData,
        ativo: before.ativo !== false,
      };
      const nextProducts = [...products];
      nextProducts[index] = updated;
      setProducts(nextProducts);
      addAudit('product.updated', 'product', before, updated, 'update-product');
      return { success: true, data: updated };
    }

    const created = {
      ...prodData,
      id: prodData.id || makeId(prodData.type === 'produto_final' ? 'PROD' : 'ING'),
      ativo: true,
      lotes:
        prodData.lotes ||
        [{
          loteId: makeId('L'),
          qtd: parseFloat(prodData._initialQtd) || 0,
          validade: '2099-12-31',
        }],
      createdAt: nowIso(),
    };
    setProducts((prev) => [...prev, created]);
    addAudit('product.created', 'product', null, created, 'create-product');
    return { success: true, data: created };
  };

  const deleteProduct = async (id) => {
    clearLastError();
    if (!canWrite) return fail('Sem permissão para remover/inativar produtos.');

    if (isRemoteSyncEnabled) {
      const result = await deleteOrInactivateProductRemote(id);
      if (!result.success) return fail(result.error);
      applyRemoteSnapshot(result.data || {});
      return { success: true };
    }

    const target = products.find((p) => p.id === id);
    if (!target) return fail('Produto nao encontrado.');

    const hasStockHistory = stockMoves.some((m) => m.productId === id);
    const hasOrderUsage = orders.some((o) => o.produtoFinalId === id);
    const usedInRecipe = products.some((p) =>
      p?.receita?.ingredientes?.some((ing) => ing.id === id)
    );

    if (hasStockHistory || hasOrderUsage || usedInRecipe) {
      const nextProducts = products.map((p) => (p.id === id ? { ...p, ativo: false } : p));
      setProducts(nextProducts);
      addAudit('product.inactivated', 'product', target, { ...target, ativo: false }, 'has-history');
      return { success: true, mode: 'inactivated' };
    }

    setProducts((prev) => prev.filter((p) => p.id !== id));
    addAudit('product.deleted', 'product', target, null, 'no-history');
    return { success: true, mode: 'deleted' };
  };

  const simulateProduction = (currentProducts, produtoFinalId, fornadas, refId = null) => {
    const batches = Number(fornadas);
    if (!Number.isFinite(batches) || batches <= 0) {
      return { success: false, error: 'Fornadas invalidas.' };
    }

    const localProducts = clone(currentProducts);
    const pfIndex = localProducts.findIndex((p) => p.id === produtoFinalId);
    if (pfIndex < 0) return { success: false, error: 'Produto final nao encontrado.' };
    const prodFinal = localProducts[pfIndex];

    if (prodFinal.ativo === false) return { success: false, error: 'Produto final inativo.' };
    if (!prodFinal.receita?.ingredientes?.length || Number(prodFinal.receita.rendimento) <= 0) {
      return { success: false, error: 'Receita invalida para producao.' };
    }

    const moves = [];

    for (const req of prodFinal.receita.ingredientes) {
      const ingIndex = localProducts.findIndex((p) => p.id === req.id);
      if (ingIndex < 0) return { success: false, error: `Insumo ${req.nome || req.id} nao encontrado.` };

      const ing = localProducts[ingIndex];
      if (ing.ativo === false) return { success: false, error: `Insumo ${ing.name} esta inativo.` };

      const factor = getConversionFactor(req.unit_uso || ing.unit, ing.unit);
      if (factor === null) {
        return {
          success: false,
          error: `Conversao invalida entre ${req.unit_uso || ing.unit} e ${ing.unit} no insumo ${ing.name}.`,
        };
      }

      const totalNeedUsage = Number(req.uso) * batches * (1 + Number(req.perda_pct || 0) / 100);
      const totalNeedBase = totalNeedUsage * factor;
      const currentStock = (ing.lotes || []).reduce((acc, lote) => acc + (Number(lote.qtd) || 0), 0);

      if (currentStock < totalNeedBase) {
        return {
          success: false,
          error: `Estoque insuficiente para ${ing.name}. Necessario: ${totalNeedBase.toFixed(3)} ${ing.unit}, disponivel: ${currentStock.toFixed(3)} ${ing.unit}.`,
        };
      }

      const consumeResult = consumeFromLotesAtomic(ing.lotes || [], totalNeedBase);
      if (!consumeResult.success) {
        return { success: false, error: `Falha de baixa atomica para ${ing.name}.` };
      }

      localProducts[ingIndex].lotes = consumeResult.lotes;

      consumeResult.allocations.forEach((alloc) => {
        moves.push({
          id: makeId('MOV'),
          kind: 'CONSUMO',
          refType: refId ? 'order' : 'manual-production',
          refId: refId || produtoFinalId,
          productId: ing.id,
          loteId: alloc.loteId,
          qty: alloc.qty,
          unit: ing.unit,
          at: nowIso(),
        });
      });
    }

    const outputQty = Number(prodFinal.receita.rendimento) * batches;
    const outputLoteId = makeId('L-PR');
    localProducts[pfIndex].lotes = [
      ...(localProducts[pfIndex].lotes || []),
      { loteId: outputLoteId, qtd: outputQty, validade: '2099-12-31' },
    ];

    const outputMove = {
      id: makeId('MOV'),
      kind: 'PRODUCAO_ENTRADA',
      refType: refId ? 'order' : 'manual-production',
      refId: refId || produtoFinalId,
      productId: produtoFinalId,
      loteId: outputLoteId,
      qty: outputQty,
      unit: prodFinal.unit,
      at: nowIso(),
    };

    moves.push(outputMove);
    return {
      success: true,
      nextProducts: localProducts,
      moves,
      outputMove,
      outputQty,
    };
  };

  const restoreMoveEffects = (currentProducts, order) => {
    const localProducts = clone(currentProducts);
    const orderMoves = stockMoves.filter((m) => m.refType === 'order' && m.refId === order.id);
    const consumed = orderMoves.filter((m) => m.kind === 'CONSUMO');
    const produced = orderMoves.filter((m) => m.kind === 'PRODUCAO_ENTRADA');
    const revertMoves = [];

    for (const move of consumed) {
      const pIndex = localProducts.findIndex((p) => p.id === move.productId);
      if (pIndex < 0) return { success: false, error: 'Falha ao estornar consumo: produto nao encontrado.' };

      localProducts[pIndex].lotes = restoreConsumedLote(localProducts[pIndex].lotes || [], move.loteId, move.qty);

      revertMoves.push({
        id: makeId('MOV'),
        kind: 'ESTORNO_CONSUMO',
        refType: 'order',
        refId: order.id,
        productId: move.productId,
        loteId: move.loteId,
        qty: move.qty,
        unit: move.unit,
        at: nowIso(),
      });
    }

    for (const move of produced) {
      const pIndex = localProducts.findIndex((p) => p.id === move.productId);
      if (pIndex < 0) return { success: false, error: 'Falha ao estornar producao: produto final nao encontrado.' };

      const estornoResult = revertProducedOutputFromLotes(
        localProducts[pIndex].lotes || [],
        move.qty,
        move.loteId
      );
      if (!estornoResult.success) return { success: false, error: estornoResult.error };

      localProducts[pIndex].lotes = estornoResult.lotes;
      revertMoves.push({
        id: makeId('MOV'),
        kind: 'ESTORNO_PRODUCAO',
        refType: 'order',
        refId: order.id,
        productId: move.productId,
        loteId: move.loteId,
        qty: move.qty,
        unit: move.unit,
        at: nowIso(),
      });
    }

    return { success: true, nextProducts: localProducts, revertMoves };
  };

  const produzirReceita = (produtoFinalId, fornadas) => {
    clearLastError();
    if (!canWrite) return fail('Sem permissão para iniciar produção.');
    const simulation = simulateProduction(products, produtoFinalId, fornadas, null);
    if (!simulation.success) return fail(simulation.error);

    setProducts(simulation.nextProducts);
    setStockMoves((prev) => [...prev, ...simulation.moves]);
    addAudit('production.manual', 'production', null, {
      produtoFinalId,
      fornadas,
      outputQty: simulation.outputQty,
    }, 'manual-production');
    return { success: true };
  };

  const resetAllData = () => {
    if (!canAdmin) {
      fail('Apenas admin pode resetar dados.');
      return;
    }
    if (window.confirm('Tem certeza? Isso vai apagar produtos, pedidos, movimentos e logs locais.')) {
      Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
      setProducts(normalizeLegacyProducts(initialProducts));
      setEquipments(initialEquipments);
      setMetrics(initialMetrics);
      setOrders(normalizeLegacyOrders(initialOrders));
      setStockMoves([]);
      setAuditLogs([]);
      setLastError(null);
      addAudit('system.reset', 'system', null, { by: 'user' }, 'reset-all');
    }
  };

  const addOrder = async (orderData) => {
    clearLastError();
    if (!canWrite) return fail('Sem permissão para criar pedidos.');
    if (!orderData?.cliente?.trim()) return fail('Cliente e obrigatorio.');
    if (!orderData?.produtoFinalId) return fail('Produto final e obrigatorio.');
    if (!Number.isFinite(Number(orderData.quantidade)) || Number(orderData.quantidade) <= 0) {
      return fail('Quantidade deve ser maior que zero.');
    }

    const product = products.find((p) => p.id === orderData.produtoFinalId);
    if (!product || product.type !== 'produto_final') {
      return fail('Pedido so pode ser criado para produto final valido.');
    }
    if (product.ativo === false) {
      return fail('Produto final inativo nao pode receber novos pedidos.');
    }

    if (isRemoteSyncEnabled) {
      const result = await createOrderRemote(orderData);
      if (!result.success) return fail(result.error);
      applyRemoteSnapshot(result.data || {});
      return { success: true };
    }

    const created = {
      ...orderData,
      id: makeId('ORD'),
      status: ORDER_STATUS.PENDENTE,
      data: nowIso(),
      estoqueBaixado: false,
      moveRefs: [],
      history: [{ at: nowIso(), from: null, to: ORDER_STATUS.PENDENTE, reason: 'order-created' }],
    };
    setOrders((prev) => [...prev, created]);
    addAudit('order.created', 'order', null, created, 'create-order');
    return { success: true, data: created };
  };

  const updateOrderStatus = async (orderId, newStatus, options = {}) => {
    clearLastError();
    if (!canWrite) return fail('Sem permissão para alterar status de pedido.');
    const index = orders.findIndex((o) => o.id === orderId);
    if (index < 0) return fail('Pedido nao encontrado.');
    if (!Object.values(ORDER_STATUS).includes(newStatus)) return fail('Status de pedido invalido.');

    const order = orders[index];
    if (order.status === newStatus) return { success: true, noop: true };

    if (!isTransitionAllowed(order.status, newStatus)) {
      return fail(`Transicao invalida: ${order.status} -> ${newStatus}.`);
    }

    if (newStatus === ORDER_STATUS.CANCELADO && !canCancelByRole(order.status, currentRole)) {
      if (order.status === ORDER_STATUS.PENDENTE) {
        return fail('Somente admin ou operacao podem cancelar pedidos pendentes.');
      }
      if (order.status === ORDER_STATUS.PRODUCAO || order.status === ORDER_STATUS.LOGISTICA) {
        return fail('Somente admin pode cancelar pedidos em producao ou logistica.');
      }
      return fail('Cancelamento nao permitido para esta etapa.');
    }

    if (isRemoteSyncEnabled) {
      const result = newStatus === ORDER_STATUS.CONCLUIDO
        ? await completeOrderRemote(orderId, options.reason || null)
        : await advanceOrderStatusRemote(orderId, newStatus, options.reason || null);
      if (!result.success) return fail(result.error);
      applyRemoteSnapshot(result.data || {});
      return { success: true };
    }

    let nextProducts = products;
    let newMoves = [];
    let orderPatch = {};

    if (newStatus === ORDER_STATUS.PRODUCAO && !order.estoqueBaixado) {
      const prodFinal = products.find((p) => p.id === order.produtoFinalId);
      const rendimento = Number(prodFinal?.receita?.rendimento || 0);
      if (rendimento <= 0) {
        return fail('Produto final sem receita valida para produzir.');
      }
      const fornadas = Math.ceil(Number(order.quantidade) / rendimento);
      const simulation = simulateProduction(products, order.produtoFinalId, fornadas, order.id);
      if (!simulation.success) return fail(simulation.error);
      nextProducts = simulation.nextProducts;
      newMoves = simulation.moves;
      orderPatch = {
        estoqueBaixado: true,
        moveRefs: simulation.moves.map((m) => m.id),
      };
    }

    if (newStatus === ORDER_STATUS.CANCELADO && order.estoqueBaixado) {
      const restored = restoreMoveEffects(nextProducts, order);
      if (!restored.success) return fail(restored.error);
      nextProducts = restored.nextProducts;
      newMoves = [...newMoves, ...restored.revertMoves];
      orderPatch = {
        ...orderPatch,
        estoqueBaixado: false,
      };
    }

    const updatedOrder = {
      ...order,
      ...orderPatch,
      status: newStatus,
      history: [...(order.history || []), { at: nowIso(), from: order.status, to: newStatus, reason: options.reason || null }],
    };

    const nextOrders = [...orders];
    nextOrders[index] = updatedOrder;

    setProducts(nextProducts);
    if (newMoves.length > 0) {
      setStockMoves((prev) => [...prev, ...newMoves]);
    }
    setOrders(nextOrders);

    addAudit('order.status-changed', 'order', order, updatedOrder, options.reason || 'status-change');
    return { success: true, data: updatedOrder };
  };

  const deleteOrder = async (orderId) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) {
      return fail('Pedido nao encontrado.');
    }

    if (!canCancelByRole(order.status, currentRole)) {
      if (order.status === ORDER_STATUS.PENDENTE) {
        return fail('Somente admin ou operacao podem cancelar pedidos pendentes.');
      }
      if (order.status === ORDER_STATUS.PRODUCAO || order.status === ORDER_STATUS.LOGISTICA) {
        return fail('Somente admin pode cancelar pedidos em producao ou logistica.');
      }
      return fail('Cancelamento nao permitido para esta etapa.');
    }
    if (!window.confirm('Tem certeza que deseja cancelar este pedido?')) {
      return { success: false, error: 'Acao cancelada pelo usuario.' };
    }
    return updateOrderStatus(orderId, ORDER_STATUS.CANCELADO, { reason: 'cancelled-by-user' });
  };

  const setOrderLogisticsStep = async (orderId, step) => {
    clearLastError();
    if (!canWrite) return fail('Sem permissão para registrar etapa logística.');

    if (isRemoteSyncEnabled) {
      const result = await setLogisticsStepRemote(orderId, step);
      if (!result.success) return fail(result.error);
      applyRemoteSnapshot(result.data || {});
      return { success: true };
    }

    const index = orders.findIndex((o) => o.id === orderId);
    if (index < 0) return fail('Pedido nao encontrado.');
    const order = orders[index];
    if (order.status !== ORDER_STATUS.LOGISTICA) {
      return fail('Etapa logistica so pode ser registrada com pedido em logistica.');
    }

    const reason = `dispatch:${step}`;
    const updatedOrder = {
      ...order,
      history: [...(order.history || []), { at: nowIso(), from: order.status, to: order.status, reason }],
    };

    const nextOrders = [...orders];
    nextOrders[index] = updatedOrder;
    setOrders(nextOrders);
    addAudit('order.logistics-step', 'order', order, updatedOrder, reason);
    return { success: true, data: updatedOrder };
  };

  const startProductionOrder = async (productionOrderId) => {
    clearLastError();
    if (!canWrite) return fail('Sem permissão para iniciar OP.');
    if (!isRemoteSyncEnabled) return fail('Operacao exige backend remoto habilitado.');

    const result = await startProductionOrderRemote(productionOrderId);
    if (!result.success) return fail(result.error);
    applyRemoteSnapshot(result.data || {});
    return { success: true };
  };

  const finalizeProductionOrder = async (productionOrderId) => {
    clearLastError();
    if (!canWrite) return fail('Sem permissão para finalizar OP.');
    if (!isRemoteSyncEnabled) return fail('Operacao exige backend remoto habilitado.');

    const result = await finalizeProductionOrderRemote(productionOrderId);
    if (!result.success) return fail(result.error);
    applyRemoteSnapshot(result.data || {});
    return { success: true };
  };

  const cancelProductionOrder = async (productionOrderId) => {
    clearLastError();
    if (!canAdmin) return fail('Apenas admin pode cancelar OP.');
    if (!isRemoteSyncEnabled) return fail('Operacao exige backend remoto habilitado.');

    const result = await cancelProductionOrderRemote(productionOrderId);
    if (!result.success) return fail(result.error);
    applyRemoteSnapshot(result.data || {});
    return { success: true };
  };

  const performInventoryCount = async (payload) => {
    clearLastError();
    if (!canWrite) return fail('Sem permissão para inventario.');
    if (!isRemoteSyncEnabled) return fail('Operacao exige backend remoto habilitado.');

    const result = await inventoryCountRemote(payload);
    if (!result.success) return fail(result.error);
    applyRemoteSnapshot(result.data || {});
    return { success: true };
  };

  return (
    <StoreContext.Provider
      value={{
        products,
        equipments,
        metrics,
        orders,
        stockMoves,
        auditLogs,
        authContext,
        canWrite,
        canAdmin,
        lastError,
        clearLastError,
        getActiveProducts,
        getValorPatrimonial,
        getEstoqueVirtual,
        addStockMovement,
        produzirReceita,
        addOrUpdateProduct,
        deleteProduct,
        resetAllData,
        addOrder,
        deleteOrder,
        setOrderLogisticsStep,
        startProductionOrder,
        finalizeProductionOrder,
        cancelProductionOrder,
        performInventoryCount,
        updateOrderStatus,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}

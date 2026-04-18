export const ORDER_STATUS = {
  PENDENTE: 'pendente',
  PRODUCAO: 'producao',
  LOGISTICA: 'logistica',
  CONCLUIDO: 'concluido',
  CANCELADO: 'cancelado',
};

export const ALLOWED_TRANSITIONS = {
  [ORDER_STATUS.PENDENTE]: [ORDER_STATUS.PRODUCAO, ORDER_STATUS.CANCELADO],
  [ORDER_STATUS.PRODUCAO]: [ORDER_STATUS.LOGISTICA, ORDER_STATUS.CANCELADO],
  [ORDER_STATUS.LOGISTICA]: [ORDER_STATUS.CONCLUIDO, ORDER_STATUS.CANCELADO],
  [ORDER_STATUS.CONCLUIDO]: [],
  [ORDER_STATUS.CANCELADO]: [],
};

export function isTransitionAllowed(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

export function canCancelByRole(orderStatus, role) {
  const normalizedRole = (role || '').toString().trim().toLowerCase();
  const normalizedStatus = (orderStatus || '').toString().trim().toLowerCase();

  if (normalizedStatus === ORDER_STATUS.PENDENTE) {
    return normalizedRole === 'admin' || normalizedRole === 'operacao';
  }

  if (normalizedStatus === ORDER_STATUS.PRODUCAO || normalizedStatus === ORDER_STATUS.LOGISTICA) {
    return normalizedRole === 'admin';
  }

  return false;
}

export function getConversionFactor(unitUso, unitBase) {
  if (!unitUso || !unitBase || unitUso === unitBase) return 1;

  const massa = ['kg', 'g'];
  const volume = ['l', 'ml'];
  const count = ['unidade', 'dz'];

  const sameGroup =
    (massa.includes(unitUso) && massa.includes(unitBase)) ||
    (volume.includes(unitUso) && volume.includes(unitBase)) ||
    (count.includes(unitUso) && count.includes(unitBase));

  if (!sameGroup) return null;
  if (unitUso === 'g' && unitBase === 'kg') return 0.001;
  if (unitUso === 'kg' && unitBase === 'g') return 1000;
  if (unitUso === 'ml' && unitBase === 'l') return 0.001;
  if (unitUso === 'l' && unitBase === 'ml') return 1000;
  if (unitUso === 'unidade' && unitBase === 'dz') return 1 / 12;
  if (unitUso === 'dz' && unitBase === 'unidade') return 12;
  return 1;
}

export function consumeFromLotesAtomic(lotesInput, requestedQty, forcedLoteId = null) {
  const lotes = JSON.parse(JSON.stringify(Array.isArray(lotesInput) ? lotesInput : []));
  let pending = Number(requestedQty);
  const allocations = [];

  const validadeRank = (validade) => {
    if (!validade) return Number.POSITIVE_INFINITY;
    const d = new Date(validade);
    if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
    return d.getTime();
  };

  const sortLotesForPicking = (items) =>
    items
      .map((item, index) => ({ ...item, __idx: index }))
      .sort((a, b) => {
        const ra = validadeRank(a.validade);
        const rb = validadeRank(b.validade);
        if (ra !== rb) return ra - rb;
        return a.__idx - b.__idx;
      });

  if (!Number.isFinite(pending) || pending <= 0) {
    return { success: false, error: 'Quantidade solicitada invalida.' };
  }

  if (forcedLoteId) {
    const index = lotes.findIndex((l) => l.loteId === forcedLoteId);
    if (index < 0) {
      return { success: false, error: 'Lote informado nao encontrado para saida.' };
    }

    const available = Number(lotes[index].qtd) || 0;
    if (available < pending) {
      return { success: false, error: 'Quantidade insuficiente no lote informado.' };
    }

    lotes[index].qtd = Number((available - pending).toFixed(6));
    allocations.push({ loteId: forcedLoteId, qty: pending });
    pending = 0;
  } else {
    const orderedLotes = sortLotesForPicking(lotes);
    for (let i = 0; i < orderedLotes.length && pending > 0; i += 1) {
      const available = Number(orderedLotes[i].qtd) || 0;
      if (available <= 0) continue;
      const take = Math.min(available, pending);
      orderedLotes[i].qtd = Number((available - take).toFixed(6));
      pending = Number((pending - take).toFixed(6));
      allocations.push({ loteId: orderedLotes[i].loteId, qty: take });
    }

    const byId = new Map(orderedLotes.map((l) => [l.loteId, l]));
    for (let i = 0; i < lotes.length; i += 1) {
      const updated = byId.get(lotes[i].loteId);
      if (updated) {
        lotes[i].qtd = Number(updated.qtd || 0);
      }
    }
  }

  if (pending > 0) {
    return { success: false, error: 'Estoque insuficiente para concluir a movimentacao.' };
  }

  return {
    success: true,
    lotes: lotes.filter((l) => Number(l.qtd) > 0),
    allocations,
  };
}

export function restoreConsumedLote(lotesInput, loteId, qty) {
  const lotes = JSON.parse(JSON.stringify(Array.isArray(lotesInput) ? lotesInput : []));
  const amount = Number(qty) || 0;
  const idx = lotes.findIndex((l) => l.loteId === loteId);
  if (idx < 0) {
    lotes.push({ loteId, qtd: amount, validade: '2099-12-31' });
  } else {
    lotes[idx].qtd = Number((Number(lotes[idx].qtd || 0) + amount).toFixed(6));
  }
  return lotes;
}

export function revertProducedOutputFromLotes(lotesInput, qtyToRemove, preferredLoteId = null) {
  const lotes = JSON.parse(JSON.stringify(Array.isArray(lotesInput) ? lotesInput : []));
  const total = lotes.reduce((acc, l) => acc + (Number(l.qtd) || 0), 0);
  const requested = Number(qtyToRemove);

  if (!Number.isFinite(requested) || requested <= 0) {
    return { success: false, error: 'Quantidade invalida para estorno de producao.' };
  }

  if (total < requested) {
    return { success: false, error: 'Nao ha estoque suficiente do produto final para estornar cancelamento.' };
  }

  let pending = requested;
  const targetIndex = preferredLoteId ? lotes.findIndex((l) => l.loteId === preferredLoteId) : -1;

  if (targetIndex >= 0) {
    const available = Number(lotes[targetIndex].qtd) || 0;
    const take = Math.min(available, pending);
    lotes[targetIndex].qtd = Number((available - take).toFixed(6));
    pending = Number((pending - take).toFixed(6));
  }

  for (let i = 0; i < lotes.length && pending > 0; i += 1) {
    if (i === targetIndex) continue;
    const available = Number(lotes[i].qtd) || 0;
    if (available <= 0) continue;
    const take = Math.min(available, pending);
    lotes[i].qtd = Number((available - take).toFixed(6));
    pending = Number((pending - take).toFixed(6));
  }

  if (pending > 0) {
    return { success: false, error: 'Falha ao estornar lote final produzido.' };
  }

  return {
    success: true,
    lotes: lotes.filter((l) => Number(l.qtd) > 0),
  };
}

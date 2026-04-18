import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUS,
  canCancelByRole,
  consumeFromLotesAtomic,
  getConversionFactor,
  isTransitionAllowed,
  restoreConsumedLote,
  revertProducedOutputFromLotes,
} from './businessRules';

describe('businessRules', () => {
  it('valida transicoes de status permitidas e bloqueadas', () => {
    expect(isTransitionAllowed(ORDER_STATUS.PENDENTE, ORDER_STATUS.PRODUCAO)).toBe(true);
    expect(isTransitionAllowed(ORDER_STATUS.PENDENTE, ORDER_STATUS.LOGISTICA)).toBe(false);
    expect(isTransitionAllowed(ORDER_STATUS.CONCLUIDO, ORDER_STATUS.CANCELADO)).toBe(false);
  });

  it('calcula conversoes de unidade corretamente', () => {
    expect(getConversionFactor('g', 'kg')).toBe(0.001);
    expect(getConversionFactor('kg', 'g')).toBe(1000);
    expect(getConversionFactor('dz', 'unidade')).toBe(12);
    expect(getConversionFactor('kg', 'ml')).toBeNull();
  });

  it('aplica matriz de cancelamento por papel e etapa', () => {
    expect(canCancelByRole(ORDER_STATUS.PENDENTE, 'operacao')).toBe(true);
    expect(canCancelByRole(ORDER_STATUS.PENDENTE, 'admin')).toBe(true);
    expect(canCancelByRole(ORDER_STATUS.PRODUCAO, 'operacao')).toBe(false);
    expect(canCancelByRole(ORDER_STATUS.PRODUCAO, 'admin')).toBe(true);
    expect(canCancelByRole(ORDER_STATUS.LOGISTICA, 'operacao')).toBe(false);
    expect(canCancelByRole(ORDER_STATUS.LOGISTICA, 'admin')).toBe(true);
    expect(canCancelByRole(ORDER_STATUS.CONCLUIDO, 'admin')).toBe(false);
  });

  it('faz baixa atomica em lotes com FIFO', () => {
    const input = [
      { loteId: 'L1', qtd: 2 },
      { loteId: 'L2', qtd: 3 },
    ];
    const result = consumeFromLotesAtomic(input, 4);

    expect(result.success).toBe(true);
    expect(result.allocations).toEqual([
      { loteId: 'L1', qty: 2 },
      { loteId: 'L2', qty: 2 },
    ]);
    expect(result.lotes).toEqual([{ loteId: 'L2', qtd: 1 }]);
  });

  it('prioriza FEFO quando lotes possuem validade', () => {
    const input = [
      { loteId: 'L1', qtd: 3, validade: '2026-12-31' },
      { loteId: 'L2', qtd: 3, validade: '2026-06-01' },
      { loteId: 'L3', qtd: 3, validade: '2027-01-01' },
    ];

    const result = consumeFromLotesAtomic(input, 4);

    expect(result.success).toBe(true);
    expect(result.allocations).toEqual([
      { loteId: 'L2', qty: 3 },
      { loteId: 'L1', qty: 1 },
    ]);
    expect(result.lotes).toEqual([
      { loteId: 'L1', qtd: 2, validade: '2026-12-31' },
      { loteId: 'L3', qtd: 3, validade: '2027-01-01' },
    ]);
  });

  it('falha baixa atomica quando estoque nao cobre o total', () => {
    const input = [{ loteId: 'L1', qtd: 1.5 }];
    const result = consumeFromLotesAtomic(input, 2);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Estoque insuficiente/i);
    expect(input).toEqual([{ loteId: 'L1', qtd: 1.5 }]);
  });

  it('restaura lote consumido no estorno de consumo', () => {
    const input = [{ loteId: 'L1', qtd: 1 }];
    const restored = restoreConsumedLote(input, 'L1', 0.5);
    const restoredNew = restoreConsumedLote(restored, 'L2', 2);

    expect(restored).toEqual([{ loteId: 'L1', qtd: 1.5 }]);
    expect(restoredNew).toEqual([
      { loteId: 'L1', qtd: 1.5 },
      { loteId: 'L2', qtd: 2, validade: '2099-12-31' },
    ]);
  });

  it('estorna producao priorizando lote produzido e depois demais lotes', () => {
    const input = [
      { loteId: 'LP', qtd: 1 },
      { loteId: 'L2', qtd: 3 },
    ];

    const result = revertProducedOutputFromLotes(input, 2.5, 'LP');

    expect(result.success).toBe(true);
    expect(result.lotes).toEqual([{ loteId: 'L2', qtd: 1.5 }]);
  });

  it('falha estorno de producao sem estoque suficiente', () => {
    const result = revertProducedOutputFromLotes([{ loteId: 'LP', qtd: 1 }], 5, 'LP');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/estoque suficiente/i);
  });
});

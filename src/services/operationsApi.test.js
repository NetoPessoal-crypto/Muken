import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import {
  createOrderRemote,
  stockMoveRemote,
  completeOrderRemote,
} from './operationsApi';

describe('operationsApi', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('chama RPC de criacao de pedido com payload normalizado', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null });

    const result = await createOrderRemote({
      cliente: 'Cliente Teste',
      produtoFinalId: 'PROD-001',
      quantidade: '12',
      prazo: '2026-05-01',
    });

    expect(rpcMock).toHaveBeenCalledWith('beca_create_order', {
      p_cliente: 'Cliente Teste',
      p_produto_final_id: 'PROD-001',
      p_quantidade: 12,
      p_prazo: '2026-05-01',
    });
    expect(result).toEqual({ success: true, data: { ok: true } });
  });

  it('chama RPC de movimentacao de estoque com campos opcionais', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null });

    const result = await stockMoveRemote({
      productId: 'ING-001',
      type: 'ENTRADA',
      qty: '5.5',
      reason: 'reposicao',
      loteId: 'L-NEW',
      validade: '2026-08-20',
    });

    expect(rpcMock).toHaveBeenCalledWith('beca_stock_move', {
      p_product_id: 'ING-001',
      p_move_type: 'ENTRADA',
      p_qty: 5.5,
      p_reason: 'reposicao',
      p_lote_id: 'L-NEW',
      p_validade: '2026-08-20',
    });
    expect(result).toEqual({ success: true, data: { ok: true } });
  });

  it('retorna erro padronizado quando RPC de conclusao falha', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'falha-backend' } });

    const result = await completeOrderRemote('ORD-123', 'qa-check');

    expect(rpcMock).toHaveBeenCalledWith('beca_complete_order', {
      p_order_id: 'ORD-123',
      p_reason: 'qa-check',
    });
    expect(result).toEqual({ success: false, error: 'falha-backend' });
  });
});

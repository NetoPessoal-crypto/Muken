import React, { useMemo, useState } from 'react';
import { useStore } from '../contexts/StoreContext';
import { useFeedback } from '../contexts/FeedbackContext';

export default function Inventario() {
  const { products, getEstoqueVirtual, performInventoryCount } = useStore();
  const { notifyError } = useFeedback();
  const [form, setForm] = useState({ productId: '', physicalQty: '', loteId: '', reason: 'inventario-ciclico' });

  const runAction = async (resultOrPromise) => {
    const result = await Promise.resolve(resultOrPromise);
    if (!result?.success && result?.error) notifyError(result.error);
    return result?.success;
  };

  const activeProducts = useMemo(
    () => products.filter((p) => p.ativo !== false && (p.type === 'ingrediente' || p.type === 'embalagem' || p.type === 'produto_final')),
    [products]
  );

  const selected = activeProducts.find((p) => p.id === form.productId);
  const systemQty = selected ? Number(getEstoqueVirtual(selected.id)) : 0;
  const physicalQty = Number(form.physicalQty || 0);
  const diff = Number((physicalQty - systemQty).toFixed(6));

  const submit = async () => {
    if (!form.productId) return;
    const ok = await runAction(performInventoryCount({
      productId: form.productId,
      physicalQty,
      loteId: form.loteId,
      reason: form.reason,
    }));
    if (ok) {
      setForm((prev) => ({ ...prev, physicalQty: '', loteId: '' }));
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="bg-white border border-surface-container rounded-3xl p-8">
        <p className="text-[10px] font-black uppercase tracking-[2px] text-primary/40">Inventario Cíclico</p>
        <h1 className="text-2xl font-black text-primary mt-2">Contagem fisica com ajuste controlado</h1>
        <p className="text-sm text-primary/60 mt-2">Ao confirmar, o sistema gera movimento AJUSTE auditado com justificativa.</p>
      </div>

      <div className="bg-white border border-surface-container rounded-3xl p-8 space-y-5">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-primary/40">Produto</label>
          <select
            value={form.productId}
            onChange={(e) => setForm((prev) => ({ ...prev, productId: e.target.value }))}
            className="w-full mt-1 bg-white border-2 border-primary/10 py-3 px-4 rounded-xl outline-none text-sm"
          >
            <option value="">Selecione...</option>
            {activeProducts.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-primary/40">Quantidade fisica</label>
            <input
              type="number"
              step="0.001"
              value={form.physicalQty}
              onChange={(e) => setForm((prev) => ({ ...prev, physicalQty: e.target.value }))}
              className="w-full mt-1 bg-white border-2 border-primary/10 py-3 px-4 rounded-xl outline-none text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-primary/40">Lote (opcional)</label>
            <input
              type="text"
              value={form.loteId}
              onChange={(e) => setForm((prev) => ({ ...prev, loteId: e.target.value }))}
              className="w-full mt-1 bg-white border-2 border-primary/10 py-3 px-4 rounded-xl outline-none text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-primary/40">Justificativa</label>
          <input
            type="text"
            value={form.reason}
            onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
            className="w-full mt-1 bg-white border-2 border-primary/10 py-3 px-4 rounded-xl outline-none text-sm"
          />
        </div>

        {selected && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-surface-bright rounded-xl p-4 border border-surface-container">
              <p className="text-[10px] uppercase tracking-widest text-primary/40 font-black">Sistema</p>
              <p className="font-black text-primary mt-1">{systemQty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {selected.unit}</p>
            </div>
            <div className="bg-surface-bright rounded-xl p-4 border border-surface-container">
              <p className="text-[10px] uppercase tracking-widest text-primary/40 font-black">Fisico</p>
              <p className="font-black text-primary mt-1">{physicalQty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {selected.unit}</p>
            </div>
            <div className="bg-surface-bright rounded-xl p-4 border border-surface-container">
              <p className="text-[10px] uppercase tracking-widest text-primary/40 font-black">Diferenca (ajuste)</p>
              <p className={`font-black mt-1 ${diff < 0 ? 'text-error' : diff > 0 ? 'text-secondary' : 'text-primary'}`}>
                {diff.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {selected.unit}
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={submit}
            disabled={!form.productId || form.physicalQty === '' || !form.reason.trim()}
            className="bg-primary text-white font-black text-xs uppercase tracking-widest px-6 py-3 rounded-xl disabled:opacity-50"
          >
            Confirmar Contagem
          </button>
        </div>
      </div>
    </div>
  );
}

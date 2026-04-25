import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStore } from '../contexts/StoreContext';
import { getLotGenealogyRemote } from '../services/operationsApi';

const ORDER_STATUS_LABEL = {
  pendente: 'Pendente',
  producao: 'Produção',
  logistica: 'Logística',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const ORDER_STATUS_COLORS = {
  pendente: '#C9826A',
  producao: '#7A4B3A',
  logistica: '#E07A5F',
  concluido: '#5A8F62',
  cancelado: '#B94A48',
};

const DAY_MS = 24 * 60 * 60 * 1000;

const asNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const dateOnly = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const toDayLabel = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

export default function Relatorio() {
  const { orders, products, stockMoves, getEstoqueVirtual, getValorPatrimonial } = useStore();
  const [geneQuery, setGeneQuery] = React.useState('');
  const [geneResult, setGeneResult] = React.useState(null);
  const [geneLoading, setGeneLoading] = React.useState(false);
  const [geneError, setGeneError] = React.useState(null);

  const handleGeneQuery = React.useCallback(async () => {
    const q = String(geneQuery || '').trim();
    if (!q) {
      setGeneError('Informe um loteId ou orderId para buscar.');
      setGeneResult(null);
      return;
    }

    setGeneLoading(true);
    setGeneError(null);
    setGeneResult(null);
    try {
      // consulta por loteId primeiro
      let res = await getLotGenealogyRemote({ loteId: q });
      if (res.success && Array.isArray(res.data) && res.data.length === 0) {
        // fallback: buscar por orderId
        res = await getLotGenealogyRemote({ orderId: q });
      }

      if (!res.success) {
        setGeneError(res.error || 'Erro na consulta');
        setGeneResult(null);
      } else {
        setGeneResult(res.data || []);
      }
    } catch (err) {
      setGeneError(err?.message || 'Erro inesperado');
      setGeneResult(null);
    } finally {
      setGeneLoading(false);
    }
  }, [geneQuery]);

  const ordersByStatus = useMemo(() => {
    const base = ['pendente', 'producao', 'logistica', 'concluido', 'cancelado'].map((status) => ({
      status,
      label: ORDER_STATUS_LABEL[status],
      total: 0,
    }));

    orders.forEach((order) => {
      const index = base.findIndex((item) => item.status === order.status);
      if (index >= 0) {
        base[index].total += 1;
      }
    });

    return base;
  }, [orders]);

  const ruptureItems = useMemo(() => {
    return products
      .filter((p) => p.ativo !== false && (p.type === 'ingrediente' || p.type === 'embalagem'))
      .map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        qty: asNumber(getEstoqueVirtual(p.id)),
      }))
      .filter((item) => item.qty <= 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [products, getEstoqueVirtual]);

  const nearExpiryLots = useMemo(() => {
    const now = dateOnly(new Date());
    const limitDate = new Date(now.getTime() + 30 * DAY_MS);

    return products
      .flatMap((product) => {
        const lots = Array.isArray(product.lotes) ? product.lotes : [];
        return lots.map((lot) => {
          const expiry = dateOnly(lot.validade);
          if (!expiry) return null;

          const qty = asNumber(lot.qtd);
          const isInWindow = expiry >= now && expiry <= limitDate;
          if (!isInWindow || qty <= 0) return null;

          return {
            productId: product.id,
            productName: product.name,
            loteId: lot.loteId,
            qty,
            unit: product.unit,
            validade: expiry,
            diasParaVencer: Math.ceil((expiry.getTime() - now.getTime()) / DAY_MS),
          };
        });
      })
      .filter(Boolean)
      .sort((a, b) => a.validade.getTime() - b.validade.getTime());
  }, [products]);

  const consumptionLast7Days = useMemo(() => {
    const today = dateOnly(new Date());
    const buckets = [];

    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(today.getTime() - i * DAY_MS);
      buckets.push({
        key: d.toISOString().slice(0, 10),
        dia: toDayLabel(d),
        consumo: 0,
      });
    }

    const indexByKey = new Map(buckets.map((item, idx) => [item.key, idx]));

    stockMoves
      .filter((move) => move.kind === 'CONSUMO')
      .forEach((move) => {
        const d = dateOnly(move.at);
        if (!d) return;
        const key = d.toISOString().slice(0, 10);
        const idx = indexByKey.get(key);
        if (idx === undefined) return;
        buckets[idx].consumo += asNumber(move.qty);
      });

    return buckets.map((item) => ({ ...item, consumo: Number(item.consumo.toFixed(3)) }));
  }, [stockMoves]);

  const totals = useMemo(() => {
    const pedidosAtivos = orders.filter((o) => o.status !== 'concluido' && o.status !== 'cancelado').length;
    const pedidosConcluidos = orders.filter((o) => o.status === 'concluido').length;
    const consumoPeriodo = consumptionLast7Days.reduce((acc, item) => acc + asNumber(item.consumo), 0);

    return {
      pedidosAtivos,
      pedidosConcluidos,
      rupturas: ruptureItems.length,
      vencimentosProximos: nearExpiryLots.length,
      consumo7d: Number(consumoPeriodo.toFixed(3)),
      valorEstoque: Number(getValorPatrimonial().toFixed(2)),
    };
  }, [orders, ruptureItems, nearExpiryLots, consumptionLast7Days, getValorPatrimonial]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="bg-white border border-surface-container rounded-3xl p-8">
        <p className="text-[10px] font-black uppercase tracking-[2px] text-primary/40">Relatórios 80/20</p>
        <h1 className="text-2xl font-black text-primary mt-2">Indicadores operacionais em tempo real</h1>
        <p className="text-sm text-primary/60 mt-2">Dados extraídos do estado atual do sistema (pedidos, estoque, lotes e movimentações).</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <div className="bg-white border border-surface-container rounded-2xl p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">Pedidos Ativos</p>
          <p className="text-3xl font-black text-primary mt-2">{totals.pedidosAtivos}</p>
        </div>
        <div className="bg-white border border-surface-container rounded-2xl p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">Concluídos</p>
          <p className="text-3xl font-black text-secondary mt-2">{totals.pedidosConcluidos}</p>
        </div>
        <div className="bg-white border border-surface-container rounded-2xl p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">Itens em Ruptura</p>
          <p className="text-3xl font-black text-error mt-2">{totals.rupturas}</p>
        </div>
        <div className="bg-white border border-surface-container rounded-2xl p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">Venc. em 30d</p>
          <p className="text-3xl font-black text-tertiary mt-2">{totals.vencimentosProximos}</p>
        </div>
        <div className="bg-white border border-surface-container rounded-2xl p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">Consumo (7d)</p>
          <p className="text-3xl font-black text-primary mt-2">{totals.consumo7d}</p>
        </div>
        <div className="bg-white border border-surface-container rounded-2xl p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">Valor em Estoque</p>
          <p className="text-2xl font-black text-primary mt-2">
            {totals.valorEstoque.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-surface-container rounded-3xl p-6">
          <h2 className="text-base font-black text-primary mb-4">Pedidos por status</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ordersByStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="#efe5e2" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                  {ordersByStatus.map((entry) => (
                    <Cell key={entry.status} fill={ORDER_STATUS_COLORS[entry.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-surface-container rounded-3xl p-6">
          <h2 className="text-base font-black text-primary mb-4">Distribuição dos pedidos</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ordersByStatus.filter((item) => item.total > 0)}
                  dataKey="total"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label
                >
                  {ordersByStatus
                    .filter((item) => item.total > 0)
                    .map((entry) => (
                      <Cell key={`pie-${entry.status}`} fill={ORDER_STATUS_COLORS[entry.status]} />
                    ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-surface-container rounded-3xl p-6">
          <h2 className="text-base font-black text-primary mb-4">Consumo de insumos (últimos 7 dias)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={consumptionLast7Days}>
                <CartesianGrid strokeDasharray="3 3" stroke="#efe5e2" />
                <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="consumo" stroke="#7A4B3A" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-surface-container rounded-3xl p-6">
          <h2 className="text-base font-black text-primary mb-4">Itens em ruptura</h2>
          <div className="space-y-3 max-h-72 overflow-auto pr-1">
            {ruptureItems.length === 0 ? (
              <p className="text-sm text-primary/50">Nenhum item em ruptura no momento.</p>
            ) : (
              ruptureItems.map((item) => (
                <div key={item.id} className="bg-surface-bright rounded-xl px-4 py-3 border border-surface-container">
                  <p className="text-sm font-bold text-primary truncate">{item.name}</p>
                  <p className="text-xs text-error font-semibold mt-1">Saldo: {item.qty.toLocaleString('pt-BR')} {item.unit}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-surface-container rounded-3xl p-6">
        <h2 className="text-base font-black text-primary mb-4">Lotes com vencimento próximo (30 dias)</h2>
        {nearExpiryLots.length === 0 ? (
          <p className="text-sm text-primary/50">Nenhum lote com vencimento nos próximos 30 dias.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-primary/40">
                  <th className="py-3 pr-4">Produto</th>
                  <th className="py-3 pr-4">Lote</th>
                  <th className="py-3 pr-4">Quantidade</th>
                  <th className="py-3 pr-4">Validade</th>
                  <th className="py-3">Dias</th>
                </tr>
              </thead>
              <tbody>
                {nearExpiryLots.map((lot) => (
                  <tr key={`${lot.productId}-${lot.loteId}`} className="border-t border-surface-container/70">
                    <td className="py-3 pr-4 font-semibold text-primary">{lot.productName}</td>
                    <td className="py-3 pr-4 text-primary/70">{lot.loteId}</td>
                    <td className="py-3 pr-4 text-primary/80">{lot.qty.toLocaleString('pt-BR')} {lot.unit}</td>
                    <td className="py-3 pr-4 text-primary/80">{lot.validade.toLocaleDateString('pt-BR')}</td>
                    <td className="py-3 text-tertiary font-bold">{lot.diasParaVencer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-surface-container rounded-3xl p-6">
        <h2 className="text-base font-black text-primary mb-4">Rastreabilidade de Lote</h2>
        <div className="flex gap-2 items-center">
          <input value={geneQuery} onChange={(e) => setGeneQuery(e.target.value)} placeholder="Informe loteId ou orderId" className="border px-3 py-2 rounded-lg flex-1" />
          <button onClick={handleGeneQuery} className="bg-primary text-white px-4 py-2 rounded-lg">Buscar</button>
        </div>
        <div className="mt-4">
          {geneLoading ? (
            <p className="text-sm text-primary/60">Carregando...</p>
          ) : geneResult == null ? (
            <p className="text-sm text-primary/50">Nenhuma consulta realizada.</p>
          ) : geneError ? (
            <p className="text-sm text-error">Erro: {geneError}</p>
          ) : Array.isArray(geneResult) && geneResult.length === 0 ? (
            <p className="text-sm text-primary/50">Nenhum registro encontrado.</p>
          ) : (
            <div className="overflow-auto max-h-60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-widest text-primary/40">
                    <th className="py-2 pr-4">Parent Lot</th>
                    <th className="py-2 pr-4">Child Lot</th>
                    <th className="py-2 pr-4">Qty</th>
                    <th className="py-2 pr-4">Unit</th>
                    <th className="py-2 pr-4">Order</th>
                    <th className="py-2 pr-4">At</th>
                  </tr>
                </thead>
                <tbody>
                  {geneResult.map((g) => (
                    <tr key={g.id} className="border-t border-surface-container/70">
                      <td className="py-2 pr-4 font-semibold text-primary">{g.parent_lot_id}</td>
                      <td className="py-2 pr-4 text-primary/70">{g.child_lot_id}</td>
                      <td className="py-2 pr-4 text-primary/80">{Number(g.qty_used)}</td>
                      <td className="py-2 pr-4 text-primary/80">{g.unit}</td>
                      <td className="py-2 pr-4 text-primary/80">{g.order_id}</td>
                      <td className="py-2 pr-4 text-primary/80">{new Date(g.at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

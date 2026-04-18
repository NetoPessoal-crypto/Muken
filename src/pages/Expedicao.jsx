import React from 'react';
import { useStore } from '../contexts/StoreContext';
import { useFeedback } from '../contexts/FeedbackContext';

const STAGE_LABEL = {
  pendente: 'Pendente',
  separado: 'Separado',
  conferido: 'Conferido',
  expedido: 'Expedido',
};

export default function Expedicao() {
  const { orders, products, setOrderLogisticsStep, updateOrderStatus } = useStore();
  const { notifyError } = useFeedback();

  const runAction = async (resultOrPromise) => {
    const result = await Promise.resolve(resultOrPromise);
    if (!result?.success && result?.error) notifyError(result.error);
    return result?.success;
  };

  const getProductName = (id) => {
    const p = products.find((prod) => prod.id === id);
    return p ? p.name : 'Produto Desconhecido';
  };

  const getLogisticsStage = (order) => {
    const history = Array.isArray(order.history) ? order.history : [];
    const reasons = history.map((item) => item?.reason).filter(Boolean);
    if (reasons.includes('dispatch:expedido')) return 'expedido';
    if (reasons.includes('dispatch:conferido')) return 'conferido';
    if (reasons.includes('dispatch:separado')) return 'separado';
    return 'pendente';
  };

  const logisticsOrders = orders
    .filter((o) => o.status === 'logistica')
    .map((order) => ({ ...order, stage: getLogisticsStage(order) }));

  const byStage = {
    pendente: logisticsOrders.filter((o) => o.stage === 'pendente'),
    separado: logisticsOrders.filter((o) => o.stage === 'separado'),
    conferido: logisticsOrders.filter((o) => o.stage === 'conferido'),
    expedido: logisticsOrders.filter((o) => o.stage === 'expedido'),
  };

  const renderCard = (order) => (
    <div key={order.id} className="bg-white p-6 rounded-2xl border border-surface-container shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-primary">{order.cliente}</p>
          <p className="text-[11px] text-primary/50 mt-1">ID: {order.id}</p>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-tertiary bg-tertiary/10 px-3 py-1 rounded-full">
          {STAGE_LABEL[order.stage]}
        </span>
      </div>

      <div className="mt-4 p-3 rounded-xl bg-surface-bright text-xs text-primary/70">
        {order.quantidade} unid. de {getProductName(order.produtoFinalId)}
      </div>

      <div className="mt-4">
        {order.stage === 'pendente' && (
          <button
            onClick={() => { void runAction(setOrderLogisticsStep(order.id, 'separado')); }}
            className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-tertiary text-tertiary hover:bg-tertiary hover:text-white"
          >
            Registrar Separacao
          </button>
        )}
        {order.stage === 'separado' && (
          <button
            onClick={() => { void runAction(setOrderLogisticsStep(order.id, 'conferido')); }}
            className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-tertiary text-tertiary hover:bg-tertiary hover:text-white"
          >
            Registrar Conferencia
          </button>
        )}
        {order.stage === 'conferido' && (
          <button
            onClick={() => { void runAction(setOrderLogisticsStep(order.id, 'expedido')); }}
            className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-tertiary text-white hover:bg-tertiary/80"
          >
            Registrar Expedicao
          </button>
        )}
        {order.stage === 'expedido' && (
          <button
            onClick={() => { void runAction(updateOrderStatus(order.id, 'concluido')); }}
            className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-secondary text-secondary hover:bg-secondary hover:text-white"
          >
            Concluir Entrega
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="bg-white border border-surface-container rounded-3xl p-8">
        <p className="text-[10px] font-black uppercase tracking-[2px] text-primary/40">Logistica Operacional</p>
        <h1 className="text-2xl font-black text-primary mt-2">Expedicao com checklist obrigatorio</h1>
        <p className="text-sm text-primary/60 mt-2">Fluxo: separado {'->'} conferido {'->'} expedido {'->'} concluido.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {['pendente', 'separado', 'conferido', 'expedido'].map((stage) => (
          <div key={stage} className="bg-white border border-surface-container rounded-2xl p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">{STAGE_LABEL[stage]}</p>
            <p className="text-3xl font-black text-primary mt-2">{byStage[stage].length}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {logisticsOrders.length === 0 ? (
          <div className="bg-white border border-surface-container rounded-2xl p-8 text-sm text-primary/50">Nenhum pedido em logística no momento.</div>
        ) : (
          logisticsOrders.map(renderCard)
        )}
      </div>
    </div>
  );
}

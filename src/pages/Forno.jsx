import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../contexts/StoreContext';
import { useFeedback } from '../contexts/FeedbackContext';
import {
  listProductionOrdersRemote,
  listEquipmentEventsRemote,
  logEquipmentEventRemote,
} from '../services/operationsApi';

export default function Forno() {
  const { equipments, orders, startProductionOrder, finalizeProductionOrder, cancelProductionOrder } = useStore();
  const { notifyError } = useFeedback();
  const [productionOrders, setProductionOrders] = useState([]);
  const [equipmentEvents, setEquipmentEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshData = async () => {
    const [opsResult, eventsResult] = await Promise.all([
      listProductionOrdersRemote(),
      listEquipmentEventsRemote(null, 150),
    ]);

    if (!opsResult.success) {
      return { success: false, error: opsResult.error || 'Falha ao carregar ordens de producao.' };
    }

    setProductionOrders(opsResult.data || []);
    if (eventsResult.success) {
      setEquipmentEvents(eventsResult.data || []);
    }

    return { success: true };
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      const result = await refreshData();
      if (!active) return;
      if (!result.success) {
        setError(result.error || 'Falha ao carregar ordens de producao.');
        setLoading(false);
        return;
      }
      setLoading(false);
    };

    load();
    const timer = setInterval(load, 15000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const runAction = async (resultOrPromise) => {
    const result = await Promise.resolve(resultOrPromise);
    if (!result?.success && result?.error) {
      notifyError(result.error);
      return false;
    }

    const refreshed = await refreshData();
    if (!refreshed.success && refreshed.error) {
      setError(refreshed.error);
    }
    return true;
  };

  const runEquipmentEvent = async (equipment, eventType) => {
    const result = await logEquipmentEventRemote({
      equipmentId: equipment.id,
      eventType,
      note: `forno:${eventType}`,
      metadata: {
        equipmentName: equipment.name,
        source: 'forno-ui',
      },
    });

    if (!result.success) {
      notifyError(result.error || 'Falha ao registrar evento de equipamento.');
      return;
    }

    const refreshed = await refreshData();
    if (!refreshed.success && refreshed.error) {
      setError(refreshed.error);
    }
  };

  const latestEventByEquipment = useMemo(() => {
    const map = new Map();
    equipmentEvents.forEach((event) => {
      if (!map.has(event.equipmentId)) {
        map.set(event.equipmentId, event);
      }
    });
    return map;
  }, [equipmentEvents]);

  const recentEvents = useMemo(() => equipmentEvents.slice(0, 12), [equipmentEvents]);

  const opsSummary = useMemo(() => {
    const emProducao = productionOrders.filter((op) => op.status === 'em_producao').length;
    const finalizadasHoje = productionOrders.filter((op) => {
      if (op.status !== 'finalizada' || !op.finished_at) return false;
      const d = new Date(op.finished_at);
      const t = new Date();
      return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
    }).length;

    const fornosAtivos = equipments.filter((e) => e.status === 'Normal').length;

    return {
      emProducao,
      finalizadasHoje,
      fornosAtivos,
      totalFornos: equipments.length,
      pedidosEmProducao: orders.filter((o) => o.status === 'producao').length,
    };
  }, [productionOrders, equipments, orders]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="bg-white border border-surface-container rounded-3xl p-8">
        <p className="text-[10px] font-black uppercase tracking-[2px] text-primary/40">Operacao Real</p>
        <h1 className="text-2xl font-black text-primary mt-2">Fornos e Ordens de Producao</h1>
        <p className="text-sm text-primary/60 mt-2">Painel ligado em dados operacionais do banco, com atualizacao periodica.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-white border border-surface-container rounded-2xl p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">OP em Produção</p>
          <p className="text-3xl font-black text-primary mt-2">{opsSummary.emProducao}</p>
        </div>
        <div className="bg-white border border-surface-container rounded-2xl p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">OP Finalizadas Hoje</p>
          <p className="text-3xl font-black text-secondary mt-2">{opsSummary.finalizadasHoje}</p>
        </div>
        <div className="bg-white border border-surface-container rounded-2xl p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">Pedidos em Produção</p>
          <p className="text-3xl font-black text-tertiary mt-2">{opsSummary.pedidosEmProducao}</p>
        </div>
        <div className="bg-white border border-surface-container rounded-2xl p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">Fornos Ativos</p>
          <p className="text-3xl font-black text-primary mt-2">{opsSummary.fornosAtivos}</p>
        </div>
        <div className="bg-white border border-surface-container rounded-2xl p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">Fornos Totais</p>
          <p className="text-3xl font-black text-primary mt-2">{opsSummary.totalFornos}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-surface-container rounded-3xl p-6">
          <h2 className="text-base font-black text-primary mb-4">Eventos de equipamentos</h2>
          <div className="space-y-4">
            {equipments.length === 0 ? (
              <p className="text-sm text-primary/50">Nenhum equipamento cadastrado.</p>
            ) : (
              equipments.map((equipment) => {
                const latest = latestEventByEquipment.get(equipment.id);
                return (
                  <div key={equipment.id} className="border border-surface-container rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-primary">{equipment.name}</p>
                        <p className="text-xs text-primary/50">Status atual: {equipment.status || 'N/A'}</p>
                        <p className="text-xs text-primary/50 mt-1">
                          Ultimo evento: {latest ? `${latest.eventType} em ${new Date(latest.at).toLocaleString('pt-BR')}` : 'sem eventos'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                      <button
                        onClick={() => { void runEquipmentEvent(equipment, 'parada'); }}
                        className="text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 rounded-lg py-2"
                      >
                        Parada
                      </button>
                      <button
                        onClick={() => { void runEquipmentEvent(equipment, 'manutencao'); }}
                        className="text-[10px] font-black uppercase tracking-widest bg-blue-100 text-blue-700 rounded-lg py-2"
                      >
                        Manutencao
                      </button>
                      <button
                        onClick={() => { void runEquipmentEvent(equipment, 'quebra'); }}
                        className="text-[10px] font-black uppercase tracking-widest bg-red-100 text-red-700 rounded-lg py-2"
                      >
                        Quebra
                      </button>
                      <button
                        onClick={() => { void runEquipmentEvent(equipment, 'retomada'); }}
                        className="text-[10px] font-black uppercase tracking-widest bg-green-100 text-green-700 rounded-lg py-2"
                      >
                        Retomada
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white border border-surface-container rounded-3xl p-6">
          <h2 className="text-base font-black text-primary mb-4">Timeline de eventos</h2>
          <div className="space-y-3 max-h-[460px] overflow-auto pr-1">
            {recentEvents.length === 0 ? (
              <p className="text-sm text-primary/50">Sem eventos registrados.</p>
            ) : (
              recentEvents.map((event) => (
                <div key={event.id} className="rounded-xl border border-surface-container p-3">
                  <p className="text-[10px] uppercase tracking-widest text-primary/40 font-black">{event.eventType}</p>
                  <p className="text-sm font-semibold text-primary mt-1">Equipamento: {event.equipmentId}</p>
                  <p className="text-xs text-primary/60 mt-1">{new Date(event.at).toLocaleString('pt-BR')}</p>
                  {event.note ? <p className="text-xs text-primary/60 mt-1">Nota: {event.note}</p> : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-surface-container rounded-3xl overflow-hidden">
        <div className="grid grid-cols-12 px-8 py-4 bg-surface-bright text-[10px] font-black uppercase tracking-widest text-primary/40">
          <div className="col-span-3">OP</div>
          <div className="col-span-3">Pedido / Cliente</div>
          <div className="col-span-2">Produto</div>
          <div className="col-span-1">Qtd</div>
          <div className="col-span-1">Fornadas</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1 text-right">Ação</div>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-primary/50">Carregando ordens de producao...</div>
        ) : error ? (
          <div className="p-8 text-sm text-error font-bold">{error}</div>
        ) : productionOrders.length === 0 ? (
          <div className="p-8 text-sm text-primary/50">Nenhuma ordem de producao encontrada.</div>
        ) : (
          productionOrders.map((op) => (
            <div key={op.id} className="grid grid-cols-12 items-center px-8 py-4 border-t border-surface-container/70 text-sm">
              <div className="col-span-3 font-semibold text-primary">{op.id}</div>
              <div className="col-span-3 text-primary/70">
                <p className="font-semibold">{op.order_id}</p>
                <p className="text-xs text-primary/50 truncate">{op.cliente}</p>
              </div>
              <div className="col-span-2 text-primary/70 truncate">{op.produto_final_nome}</div>
              <div className="col-span-1 text-primary/70">{Number(op.quantidade).toLocaleString('pt-BR')}</div>
              <div className="col-span-1 text-primary/70">{Number(op.fornadas).toLocaleString('pt-BR')}</div>
              <div className="col-span-1">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  op.status === 'em_producao'
                    ? 'bg-secondary/10 text-secondary'
                    : op.status === 'finalizada'
                      ? 'bg-green-100 text-green-700'
                      : op.status === 'cancelada'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-primary/10 text-primary'
                }`}>
                  {op.status}
                </span>
              </div>
              <div className="col-span-1 text-right text-primary/50 text-xs">
                {op.status === 'aberta' && (
                  <button
                    onClick={() => { void runAction(startProductionOrder(op.id)); }}
                    className="text-[10px] font-black uppercase tracking-widest text-secondary"
                  >
                    Iniciar
                  </button>
                )}
                {op.status === 'em_producao' && (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => { void runAction(finalizeProductionOrder(op.id)); }}
                      className="text-[10px] font-black uppercase tracking-widest text-primary"
                    >
                      Finalizar
                    </button>
                    <button
                      onClick={() => { void runAction(cancelProductionOrder(op.id)); }}
                      className="text-[10px] font-black uppercase tracking-widest text-error"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
                {op.status !== 'aberta' && op.status !== 'em_producao' && (
                  <span>{op.started_at ? new Date(op.started_at).toLocaleDateString('pt-BR') : '-'}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

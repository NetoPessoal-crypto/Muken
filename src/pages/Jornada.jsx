import React, { useState } from 'react';
import { useStore } from '../contexts/StoreContext';
import { useFeedback } from '../contexts/FeedbackContext';

export default function Jornada() {
  const { orders, products, updateOrderStatus, addOrder, setOrderLogisticsStep } = useStore();
  const { notifyError } = useFeedback();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ cliente: '', produtoFinalId: '', quantidade: 0, prazo: '' });
  const activeFinalProducts = products.filter(p => p.type === 'produto_final' && p.ativo !== false);

  const runAction = async (resultOrPromise) => {
    const result = await Promise.resolve(resultOrPromise);
    if (!result?.success && result?.error) notifyError(result.error);
    return result?.success;
  };

  const handleAdd = async () => {
    if (await runAction(addOrder(formData))) {
      setIsModalOpen(false);
      setFormData({ cliente: '', produtoFinalId: '', quantidade: 0, prazo: '' });
    }
  };

  const getProductName = (id) => {
    const p = products.find(prod => prod.id === id);
    return p ? p.name : 'Produto Desconhecido';
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const pendingOrders = orders.filter(o => o.status === 'pendente');
  const productionOrders = orders.filter(o => o.status === 'producao');
  const logisticsOrders = orders.filter(o => o.status === 'logistica');
  const completedOrders = orders.filter(o => {
    if (o.status !== 'concluido') return false;
    if (!o.data) return false;
    const orderDate = new Date(o.data);
    const today = new Date();
    return orderDate.getMonth() === today.getMonth() && orderDate.getFullYear() === today.getFullYear();
  });

  const getLogisticsStage = (order) => {
    const history = Array.isArray(order.history) ? order.history : [];
    const reasons = history.map((item) => item?.reason).filter(Boolean);
    if (reasons.includes('dispatch:expedido')) return 'expedido';
    if (reasons.includes('dispatch:conferido')) return 'conferido';
    if (reasons.includes('dispatch:separado')) return 'separado';
    return 'pendente';
  };

  return (
    <>
      <div className="flex gap-10 overflow-x-auto pb-12 no-scrollbar">
        {/* Coluna 1: Novo Pedido */}
        <section className="flex-shrink-0 w-[400px]">
          <div className="flex items-center justify-between mb-8 px-2">
            <h2 className="text-xl font-bold flex items-center gap-3">
              Novo Pedido
              <span className="bg-gray-200 text-primary text-[10px] px-3 py-1 rounded-full font-bold">{pendingOrders.length}</span>
            </h2>
            <button onClick={() => setIsModalOpen(true)} className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm hover:scale-105 transition-transform">
              <span className="material-symbols-outlined">add</span>
            </button>
          </div>
          
          <div className="flex flex-col gap-6">
            {pendingOrders.map(order => (
              <div key={order.id} className="bg-white p-8 rounded-lg shadow-[0px_24px_48px_rgba(16,20,26,0.04)] border border-transparent hover:border-gray-200 transition-all group">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-lg leading-tight group-hover:text-secondary transition-colors">{order.cliente}</h3>
                    <p className="text-gray-400 text-sm font-medium mt-1">ID: {order.id}</p>
                  </div>
                  <span className="bg-secondary/10 text-secondary text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Pendente</span>
                </div>
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-3 text-sm font-medium text-gray-600">
                    <span className="material-symbols-outlined text-gray-400 text-lg">calendar_today</span>
                    Criado: {formatDate(order.data)}
                  </div>
                  <div className="bg-surface-container-low p-4 rounded-xl">
                    <p className="text-xs font-bold text-primary">{order.quantidade} unid. de {getProductName(order.produtoFinalId)}</p>
                  </div>
                </div>
                <button 
                  onClick={() => { void runAction(updateOrderStatus(order.id, 'producao')); }}
                  className="w-full mt-2 py-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-secondary transition-colors shadow-md"
                >
                  Enviar para Produção
                </button>
              </div>
            ))}
            {pendingOrders.length === 0 && (
              <div className="text-center p-8 text-primary/30 border-2 border-dashed border-primary/10 rounded-2xl">
                <p className="font-bold text-sm">Nenhum pedido pendente</p>
              </div>
            )}
          </div>
        </section>

        {/* Coluna 2: Produção */}
        <section className="flex-shrink-0 w-[400px]">
          <div className="flex items-center gap-3 mb-8 px-2">
            <h2 className="text-xl font-bold">Produção</h2>
            <span className="bg-secondary text-white text-[10px] px-3 py-1 rounded-full font-bold">{productionOrders.length}</span>
          </div>
          <div className="flex flex-col gap-6">
            {productionOrders.map(order => (
              <div key={order.id} className="bg-white p-8 rounded-lg shadow-[0px_24px_48px_rgba(16,20,26,0.04)] relative overflow-hidden">
                <div className="absolute top-0 right-0 h-1 w-full bg-secondary/20">
                  <div className="h-full bg-secondary w-[50%] animate-pulse"></div>
                </div>
                <div className="flex justify-between items-start mb-6 pt-2">
                  <div>
                    <h3 className="font-bold text-lg leading-tight">Lote: {getProductName(order.produtoFinalId)}</h3>
                    <p className="text-gray-400 text-sm font-medium mt-1">Qtd: {order.quantidade} unid.</p>
                  </div>
                  <div className="flex items-center gap-1 text-secondary font-bold">
                    <span className="material-symbols-outlined animate-pulse">oven_gen</span>
                    <span className="text-xs uppercase">Assando</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-6">
                   <div>
                     <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Cliente</p>
                     <p className="text-sm font-bold text-gray-800">{order.cliente}</p>
                   </div>
                </div>
                <button 
                  onClick={() => { void runAction(updateOrderStatus(order.id, 'logistica')); }}
                  className="w-full py-3 bg-secondary text-white rounded-xl text-xs font-bold hover:bg-secondary/80 transition-colors shadow-md"
                >
                  Mover para Logística
                </button>
              </div>
            ))}
            {productionOrders.length === 0 && (
              <div className="text-center p-8 text-primary/30 border-2 border-dashed border-primary/10 rounded-2xl">
                <p className="font-bold text-sm">Nada em produção no momento</p>
              </div>
            )}
          </div>
        </section>

        {/* Coluna 3: Logística */}
        <section className="flex-shrink-0 w-[400px]">
          <div className="flex items-center gap-3 mb-8 px-2">
            <h2 className="text-xl font-bold">Logística e Entrega</h2>
            <span className="bg-tertiary text-white text-[10px] px-3 py-1 rounded-full font-bold">{logisticsOrders.length}</span>
          </div>
          <div className="flex flex-col gap-6">
            {logisticsOrders.map(order => (
              <div key={order.id} className="bg-white p-8 rounded-lg shadow-[0px_24px_48px_rgba(16,20,26,0.04)] border-2 border-transparent hover:border-tertiary/20">
                {(() => {
                  const stage = getLogisticsStage(order);
                  return (
                    <>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-lg leading-tight text-primary">{order.cliente}</h3>
                    <p className="text-gray-400 text-sm font-medium mt-1">ID: {order.id}</p>
                  </div>
                  <div className="flex items-center gap-1 text-tertiary font-extrabold">
                    <span className="material-symbols-outlined">local_shipping</span>
                    <span className="text-[10px] uppercase tracking-widest">{stage === 'expedido' ? 'Expedido' : 'Em preparação'}</span>
                  </div>
                </div>
                <div className="p-4 bg-tertiary/5 rounded-2xl flex items-start gap-4 mb-6">
                  <span className="material-symbols-outlined text-tertiary">inventory_2</span>
                  <div>
                    <p className="text-xs font-bold text-tertiary">{order.quantidade} unid.</p>
                    <p className="text-[10px] text-tertiary/70 font-medium">{getProductName(order.produtoFinalId)}</p>
                    <p className="text-[10px] text-primary/50 font-bold mt-1 uppercase tracking-wider">
                      Etapa: {stage}
                    </p>
                  </div>
                </div>
                {stage === 'pendente' && (
                  <button
                    onClick={() => { void runAction(setOrderLogisticsStep(order.id, 'separado')); }}
                    className="w-full py-3 bg-white border border-tertiary text-tertiary rounded-xl text-xs font-bold hover:bg-tertiary hover:text-white transition-colors shadow-sm"
                  >
                    Registrar Separação
                  </button>
                )}
                {stage === 'separado' && (
                  <button
                    onClick={() => { void runAction(setOrderLogisticsStep(order.id, 'conferido')); }}
                    className="w-full py-3 bg-white border border-tertiary text-tertiary rounded-xl text-xs font-bold hover:bg-tertiary hover:text-white transition-colors shadow-sm"
                  >
                    Registrar Conferência
                  </button>
                )}
                {stage === 'conferido' && (
                  <button
                    onClick={() => { void runAction(setOrderLogisticsStep(order.id, 'expedido')); }}
                    className="w-full py-3 bg-tertiary text-white rounded-xl text-xs font-bold hover:bg-tertiary/80 transition-colors shadow-sm"
                  >
                    Registrar Expedição
                  </button>
                )}
                {stage === 'expedido' && (
                  <button
                    onClick={() => { void runAction(updateOrderStatus(order.id, 'concluido')); }}
                    className="w-full py-3 bg-white border border-tertiary text-tertiary rounded-xl text-xs font-bold hover:bg-tertiary hover:text-white transition-colors shadow-sm"
                  >
                    Marcar como Entregue
                  </button>
                )}
                    </>
                  );
                })()}
              </div>
            ))}
            {logisticsOrders.length === 0 && (
              <div className="text-center p-8 text-primary/30 border-2 border-dashed border-primary/10 rounded-2xl">
                <p className="font-bold text-sm">Nenhum pedido para entrega</p>
              </div>
            )}
          </div>
        </section>

        {/* Coluna 4: Concluídos (Mês) */}
        <section className="flex-shrink-0 w-[400px]">
          <div className="flex items-center gap-3 mb-8 px-2">
            <h2 className="text-xl font-bold text-gray-400">Concluídos (Mês)</h2>
            <span className="bg-green-100 text-green-700 text-[10px] px-3 py-1 rounded-full font-bold">{completedOrders.length}</span>
          </div>
          <div className="flex flex-col gap-6">
            {completedOrders.map(order => (
              <div key={order.id} className="bg-gray-50/50 p-8 rounded-lg shadow-sm border border-gray-100 transition-all hover:bg-white">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-lg leading-tight text-gray-500 line-through">{order.cliente}</h3>
                    <p className="text-gray-400 text-sm font-medium mt-1">ID: {order.id}</p>
                  </div>
                  <div className="flex items-center gap-1 text-green-600 font-bold">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span className="text-[10px] uppercase tracking-widest">Entregue</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-gray-500">
                   <span className="material-symbols-outlined text-gray-400">inventory_2</span>
                   {order.quantidade} unid. {getProductName(order.produtoFinalId)}
                </div>
              </div>
            ))}
            {completedOrders.length === 0 && (
              <div className="text-center p-8 text-primary/20 border-2 border-dashed border-primary/5 rounded-2xl">
                <p className="font-bold text-sm">Nenhum pedido entregue este mês</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-primary mb-6">Novo Pedido</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Cliente</label>
                <input 
                  type="text" 
                  className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-sm"
                  value={formData.cliente} 
                  onChange={e => setFormData({ ...formData, cliente: e.target.value })} 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Receita / Produto Final</label>
                <select 
                  className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-sm"
                  value={formData.produtoFinalId} 
                  onChange={e => setFormData({ ...formData, produtoFinalId: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {activeFinalProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Quantidade (Unid.)</label>
                <input 
                  type="number" 
                  className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-sm"
                  value={formData.quantidade} 
                  onChange={e => setFormData({ ...formData, quantidade: parseInt(e.target.value) || 0 })} 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Prazo (Opcional)</label>
                <input 
                  type="date" 
                  className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-sm"
                  value={formData.prazo} 
                  onChange={e => setFormData({ ...formData, prazo: e.target.value })} 
                />
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-4">
              <button onClick={() => setIsModalOpen(false)} className="text-primary/60 font-bold text-sm px-4">Cancelar</button>
              <button 
                onClick={handleAdd}
                className="bg-secondary text-white font-bold text-sm px-8 py-3 rounded-xl shadow-lg hover:bg-secondary/80 transition-colors disabled:opacity-50"
                disabled={!formData.cliente || !formData.produtoFinalId || formData.quantidade <= 0}
              >
                Criar Pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../contexts/StoreContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { listProductionOrdersRemote } from '../services/operationsApi';

export default function Dashboard() {
  const navigate = useNavigate();
  const { notifyError } = useFeedback();
  const [openMenuId, setOpenMenuId] = useState(null);
  const [productionOrders, setProductionOrders] = useState([]);
  const { metrics, orders, products, equipments, getEstoqueVirtual, deleteOrder, updateOrderStatus } = useStore();
  const activeProducts = products.filter(p => p.ativo !== false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const result = await listProductionOrdersRemote();
      if (!mounted || !result.success) return;
      setProductionOrders(result.data || []);
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const runAction = async (resultOrPromise) => {
    const result = await Promise.resolve(resultOrPromise);
    if (!result?.success && result?.error) notifyError(result.error);
    return result?.success;
  };

  const handleNextStatus = async (order) => {
    let result = null;
    if(order.status === 'pendente') result = updateOrderStatus(order.id, 'producao');
    else if(order.status === 'producao') result = updateOrderStatus(order.id, 'logistica');
    else if(order.status === 'logistica') result = updateOrderStatus(order.id, 'concluido');
    await runAction(result);
    setOpenMenuId(null);
  };

  const getProductName = (id) => {
    const p = products.find(prod => prod.id === id);
    return p ? p.name : 'Produto Desconhecido';
  };

  const getClientInitials = (cliente) => {
    if(!cliente) return "CL";
    return cliente.substring(0, 2).toUpperCase();
  };

  // KPIs Calculations
  const activeOrders = orders.filter(o => o.status !== 'concluido' && o.status !== 'cancelado').length;
  const missingProducts = activeProducts.filter(p => p.type === 'ingrediente' && getEstoqueVirtual(p.id) < 5).length;
  const activeOvens = equipments.filter(e => e.status === 'Normal').length;
  const totalOvens = equipments.length;

  const pendingOrders = orders.filter(o => o.status === 'pendente').slice(0, 2);
  const productionOrdersPreview = orders.filter(o => o.status === 'producao').slice(0, 2);
  const logisticsOrders = orders.filter(o => o.status === 'logistica').slice(0, 2);

  const recentOrders = [...orders].reverse().slice(0, 4);

  const alerts = useMemo(() => {
    const output = [];
    const rupture = activeProducts.filter((p) => (p.type === 'ingrediente' || p.type === 'embalagem') && getEstoqueVirtual(p.id) <= 0).length;
    if (rupture > 0) {
      output.push({ id: 'rupture', label: `${rupture} item(ns) em ruptura`, action: '/estoque' });
    }

    const pendingLogistics = orders.filter((o) => o.status === 'logistica').filter((o) => {
      const history = Array.isArray(o.history) ? o.history : [];
      return !history.some((h) => h?.reason === 'dispatch:expedido');
    }).length;
    if (pendingLogistics > 0) {
      output.push({ id: 'dispatch', label: `${pendingLogistics} pedido(s) aguardando expedição`, action: '/expedicao' });
    }

    const opsAtivas = productionOrders.filter((op) => op.status === 'em_producao').length;
    if (opsAtivas > 0) {
      output.push({ id: 'ops-active', label: `${opsAtivas} OP(s) em produção para acompanhamento`, action: '/fornos' });
    }

    return output;
  }, [activeProducts, getEstoqueVirtual, orders, productionOrders]);

  return (
    <>
      <section className="px-10 mt-12">
        <h1 className="text-4xl lufga-medium mb-12 tracking-tight text-primary">Visão Geral</h1>
        {/*  Hero KPIs  */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div onClick={() => navigate('/relatorios')} className="bg-white rounded-full p-8 shadow-[0px_20px_40px_rgba(93,64,55,0.04)] flex flex-col items-center justify-center text-center border border-[#fff1f2] cursor-pointer hover:border-primary/20 hover:shadow-md transition-all">
            <span className="text-[10px] lufga-semibold-caps text-[#8D7873] mb-2">Vendas do Dia</span>
            <span className="text-4xl lufga-bold text-primary">R$ {metrics.caixaRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div onClick={() => navigate('/jornada')} className="bg-white rounded-full p-8 shadow-[0px_20px_40px_rgba(93,64,55,0.04)] flex flex-col items-center justify-center text-center border border-[#fff1f2] cursor-pointer hover:border-primary/20 hover:shadow-md transition-all">
            <span className="text-[10px] lufga-semibold-caps text-[#8D7873] mb-2">Pedidos Ativos</span>
            <span className="text-4xl lufga-bold text-primary">{activeOrders} Unid.</span>
          </div>
          <div onClick={() => navigate('/estoque')} className="bg-white rounded-full p-8 shadow-[0px_20px_40px_rgba(93,64,55,0.04)] flex flex-col items-center justify-center text-center border border-[#fff1f2] cursor-pointer hover:border-primary/20 hover:shadow-md transition-all">
            <span className="text-[10px] lufga-semibold-caps text-[#8D7873] mb-2">Itens em Baixo Estoque</span>
            <span className="text-4xl lufga-bold text-secondary">{missingProducts}</span>
          </div>
          <div onClick={() => navigate('/fornos')} className="bg-white rounded-full p-8 shadow-[0px_20px_40px_rgba(93,64,55,0.04)] flex flex-col items-center justify-center text-center border border-[#fff1f2] cursor-pointer hover:border-primary/20 hover:shadow-md transition-all">
            <span className="text-[10px] lufga-semibold-caps text-[#8D7873] mb-2">Fornos Ativos</span>
            <span className="text-4xl lufga-bold text-tertiary">{activeOvens} / {totalOvens}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/*  Main Analytics (Order Flow) - Column 1-8  */}
          <div className="lg:col-span-8 bg-white rounded-xl p-10 shadow-[0px_24px_48px_rgba(93,64,55,0.03)] border border-[#fff1f2]">
            <h2 className="text-xl lufga-medium mb-10 text-primary cursor-pointer hover:underline" onClick={() => navigate('/jornada')}>Fluxo de Distribuição (Últimos Pedidos)</h2>
            <div className="relative flex flex-col md:flex-row justify-between items-start gap-8 md:gap-4">
              
              {/*  Column 1: New Order  */}
              <div className="flex-1 w-full">
                <div className="mb-4 flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-secondary"></span>
                  <span className="text-[10px] lufga-semibold-caps text-primary">Novo Pedido</span>
                </div>
                <div className="space-y-4">
                  {pendingOrders.map((order, i) => (
                    <div key={order.id} className={`bg-[#fff8f7] p-5 rounded-lg border border-[#fef0f1] cursor-pointer hover:shadow-sm transition-all ${i > 0 ? 'opacity-60' : ''}`} onClick={() => navigate('/jornada')}>
                      <p className="text-sm lufga-medium text-primary">{order.cliente}</p>
                      <p className="text-xs text-[#8D7873] truncate">{order.quantidade} {getProductName(order.produtoFinalId)}</p>
                    </div>
                  ))}
                  {pendingOrders.length === 0 && <p className="text-xs text-[#8D7873]">Nenhum pendente</p>}
                </div>
              </div>
              
              {/*  Connector  */}
              <div className="hidden md:flex flex-col justify-center items-center h-40">
                <svg className="w-12 h-24 text-secondary/30" fill="none" viewBox="0 0 50 100">
                  <path d="M0 50C25 50 25 50 50 50" stroke="currentColor" strokeDasharray="4 4" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </div>
              
              {/*  Column 2: Production  */}
              <div className="flex-1 w-full">
                <div className="mb-4 flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-primary"></span>
                  <span className="text-[10px] lufga-semibold-caps text-primary">Assamento e Embalagem</span>
                </div>
                <div className="space-y-4">
                  {productionOrdersPreview.map((order, i) => (
                    <div key={order.id} className={`bg-primary text-white p-5 rounded-lg relative overflow-hidden shadow-md cursor-pointer hover:scale-105 transition-all ${i > 0 ? 'opacity-80' : ''}`} onClick={() => navigate('/jornada')}>
                      <div className="absolute top-0 left-0 h-full bg-secondary/20 w-3/4"></div>
                      <div className="relative">
                        <p className="text-sm lufga-medium truncate">{order.cliente}</p>
                        <p className="text-xs opacity-80 truncate">{order.quantidade} unid.</p>
                        <div className="mt-4 h-1 w-full bg-white/20 rounded-full">
                          <div className="h-full bg-white w-3/4 rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {productionOrdersPreview.length === 0 && <p className="text-xs text-[#8D7873]">Nenhum em produção</p>}
                </div>
              </div>
              
              {/*  Connector  */}
              <div className="hidden md:flex flex-col justify-center items-center h-40">
                <svg className="w-12 h-24 text-secondary/30" fill="none" viewBox="0 0 50 100">
                  <path d="M0 50C25 50 25 50 50 50" stroke="currentColor" strokeDasharray="4 4" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </div>
              
              {/*  Column 3: Logistics  */}
              <div className="flex-1 w-full">
                <div className="mb-4 flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-tertiary"></span>
                  <span className="text-[10px] lufga-semibold-caps text-primary">Em Trânsito</span>
                </div>
                <div className="space-y-4">
                  {logisticsOrders.map((order, i) => (
                    <div key={order.id} className={`bg-[#fff8f7] p-5 rounded-lg flex items-center justify-between border border-[#fef0f1] cursor-pointer hover:shadow-sm transition-all ${i > 0 ? 'opacity-60' : ''}`} onClick={() => navigate('/jornada')}>
                      <div className="overflow-hidden">
                        <p className="text-sm lufga-medium text-primary truncate max-w-[120px]">{order.cliente}</p>
                        <p className="text-xs text-[#8D7873]">Lote liberado</p>
                      </div>
                      <span className="material-symbols-outlined text-tertiary">local_shipping</span>
                    </div>
                  ))}
                  {logisticsOrders.length === 0 && <p className="text-xs text-[#8D7873]">Nenhum em trânsito</p>}
                </div>
              </div>
            </div>
          </div>
          
          {/*  Equipment Monitor Widget - Column 9-12  */}
          <div className="lg:col-span-4 space-y-10">
            <div className="bg-white rounded-xl p-8 shadow-[0px_24px_48px_rgba(93,64,55,0.03)] border border-[#fff1f2] cursor-pointer hover:border-primary/20 transition-all" onClick={() => navigate('/fornos')}>
              <h2 className="text-sm lufga-semibold-caps mb-8 text-[#8D7873]">Saúde dos Equipamentos</h2>
              <div className="space-y-10">
                {equipments.slice(0, 2).map((equip, idx) => (
                  <div key={equip.id} className="flex items-center gap-6">
                    <div className="relative w-24 h-12 overflow-hidden">
                      <div className="w-24 h-24 rounded-full border-[12px] border-[#fff8f7]"></div>
                      <div className={`absolute top-0 left-0 w-24 h-24 rounded-full border-[12px] ${idx === 0 ? 'border-secondary' : 'border-tertiary -rotate-12'} border-b-transparent border-r-transparent rotate-45`}></div>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                        <span className={`text-xs lufga-bold ${idx === 0 ? 'text-primary' : 'text-tertiary'}`}>{equip.health}%</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm lufga-medium text-primary">{equip.name}</p>
                        {equip.health < 50 && <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>}
                      </div>
                      <p className="text-xs text-[#8D7873]">{equip.status === 'Normal' ? 'Temp. Ideal' : 'Alerta Ativo'}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-10 py-4 bg-primary text-white rounded-full lufga-semibold-caps text-[11px] tracking-[0.1em] hover:bg-[#442a22] transition-all shadow-md active:scale-95">
                Registros de Manutenção
              </button>
            </div>
            
            {/*  Promo/Status Card  */}
            <div className="relative rounded-xl h-48 overflow-hidden group cursor-pointer shadow-[0px_24px_48px_rgba(93,64,55,0.06)] border border-[#fff1f2]" onClick={() => navigate('/relatorios')}>
              <img className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAEUyHZB6nwsDNhjTb1H4SM_svp6unFwhshJmO1ftiyQ2xzE3Tm2atPyptQTnZZ7fjSBmivDWKMQTai_m5FlF840Hl27-YGEmS1aiQz3tqU-9V1D_CGxuhtDGklIQH3Uz0I0fG46B6_jkhSgmtkcABtKd59-Jj_vyr7QlWmwQ-RzighAbvKvIvIftg1Jxv0kiLYL92NDt9V4Mw7NH8XSUOJyba3BQr6Fji_TPjUb-p2mHkipkdFSjfSqPr4qsFauaE9y4uO2KzR5yo"/>
              <div className="absolute inset-0 bg-primary/30 backdrop-blur-[1px]"></div>
              <div className="absolute inset-0 p-8 flex flex-col justify-end">
                <span className="text-[10px] lufga-semibold-caps text-white/80 mb-1">Resumo Semanal</span>
                <h3 className="text-lg lufga-medium text-white leading-tight">Qualidade dos lotes atingiu recorde de 98.4%</h3>
              </div>
            </div>
          </div>
        </div>

        {/*  Recent Bulk Orders  */}
        <div className="mt-12 bg-white rounded-xl overflow-hidden shadow-[0px_24px_48px_rgba(93,64,55,0.03)] border border-[#fff1f2]">
          <div className="p-8 flex items-center justify-between">
            <div>
              <h2 className="text-xl lufga-medium text-primary">Ações Pendentes de Operação</h2>
              <p className="text-xs text-[#8D7873] mt-1">Alertas automáticos para decisão rápida</p>
            </div>
          </div>
          <div className="px-8 pb-8">
            {alerts.length === 0 ? (
              <div className="bg-[#fff8f7] border border-[#fef0f1] p-4 rounded-xl text-sm text-primary/60">Sem alertas críticos no momento.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {alerts.map((alert) => (
                  <button
                    key={alert.id}
                    onClick={() => navigate(alert.action)}
                    className="text-left bg-[#fff8f7] border border-[#fef0f1] p-4 rounded-xl hover:border-primary/20"
                  >
                    <p className="text-sm font-bold text-primary">{alert.label}</p>
                    <p className="text-[10px] text-[#8D7873] mt-1 uppercase tracking-widest">Abrir módulo</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 bg-white rounded-xl overflow-hidden shadow-[0px_24px_48px_rgba(93,64,55,0.03)] border border-[#fff1f2]">
          <div className="p-10 pb-4 flex justify-between items-end">
            <div>
              <h2 className="text-xl lufga-medium text-primary">Últimos Pedidos Cadastrados</h2>
              <p className="text-xs text-[#8D7873] mt-1">Registro de envio em tempo real</p>
            </div>
            <span className="text-[10px] lufga-semibold-caps text-secondary cursor-pointer hover:underline" onClick={() => navigate('/jornada')}>Ver Todo o Histórico</span>
          </div>
          <div className="mt-4">
            <div className="grid grid-cols-12 px-10 py-6 bg-[#fff8f7]/50">
              <div className="col-span-4 text-[10px] lufga-semibold-caps text-[#8D7873]">Cliente</div>
              <div className="col-span-3 text-[10px] lufga-semibold-caps text-[#8D7873]">Volume</div>
              <div className="col-span-3 text-[10px] lufga-semibold-caps text-[#8D7873]">Status</div>
              <div className="col-span-2 text-right text-[10px] lufga-semibold-caps text-[#8D7873]">Ação</div>
            </div>
            
            {recentOrders.map((order, idx) => (
              <div key={order.id} className={`grid grid-cols-12 px-10 py-8 items-center ${idx % 2 !== 0 ? 'bg-[#fff8f7]/30' : ''} border-b border-[#fff1f2]/50 hover:bg-[#fff8f7] cursor-pointer transition-colors`} onClick={() => navigate('/jornada')}>
                <div className="col-span-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#fef0f1] flex items-center justify-center lufga-bold text-primary text-xs border border-[#fff1f2] uppercase">
                    {getClientInitials(order.cliente)}
                  </div>
                  <div>
                    <p className="text-sm lufga-medium text-primary truncate max-w-[200px]">{order.cliente}</p>
                    <p className="text-[10px] text-[#8D7873]">ID: {order.id}</p>
                  </div>
                </div>
                <div className="col-span-3">
                  <p className="text-sm lufga-medium text-primary">{order.quantidade} Unid.</p>
                  <p className="text-[10px] text-[#8D7873] truncate max-w-[150px]">{getProductName(order.produtoFinalId)}</p>
                </div>
                <div className="col-span-3">
                  <div className={`inline-flex items-center px-4 py-1.5 rounded-full text-[10px] lufga-semibold-caps ${
                    order.status === 'pendente' ? 'bg-secondary/10 text-secondary' :
                    order.status === 'producao' ? 'bg-primary/10 text-primary' :
                    order.status === 'logistica' ? 'bg-tertiary/10 text-tertiary' :
                    order.status === 'cancelado' ? 'bg-red-100 text-red-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {order.status === 'pendente' ? 'Pendente' : 
                     order.status === 'producao' ? 'Em Produção' : 
                     order.status === 'logistica' ? 'Em Trânsito' :
                     order.status === 'cancelado' ? 'Cancelado' : 'Concluído'}
                  </div>
                </div>
                <div className="col-span-2 text-right relative">
                  <span 
                    className="material-symbols-outlined text-[#8D7873] cursor-pointer hover:text-primary transition-colors p-2"
                    onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === order.id ? null : order.id);
                    }}
                  >
                    more_horiz
                  </span>
                  {openMenuId === order.id && (
                      <div className="absolute right-0 top-10 bg-white border border-[#fff1f2] shadow-xl rounded-xl z-50 w-48 overflow-hidden flex flex-col items-start py-2">
                          {order.status !== 'concluido' && order.status !== 'cancelado' && (
                              <button 
                                className="w-full text-left px-4 py-2 text-sm lufga-medium text-primary hover:bg-[#fff8f7] transition-colors"
                                onClick={(e) => { e.stopPropagation(); handleNextStatus(order); }}
                              >
                                Avançar Status
                              </button>
                          )}
                          <button 
                            className="w-full text-left px-4 py-2 text-sm lufga-medium text-tertiary hover:bg-[#fff8f7] transition-colors"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await runAction(deleteOrder(order.id));
                              setOpenMenuId(null);
                            }}
                          >
                            Cancelar Pedido
                          </button>
                      </div>
                  )}
                </div>
              </div>
            ))}
            
            {recentOrders.length === 0 && (
              <div className="p-10 text-center text-[#8D7873] text-sm">Nenhum pedido encontrado.</div>
            )}
            
          </div>
        </div>
      </section>
    </>
  );
}

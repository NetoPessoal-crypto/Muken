import os

estoque_smart_jsx = """import React, { useState, useEffect } from 'react';
import { useStore } from '../contexts/StoreContext';
import { parseRecipeText, findBestMatch } from '../utils/smartParser';

export default function Estoque() {
  const { products, getValorPatrimonial, getEstoqueVirtual, produzirReceita, addOrUpdateProduct, deleteProduct } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("RAW"); // RAW ou FINAL
  
  // States Modal Cadastro Simples
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState(null);
  
  // States Modal Inteligente
  const [isSmartModalOpen, setIsSmartModalOpen] = useState(false);
  const [smartStep, setSmartStep] = useState(1);
  const [rawText, setRawText] = useState("");
  const [parsedItems, setParsedItems] = useState([]);
  const [finalData, setFinalData] = useState({ name: '', rendimento: 10, preco_venda: 45 });

  const handleOpenModal = (prod = null) => {
      setEditingProd(prod);
      setIsModalOpen(true);
  };

  const processText = () => {
    const parsed = parseRecipeText(rawText);
    const mapped = parsed.map(item => {
        const match = findBestMatch(item.name, products.filter(p => p.type !== 'produto_final'));
        return { ...item, matchId: match?.id || null, matchName: match?.name || null };
    });
    setParsedItems(mapped);
    setSmartStep(2);
  };

  const saveSmartRecipe = () => {
      const newProduct = {
          id: "PROD-" + Date.now(),
          type: "produto_final",
          name: finalData.name,
          sku: "AUTO-" + Math.floor(Math.random() * 1000),
          unit: "caixas",
          lotes: [],
          receita: {
              rendimento: finalData.rendimento,
              valor_venda_sugerido: finalData.preco_venda,
              ingredientes: parsedItems.map(it => ({
                  id: it.matchId || "PENDING-" + it.name,
                  nome: it.matchName || it.name,
                  uso: it.amount,
                  perda_pct: 0
              }))
          }
      };
      addOrUpdateProduct(newProduct);
      setIsSmartModalOpen(false);
      setSmartStep(1);
      setRawText("");
  };

  const ModalForm = () => {
      const isNew = !editingProd;
      const [formData, setFormData] = useState(editingProd ? { ...editingProd, _initialQtd: editingProd.lotes[0]?.qtd || 0 } : { name: '', sku: '', type: 'ingrediente', unit: 'kg', custo_producao: 0, _initialQtd: 0 });
      
      return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
             <div className="bg-surface-container-lowest p-8 rounded-2xl w-full max-w-md shadow-2xl">
                 <h2 className="text-xl font-bold text-primary mb-6">{editingProd ? 'Editar Insumo' : 'Novo Insumo'}</h2>
                 <div className="space-y-4">
                     <div>
                         <label className="text-xs font-bold text-primary/60 uppercase">Nome</label>
                         <input type="text" className="w-full bg-surface py-2 px-4 rounded-lg mt-1 outline-none focus:ring-2 focus:ring-secondary/30 text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="text-xs font-bold text-primary/60 uppercase">SKU</label>
                             <input type="text" className="w-full bg-surface py-2 px-4 rounded-lg mt-1 outline-none text-sm" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
                         </div>
                         <div>
                             <label className="text-xs font-bold text-primary/60 uppercase">Custo Unit. (R$)</label>
                             <input type="number" step="0.01" className="w-full bg-surface py-2 px-4 rounded-lg mt-1 outline-none text-sm" value={formData.custo_producao} onChange={e => setFormData({...formData, custo_producao: parseFloat(e.target.value)})} />
                         </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="text-xs font-bold text-primary/60 uppercase">Tipo</label>
                             <select className="w-full bg-surface py-2 px-4 rounded-lg mt-1 outline-none text-sm" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                                 <option value="ingrediente">Ingrediente</option>
                                 <option value="embalagem">Embalagem</option>
                             </select>
                         </div>
                         <div>
                             <label className="text-xs font-bold text-primary/60 uppercase">Medida</label>
                             <select className="w-full bg-surface py-2 px-4 rounded-lg mt-1 outline-none text-sm" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}>
                                 <option value="kg">KG</option>
                                 <option value="unidade">Unidade</option>
                             </select>
                         </div>
                     </div>
                     {isNew && (
                         <div className="grid grid-cols-1">
                             <div>
                                 <label className="text-xs font-bold text-primary/60 uppercase">Quantidade Inicial</label>
                                 <input type="number" step="0.1" className="w-full bg-surface py-2 px-4 rounded-lg mt-1 outline-none text-sm" value={formData._initialQtd} onChange={e => setFormData({...formData, _initialQtd: parseFloat(e.target.value)})} />
                             </div>
                         </div>
                     )}
                 </div>
                 <div className="flex justify-end gap-4 mt-8">
                     {editingProd && (
                         <button onClick={() => { deleteProduct(editingProd.id); setIsModalOpen(false); }} className="text-error font-bold text-sm px-4 hover:bg-error/10 rounded-lg">Excluir</button>
                     )}
                     <div className="flex-1"></div>
                     <button onClick={() => setIsModalOpen(false)} className="text-primary/60 font-bold text-sm px-4 hover:bg-surface rounded-lg">Cancelar</button>
                     <button onClick={() => { addOrUpdateProduct(formData); setIsModalOpen(false); }} className="bg-secondary text-white font-bold text-sm px-6 py-2 rounded-lg hover:bg-secondary-dim transition-colors">Salvar</button>
                 </div>
             </div>
          </div>
      );
  };

  const SmartModal = () => (
      <div className="fixed inset-0 bg-primary/40 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-surface-bright">
                  <div>
                      <h2 className="text-2xl font-bold text-primary flex items-center gap-3">
                        <span className="material-symbols-outlined text-secondary">psychology</span>
                        Cadastro Inteligente
                      </h2>
                      <p className="text-sm text-primary/40 mt-1">Passo {smartStep} de 3 • Inteligência de Receitas</p>
                  </div>
                  <button onClick={() => setIsSmartModalOpen(false)} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
                      <span className="material-symbols-outlined">close</span>
                  </button>
              </div>

              <div className="p-8 overflow-y-auto flex-1 bg-white">
                  {smartStep === 1 && (
                      <div className="space-y-6">
                          <label className="block">
                              <span className="text-sm font-bold text-primary/60 uppercase tracking-widest">Cole sua receita aqui</span>
                              <textarea 
                                value={rawText}
                                onChange={e => setRawText(e.target.value)}
                                className="w-full h-64 mt-3 p-6 bg-surface-bright border-2 border-dashed border-gray-200 rounded-2xl outline-none focus:border-secondary transition-all font-mono text-sm"
                                placeholder={"Exemplo:\\n1.5kg Farinha\\n500g Chocolate Amargo\\n10un Caixa Rosa"}
                              />
                          </label>
                          <div className="bg-secondary/5 p-4 rounded-xl border border-secondary/10 flex gap-4">
                              <span className="material-symbols-outlined text-secondary">info</span>
                              <p className="text-xs text-secondary/80 leading-relaxed">Nossa IA irá identificar automaticamente as quantidades e buscar os ingredientes no seu estoque atual.</p>
                          </div>
                      </div>
                  )}

                  {smartStep === 2 && (
                    <div className="space-y-6">
                        <h4 className="font-bold text-primary border-b pb-4">Validando Ingredientes Encontrados</h4>
                        <div className="space-y-3">
                            {parsedItems.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-surface-bright rounded-xl group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.matchId ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                                            <span className="material-symbols-outlined text-sm">{item.matchId ? 'check' : 'help'}</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-primary">{item.amount}{item.unit} {item.name}</p>
                                            <p className="text-[10px] uppercase font-bold text-primary/40">
                                                {item.matchId ? `Vincular a: ${item.matchName}` : '❌ Ingrediente não encontrado no estoque'}
                                            </p>
                                        </div>
                                    </div>
                                    {!item.matchId && (
                                        <button 
                                            onClick={() => handleOpenModal({ name: item.name, type: 'ingrediente', unit: item.unit, custo_producao: 0 })}
                                            className="text-white bg-secondary px-3 py-1 rounded-lg text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                            CADASTRAR FALTANTE
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                  )}

                  {smartStep === 3 && (
                      <div className="space-y-6">
                          <div className="grid grid-cols-1 gap-6">
                             <div>
                                <label className="text-xs font-bold text-primary/60 uppercase">Nome do Produto Final</label>
                                <input type="text" className="w-full bg-surface-bright py-3 px-4 rounded-xl mt-2 outline-none border border-gray-100" value={finalData.name} onChange={e => setFinalData({...finalData, name: e.target.value})} placeholder="Ex: Cookie de Pistache Deluxe" />
                             </div>
                             <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-xs font-bold text-primary/60 uppercase">Rendimento (un)</label>
                                    <input type="number" className="w-full bg-surface-bright py-3 px-4 rounded-xl mt-2 outline-none border border-gray-100" value={finalData.rendimento} onChange={e => setFinalData({...finalData, rendimento: parseInt(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-primary/60 uppercase">Preço Venda (R$)</label>
                                    <input type="number" className="w-full bg-surface-bright py-3 px-4 rounded-xl mt-2 outline-none border border-gray-100" value={finalData.preco_venda} onChange={e => setFinalData({...finalData, preco_venda: parseFloat(e.target.value)})} />
                                </div>
                             </div>
                          </div>
                      </div>
                  )}
              </div>

              <div className="p-8 bg-surface-bright border-t border-gray-100 flex justify-between">
                  {smartStep > 1 && (
                      <button onClick={() => setSmartStep(prev => prev - 1)} className="text-primary/40 font-bold text-sm hover:text-primary transition-colors">Voltar</button>
                  )}
                  <div className="flex-1"></div>
                  {smartStep === 1 && <button onClick={processText} className="bg-primary text-white font-bold px-8 py-3 rounded-full hover:scale-105 active:scale-95 transition-all">Analisar Receita</button>}
                  {smartStep === 2 && <button onClick={() => setSmartStep(3)} className="bg-primary text-white font-bold px-8 py-3 rounded-full hover:scale-105 transition-all">Prosseguir</button>}
                  {smartStep === 3 && <button onClick={saveSmartRecipe} className="bg-secondary text-white font-bold px-8 py-3 rounded-full hover:scale-105 transition-all shadow-lg shadow-secondary/20">Finalizar e Criar Produto</button>}
              </div>
          </div>
      </div>
  );

  const filtered = products.filter((prod) => {
    if(activeTab === 'RAW' && prod.type === 'produto_final') return false;
    if(activeTab === 'FINAL' && prod.type !== 'produto_final') return false;
    
    return prod.name.toLowerCase().includes(searchTerm.toLowerCase()) || prod.sku.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-12">
      
      {/* Top Dashboards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-primary text-white p-8 rounded-xl shadow-lg relative overflow-hidden group">
            <h3 className="text-primary-container font-semibold uppercase tracking-widest text-[10px]">Valor Patrimonial (Insumos)</h3>
            <p className="text-4xl font-bold mt-2">R$ {getValorPatrimonial().toFixed(2)}</p>
            <span className="material-symbols-outlined absolute right-[-10px] bottom-[-20px] text-[120px] opacity-10 group-hover:scale-110 transition-transform">account_balance</span>
        </div>
        <div className="bg-surface-container-lowest border border-error/10 p-8 rounded-xl shadow-sm">
            <div className="flex justify-between items-center">
                <h3 className="text-primary/60 font-semibold uppercase tracking-widest text-[10px]">Alertas Críticos</h3>
                <span className="bg-error/10 text-error px-3 py-1 rounded-full text-xs font-bold">2 Lotes</span>
            </div>
            <p className="text-error font-bold mt-4 text-sm">Atenção! Lotes vencendo em menos de 7 dias ou estoque abaixo da margem de segurança na Farinha Premiun.</p>
        </div>
        <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-secondary/20">
            <h3 className="text-primary/60 font-semibold uppercase tracking-widest text-[10px]">Ações Rápidas ERP</h3>
            <div className="flex gap-2 mt-4">
                <button onClick={() => handleOpenModal()} className="flex-1 bg-secondary text-white text-xs font-bold py-2 rounded-lg hover:bg-secondary-dim transition-colors">Novo Insumo</button>
                <button onClick={() => { setIsSmartModalOpen(true); setSmartStep(1); }} className="flex-1 bg-primary text-white text-xs font-bold py-2 rounded-lg hover:bg-primary-dim transition-colors">Nova Receita ✨</button>
            </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-surface-container">
        <button 
            onClick={() => setActiveTab('RAW')} 
            className={`pb-4 px-6 font-bold text-sm transition-all border-b-2 ${activeTab === 'RAW' ? 'border-primary text-primary' : 'border-transparent text-primary/40 hover:text-primary'} `}>
            Matérias Primas & Embalagens
        </button>
        <button 
            onClick={() => setActiveTab('FINAL')} 
            className={`pb-4 px-6 font-bold text-sm transition-all border-b-2 ${activeTab === 'FINAL' ? 'border-primary text-primary' : 'border-transparent text-primary/40 hover:text-primary'} `}>
            Produtos Finais (Receitas)
        </button>
      </div>

      {/* Tabela de Inventário */}
      <div className="bg-surface-container-lowest rounded-xl shadow-[0px_24px_48px_rgba(16,20,26,0.04)] overflow-hidden">
        
        {/* Toolbar */}
        <div className="p-6 border-b border-surface-container flex items-center justify-between">
            <div className="relative w-96">
                <span className="material-symbols-outlined absolute left-4 top-2.5 text-primary/40 text-[20px]">search</span>
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Pesquisar lotes, SKUs..." 
                    className="w-full bg-surface py-2.5 pl-12 pr-4 rounded-full text-sm outline-none focus:ring-2 focus:ring-secondary/30" 
                />
            </div>
        </div>

        {/* Listagem */}
        <div className="divide-y divide-surface-container">
            {filtered.map(prod => {
                const totalVirtual = getEstoqueVirtual(prod.id);
                return (
                <div key={prod.id} className="p-6 hover:bg-surface-bright transition-colors">
                    <div className="flex justify-between items-start">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center text-primary/40">
                                <span className="material-symbols-outlined">inventory_2</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-primary">{prod.name} <span className="text-xs text-primary/40 ml-2 font-medium">#{prod.sku}</span></h4>
                                {prod.type !== 'produto_final' && <p className="text-xs text-secondary font-semibold mt-1">Custo Médio: R$ {prod.custo_producao.toFixed(2)} / {prod.unit}</p>}
                                
                                {/* Ficha técnica Mini View */}
                                {prod.type === 'produto_final' && (
                                    <div className="mt-4 bg-primary/5 p-4 rounded-lg">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-primary/40 mb-2">Ficha Técnica Técnica (Rende {prod.receita.rendimento} {prod.unit})</p>
                                        <ul className="text-xs space-y-1">
                                            {prod.receita.ingredientes.map((ing, i) => (
                                                <li key={i} className="flex justify-between w-80">
                                                    <span className="text-primary/60">{ing.nome}</span>
                                                    <span className="font-bold text-primary">{ing.uso} + {ing.perda_pct}% perda</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="mt-4 pt-4 border-t border-primary/10 flex items-center gap-4">
                                            <button 
                                                onClick={() => produzirReceita(prod.id, 1)}
                                                className="bg-primary text-white px-4 py-1.5 rounded-md text-xs font-bold hover:bg-primary-dim transition-colors">
                                                Fazer 1 Fornada (+{prod.receita.rendimento})
                                            </button>
                                            <span className="text-xs text-primary/40 italic">Irá abater os ingredientes acima</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="text-right">
                            <div className="text-2xl font-bold tracking-tight text-primary">{totalVirtual} <span className="text-sm font-normal text-primary/50">{prod.unit}</span></div>
                            <div className="mt-2 space-y-1">
                                {prod.lotes.map(l => (
                                    <div key={l.loteId} className="text-[10px] flex items-center justify-end gap-2 text-primary/60">
                                        <span className="bg-surface-container px-2 py-0.5 rounded font-mono">{l.loteId}</span>
                                        <span>vence: {l.validade} ({l.qtd} left)</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {/* Ação Edit Row */}
                    <div className="flex justify-end gap-2 mt-2">
                        <button onClick={() => handleOpenModal(prod)} className="text-primary/20 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-xs">edit</span>
                        </button>
                    </div>
                </div>
            )})}
            
            {filtered.length === 0 && (
                <div className="p-12 text-center text-primary/40">Nenhum registro encontrado.</div>
            )}
        </div>
      </div>
      
      {isModalOpen && <ModalForm />}
      {isSmartModalOpen && <SmartModal />}
    </div>
  );
}
"""

with open('src/pages/Estoque.jsx', 'w', encoding='utf-8') as f:
    f.write(estoque_smart_jsx)

print("Smart Recipe UI Injetado!")

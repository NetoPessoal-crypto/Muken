import os

estoque_premium_jsx = """import React, { useState, useEffect } from 'react';
import { useStore } from '../contexts/StoreContext';
import { parseSmartText, findBestMatch } from '../utils/smartParser';

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
  const [smartResults, setSmartResults] = useState({ master: [], recipe: [] });
  const [finalData, setFinalData] = useState({ name: '', rendimento: 10, preco_venda: 45 });

  const handleOpenModal = (prod = null) => {
      setEditingProd(prod);
      setIsModalOpen(true);
  };

  const processSmartText = () => {
    const { masterData, recipeData } = parseSmartText(rawText);
    const results = recipeData.map(item => {
        const existing = findBestMatch(item.name, products.filter(p => p.type !== 'produto_final'));
        const inMaster = masterData.find(m => m.name.toLowerCase().includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(m.name.toLowerCase()));
        return {
            ...item,
            existingId: existing?.id || null,
            existingName: existing?.name || null,
            masterInfo: inMaster || null
        };
    });
    setSmartResults({ master: masterData, recipe: results });
    setSmartStep(2);
  };

  const bulkRegisterIngredients = () => {
      smartResults.recipe.forEach(item => {
          if (!item.existingId && item.masterInfo) {
              const newIng = {
                  id: "ING-" + Math.random().toString(36).substr(2, 9),
                  type: "ingrediente",
                  name: item.masterInfo.name,
                  sku: "AUTO-" + Math.floor(Math.random() * 9999),
                  unit: item.masterInfo.unit,
                  custo_producao: item.masterInfo.price,
                  lotes: [{ loteId: "L-INICIAL", qtd: 0, validade: "2099-12-31" }]
              };
              addOrUpdateProduct(newIng);
          }
      });
      setSmartStep(3);
  };

  const saveSmartRecipe = () => {
      const ingredientsFinal = smartResults.recipe.map(it => {
          const match = findBestMatch(it.name, products.filter(p => p.type !== 'produto_final'));
          return {
              id: match?.id || "PENDING-" + it.name,
              nome: match?.name || it.name,
              uso: it.amount,
              perda_pct: 0
          };
      });

      const newProduct = {
          id: "PROD-" + Date.now(),
          type: "produto_final",
          name: finalData.name,
          sku: "REC-" + Math.floor(Math.random() * 1000),
          unit: "caixas",
          lotes: [],
          receita: {
              rendimento: finalData.rendimento,
              valor_venda_sugerido: finalData.preco_venda,
              ingredientes: ingredientsFinal
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
             <div className="bg-surface-container-lowest p-8 rounded-3xl w-full max-w-md shadow-2xl border border-white/20">
                 <h2 className="text-xl font-bold text-primary mb-6">{editingProd ? 'Editar Item' : 'Novo Insumo'}</h2>
                 <div className="space-y-4">
                     <div>
                         <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Nome</label>
                         <input type="text" className="w-full bg-surface-bright py-2.5 px-4 rounded-xl mt-1 outline-none focus:ring-2 focus:ring-secondary/30 text-sm border-none shadow-inner" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">SKU</label>
                             <input type="text" className="w-full bg-surface-bright py-2.5 px-4 rounded-xl mt-1 outline-none text-sm shadow-inner" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
                         </div>
                         <div>
                             <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Custo (R$)</label>
                             <input type="number" step="0.01" className="w-full bg-surface-bright py-2.5 px-4 rounded-xl mt-1 outline-none text-sm shadow-inner" value={formData.custo_producao} onChange={e => setFormData({...formData, custo_producao: parseFloat(e.target.value)})} />
                         </div>
                     </div>
                     {isNew && (
                         <div className="grid grid-cols-1">
                             <div>
                                 <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Estoque Inicial</label>
                                 <input type="number" step="0.1" className="w-full bg-surface-bright py-2.5 px-4 rounded-xl mt-1 outline-none text-sm shadow-inner" value={formData._initialQtd} onChange={e => setFormData({...formData, _initialQtd: parseFloat(e.target.value)})} />
                             </div>
                         </div>
                     )}
                 </div>
                 <div className="flex justify-end gap-3 mt-8">
                     {editingProd && <button onClick={() => { deleteProduct(editingProd.id); setIsModalOpen(false); }} className="text-error font-bold text-xs uppercase px-4 hover:bg-error/5 py-2 rounded-xl transition-colors">Excluir</button>}
                     <button onClick={() => setIsModalOpen(false)} className="text-primary/40 font-bold text-xs uppercase px-4 hover:bg-surface py-2 rounded-xl transition-colors">Voltar</button>
                     <button onClick={() => { addOrUpdateProduct(formData); setIsModalOpen(false); }} className="bg-primary text-white font-bold text-xs uppercase px-6 py-2.5 rounded-xl hover:bg-primary-dim shadow-lg transition-all">Salvar</button>
                 </div>
             </div>
          </div>
      );
  };

  const SmartModal = () => (
      <div className="fixed inset-0 bg-primary/20 backdrop-blur-xl z-[210] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-[0_32px_64px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-10 border-b border-gray-50 flex justify-between items-center bg-surface-bright">
                  <div>
                    <h2 className="text-2xl font-black text-primary flex items-center gap-4">
                         <div className="w-10 h-10 bg-secondary/10 rounded-2xl flex items-center justify-center">
                            <span className="material-symbols-outlined text-secondary text-2xl">auto_awesome</span>
                         </div>
                         Assistente de Receitas
                    </h2>
                    <p className="text-primary/30 text-xs font-bold uppercase tracking-widest mt-2 ml-14">Passo {smartStep} de 3</p>
                  </div>
                  <button onClick={() => setIsSmartModalOpen(false)} className="w-10 h-10 bg-surface rounded-full flex items-center justify-center hover:bg-surface-container transition-colors">
                      <span className="material-symbols-outlined text-primary/20">close</span>
                  </button>
              </div>

              <div className="p-10 overflow-y-auto flex-1 bg-white">
                  {smartStep === 1 && (
                      <div className="space-y-6">
                          <p className="text-sm text-primary/60 font-medium">Cole sua lista de insumos e medidas abaixo.</p>
                          <textarea 
                            value={rawText}
                            onChange={e => setRawText(e.target.value)}
                            className="w-full h-80 p-8 bg-surface-bright border-none rounded-3xl outline-none font-mono text-xs shadow-inner leading-relaxed placeholder:text-primary/10"
                            placeholder="Ex: Manteiga - R$ 60 por kg..."
                          />
                      </div>
                  )}

                  {smartStep === 2 && (
                    <div className="space-y-8">
                        <div className="flex items-center justify-between">
                             <h4 className="font-bold text-primary flex items-center gap-2">
                                <span className="material-symbols-outlined text-secondary">analytics</span>
                                Ingredientes Analisados
                             </h4>
                             <button onClick={bulkRegisterIngredients} className="bg-secondary text-white text-[10px] uppercase font-black tracking-widest px-4 py-2 rounded-xl shadow-lg shadow-secondary/20 flex items-center gap-2 hover:scale-105 transition-transform">
                                <span className="material-symbols-outlined text-xs">add_task</span>
                                Cadastrar Faltantes
                             </button>
                        </div>
                        <div className="space-y-3">
                            {smartResults.recipe.map((item, i) => (
                                <div key={i} className={`flex items-center justify-between p-5 rounded-2xl ${item.existingId ? 'bg-secondary/5 border border-secondary/10' : 'bg-error/5 border border-error/5'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-3 h-3 rounded-full ${item.existingId ? 'bg-secondary animate-pulse' : 'bg-error'}`}></div>
                                        <div>
                                            <p className="text-sm font-bold text-primary">{item.amount}{item.unit} {item.name}</p>
                                            <p className="text-[10px] font-bold uppercase tracking-tighter mt-0.5 ${item.existingId ? 'text-secondary' : 'text-error/40'}">
                                                {item.existingId ? `Encontrado: ${item.existingName}` : '❌ Iten Novo (Preço será salvo)'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-lg ${item.existingId ? 'text-secondary' : 'text-error/20'}">
                                        {item.existingId ? 'check_circle' : 'bolt'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                  )}

                  {smartStep === 3 && (
                      <div className="space-y-8">
                          <h4 className="font-bold text-primary uppercase text-xs tracking-widest opacity-40">Configurações Finais do Produto</h4>
                          <div className="space-y-6">
                             <div>
                                <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Nome do Lançamento</label>
                                <input type="text" className="w-full bg-surface-bright py-4 px-6 rounded-2xl mt-2 outline-none border-none shadow-inner font-bold text-primary" value={finalData.name} onChange={e => setFinalData({...finalData, name: e.target.value})} placeholder="Ex: Cookie Baunilha Master" />
                             </div>
                             <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Rendimento (un)</label>
                                    <input type="number" className="w-full bg-surface-bright py-4 px-6 rounded-2xl mt-2 outline-none border-none shadow-inner" value={finalData.rendimento} onChange={e => setFinalData({...finalData, rendimento: parseInt(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Venda (R$)</label>
                                    <input type="number" className="w-full bg-surface-bright py-4 px-6 rounded-2xl mt-2 outline-none border-none shadow-inner" value={finalData.preco_venda} onChange={e => setFinalData({...finalData, preco_venda: parseFloat(e.target.value)})} />
                                </div>
                             </div>
                          </div>
                      </div>
                  )}
              </div>

              <div className="p-10 bg-surface-bright flex justify-end gap-5">
                  <button onClick={() => setIsSmartModalOpen(false)} className="px-6 text-primary/20 text-xs font-black uppercase tracking-widest hover:text-primary transition-colors">Descartar</button>
                  {smartStep === 1 && <button onClick={processSmartText} className="bg-primary text-white font-black text-xs uppercase tracking-widest px-8 py-4 rounded-2xl hover:scale-[1.02] active:scale-95 shadow-xl transition-all">Próximo Passo</button>}
                  {smartStep === 3 && <button onClick={saveSmartRecipe} className="bg-secondary text-white font-black text-xs uppercase tracking-widest px-8 py-4 rounded-2xl hover:scale-[1.02] shadow-xl shadow-secondary/20 transition-all">Salvar Receita</button>}
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
    <div className="max-w-7xl mx-auto space-y-12 pb-12">
      {/* Dashboard Topo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-primary text-white p-10 rounded-[32px] shadow-[0_24px_48px_rgba(20,24,30,0.12)] relative overflow-hidden group">
            <h3 className="text-white/40 font-bold uppercase tracking-[3px] text-[10px]">Patrimônio em Insumos</h3>
            <p className="text-4xl font-black mt-3 flex items-start gap-2">
                <span className="text-xl text-white/40 font-bold mt-1">R$</span> {getValorPatrimonial().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <div className="absolute right-[-20px] bottom-[-20px] material-symbols-outlined text-[140px] opacity-10 rotate-12 group-hover:scale-110 transition-transform">layers</div>
        </div>

        <div className="bg-surface-container-lowest p-10 rounded-[32px] border border-surface shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-primary/30 font-bold uppercase tracking-widest text-[10px]">Alertas Críticos</h3>
                <span className="bg-error/10 text-error px-3 py-1 rounded-full text-[10px] font-black">{products.filter(p => getEstoqueVirtual(p.id) < 5).length} ITENS</span>
            </div>
            <div className="space-y-4">
                 {products.filter(p => getEstoqueVirtual(p.id) < 5).slice(0,2).map(p => (
                    <div key={p.id} className="flex items-center justify-between">
                        <span className="text-sm font-bold text-primary">{p.name}</span>
                        <span className="text-xs font-black text-error">{getEstoqueVirtual(p.id)} {p.unit}</span>
                    </div>
                 ))}
                 {products.filter(p => getEstoqueVirtual(p.id) < 5).length === 0 && <p className="text-xs text-primary/20 italic">Todo estoque está saudável.</p>}
            </div>
        </div>

        <div className="flex flex-col gap-4">
             <button onClick={() => { setIsSmartModalOpen(true); setSmartStep(1); }} className="flex-1 bg-white text-primary border-2 border-primary/10 rounded-[24px] flex items-center justify-center gap-4 hover:bg-surface-bright transition-all group overflow-hidden relative shadow-sm">
                <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                    <span className="material-symbols-outlined text-2xl">auto_fix_high</span>
                </div>
                <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Importar TXT</p>
                    <p className="text-sm font-black">Cadastro Inteligente</p>
                </div>
             </button>
             <button onClick={() => handleOpenModal()} className="h-14 bg-secondary text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-lg shadow-secondary/10 hover:scale-[1.02] transition-all">
                Manual +
             </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-container p-1">
        <button onClick={() => setActiveTab('RAW')} className={`pb-6 px-10 text-[11px] uppercase tracking-[3px] font-black transition-all ${activeTab === 'RAW' ? 'border-b-4 border-primary text-primary' : 'text-primary/20 hover:text-primary/40'}`}>Matérias-Primas</button>
        <button onClick={() => setActiveTab('FINAL')} className={`pb-6 px-10 text-[11px] uppercase tracking-[3px] font-black transition-all ${activeTab === 'FINAL' ? 'border-b-4 border-primary text-primary' : 'text-primary/20 hover:text-primary/40'}`}>Receitas Finais</button>
      </div>

      {/* Tabela Master */}
      <div className="bg-white rounded-[40px] shadow-[0_32px_96px_rgba(20,24,30,0.06)] overflow-hidden border border-surface">
        <div className="divide-y divide-surface-container">
            {filtered.map(prod => (
                <div key={prod.id} className="p-8 hover:bg-surface-bright transition-all group">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-8">
                            <div className="w-16 h-16 bg-surface-bright rounded-3xl flex items-center justify-center text-primary/10 group-hover:bg-white group-hover:shadow-md transition-all">
                                <span className="material-symbols-outlined text-3xl">{prod.type === 'produto_final' ? 'cookie' : 'egg'}</span>
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-primary">{prod.name}</h4>
                                <div className="flex items-center gap-4 mt-1">
                                    <span className="text-[10px] font-black text-primary/20 uppercase tracking-widest">REF: {prod.sku}</span>
                                    {prod.type !== 'produto_final' && <span className="text-[10px] font-black text-secondary uppercase tracking-widest bg-secondary/10 px-2 py-0.5 rounded-lg">R$ {prod.custo_producao.toFixed(2)}/{prod.unit}</span>}
                                </div>
                                {prod.type === 'produto_final' && (
                                    <div className="mt-8 bg-surface-bright p-8 rounded-[32px] border border-surface w-full max-w-[500px]">
                                        <div className="flex items-center justify-between mb-6">
                                            <p className="text-[10px] font-black text-primary/30 uppercase tracking-[2px]">Ficha Técnica</p>
                                            <span className="bg-primary/5 text-primary text-[10px] font-bold px-3 py-1 rounded-full">{prod.receita.ingredientes.length} Itens</span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-3">
                                            {prod.receita.ingredientes.slice(0,4).map((ing, i) => (
                                                <div key={i} className="flex justify-between items-center bg-white/40 p-3 rounded-xl">
                                                    <span className="text-xs font-bold text-primary/60">{ing.nome}</span>
                                                    <span className="text-xs font-black text-primary">{ing.uso} {products.find(p=>p.id===ing.id)?.unit || 'u'}</span>
                                                </div>
                                            ))}
                                            {prod.receita.ingredientes.length > 4 && <p className="text-[10px] text-primary/20 font-bold ml-2">+ {prod.receita.ingredientes.length - 4} outros ingredientes...</p>}
                                        </div>
                                        <button onClick={() => produzirReceita(prod.id, 1)} className="mt-8 w-full bg-primary text-white text-[11px] font-black uppercase tracking-[2px] py-4 rounded-2xl hover:bg-secondary hover:scale-[1.02] shadow-xl shadow-primary/10 transition-all">
                                            Iniciar Produção (+{prod.receita.rendimento})
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-primary/20 uppercase tracking-widest mb-1">Stock Disponível</p>
                            <div className="flex items-baseline justify-end gap-2">
                                <span className="text-4xl font-black text-primary">{getEstoqueVirtual(prod.id)}</span>
                                <span className="text-sm font-bold text-primary/30 uppercase">{prod.unit}</span>
                            </div>
                            <div className="mt-4 flex justify-end">
                                <button onClick={() => handleOpenModal(prod)} className="w-10 h-10 bg-surface rounded-full flex items-center justify-center hover:bg-white hover:shadow-md transition-all">
                                    <span className="material-symbols-outlined text-primary/40 group-hover:text-primary">edit_note</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>
      
      {isModalOpen && <ModalForm />}
      {isSmartModalOpen && <SmartModal />}
    </div>
  );
}
"""

with open('src/pages/Estoque.jsx', 'w', encoding='utf-8') as f:
    f.write(estoque_premium_jsx)

print("Design Premium Velvet Patisserie Restaurado!")

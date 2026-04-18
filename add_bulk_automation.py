import os

# Repalce the whole Estoque.jsx with bulk-automation logic
new_estoque_jsx = """import React, { useState, useEffect } from 'react';
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
    
    // Cruza os dados: vê se o que está na receita já existe ou está no master
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
      // Refresh matches after bulk add (simple way: just proceed to step 3)
      setSmartStep(3);
  };

  const saveSmartRecipe = () => {
      // Re-run matching against CURRENT products (including the just-added ones)
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
                             <label className="text-xs font-bold text-primary/60 uppercase">Custo (R$)</label>
                             <input type="number" step="0.01" className="w-full bg-surface py-2 px-4 rounded-lg mt-1 outline-none text-sm" value={formData.custo_producao} onChange={e => setFormData({...formData, custo_producao: parseFloat(e.target.value)})} />
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
                     {editingProd && <button onClick={() => { deleteProduct(editingProd.id); setIsModalOpen(false); }} className="text-error font-bold text-sm px-4">Excluir</button>}
                     <button onClick={() => setIsModalOpen(false)} className="text-primary/60 font-bold text-sm px-4">Cancelar</button>
                     <button onClick={() => { addOrUpdateProduct(formData); setIsModalOpen(false); }} className="bg-secondary text-white font-bold text-sm px-6 py-2 rounded-lg">Salvar</button>
                 </div>
             </div>
          </div>
      );
  };

  const SmartModal = () => (
      <div className="fixed inset-0 bg-primary/40 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-surface-bright">
                  <h2 className="text-2xl font-bold text-primary flex items-center gap-3"><span className="material-symbols-outlined text-secondary">auto_awesome</span> Mega Cadastro Inteligente</h2>
                  <button onClick={() => setIsSmartModalOpen(false)} className="material-symbols-outlined text-primary/40">close</button>
              </div>

              <div className="p-8 overflow-y-auto flex-1">
                  {smartStep === 1 && (
                      <div className="space-y-4">
                          <p className="text-sm text-primary/60">Cole o bloco completo (Preços + Receita). Nosso sistema vai identificar tudo sozinho.</p>
                          <textarea 
                            value={rawText}
                            onChange={e => setRawText(e.target.value)}
                            className="w-full h-80 p-6 bg-surface-bright border-2 border-dashed border-gray-200 rounded-2xl outline-none font-mono text-xs"
                            placeholder="Cole aqui o texto enviado pela sua consultoria ou lista de compras..."
                          />
                      </div>
                  )}

                  {smartStep === 2 && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                             <h4 className="font-bold text-primary">Análise da Receita e Inventário</h4>
                             <button onClick={bulkRegisterIngredients} className="bg-secondary text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2">
                                <span className="material-symbols-outlined text-xs">library_add</span>
                                CADASTRAR TODOS OS NOVOS ({smartResults.recipe.filter(r => !r.existingId).length})
                             </button>
                        </div>
                        <div className="space-y-2">
                            {smartResults.recipe.map((item, i) => (
                                <div key={i} className={`flex items-center justify-between p-4 rounded-xl ${item.existingId ? 'bg-green-50/50 border border-green-100' : 'bg-orange-50 border border-orange-100'}`}>
                                    <div>
                                        <p className="text-sm font-bold text-primary">{item.amount}{item.unit} {item.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            {item.existingId ? (
                                                <span className="text-[10px] font-bold text-green-600 uppercase">Vínculo: {item.existingName}</span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-orange-600 uppercase">Atenção: Novo Insumo detectado (R$ {item.masterInfo?.price.toFixed(2)}/{item.masterInfo?.unit})</span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-sm">{item.existingId ? 'check_circle' : 'bolt'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                  )}

                  {smartStep === 3 && (
                      <div className="space-y-6">
                          <h4 className="font-bold text-primary">Dados Finais do Produto</h4>
                          <div className="space-y-4">
                             <div>
                                <label className="text-xs font-bold text-primary/60 uppercase font-mono">Nome da Receita</label>
                                <input type="text" className="w-full bg-surface-bright py-4 px-6 rounded-2xl mt-2 outline-none border border-gray-100 font-bold" value={finalData.name} onChange={e => setFinalData({...finalData, name: e.target.value})} placeholder="Ex: Cookie Tradicional Chocolate" />
                             </div>
                             <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-xs font-bold text-primary/60 uppercase font-mono">Rendimento Final (un)</label>
                                    <input type="number" className="w-full bg-surface-bright py-3 px-6 rounded-xl mt-2 outline-none" value={finalData.rendimento} onChange={e => setFinalData({...finalData, rendimento: parseInt(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-primary/60 uppercase font-mono">Preço de Venda (R$)</label>
                                    <input type="number" className="w-full bg-surface-bright py-3 px-6 rounded-xl mt-2 outline-none" value={finalData.preco_venda} onChange={e => setFinalData({...finalData, preco_venda: parseFloat(e.target.value)})} />
                                </div>
                             </div>
                          </div>
                      </div>
                  )}
              </div>

              <div className="p-8 bg-surface-bright border-t border-gray-100 flex justify-end gap-4">
                  <button onClick={() => setIsSmartModalOpen(false)} className="px-6 text-primary/40 font-bold text-sm">Cancelar</button>
                  {smartStep === 1 && <button onClick={processSmartText} className="bg-primary text-white font-bold px-8 py-3 rounded-full hover:scale-105 transition-all">Analisar Bloco</button>}
                  {smartStep === 3 && <button onClick={saveSmartRecipe} className="bg-secondary text-white font-bold px-8 py-3 rounded-full hover:scale-105 transition-all shadow-lg">Salvar Receita Completa</button>}
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
            <h3 className="text-primary-container font-semibold uppercase tracking-widest text-[10px]">Patrimônio Total</h3>
            <p className="text-4xl font-bold mt-2">R$ {getValorPatrimonial().toFixed(2)}</p>
            <span className="material-symbols-outlined absolute right-[-10px] bottom-[-20px] text-[100px] opacity-10">payments</span>
        </div>
        <div className="bg-surface-container-lowest p-8 rounded-xl border border-error/5 shadow-sm">
            <h3 className="text-error font-semibold uppercase tracking-widest text-[10px]">Alertas Críticos</h3>
            <p className="text-primary font-bold mt-2">{products.filter(p => p.lotes.reduce((a,l)=>a+l.qtd,0) < 5).length} Itens em Falta</p>
        </div>
        <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-secondary/20 flex flex-col justify-center gap-3">
             <button onClick={() => handleOpenModal()} className="w-full bg-secondary text-white text-xs font-bold py-2.5 rounded-lg">Novo Insumo</button>
             <button onClick={() => { setIsSmartModalOpen(true); setSmartStep(1); }} className="w-full bg-primary text-white text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-xs">auto_fix_high</span> Cadastro Inteligente (TXT)
             </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button onClick={() => setActiveTab('RAW')} className={`pb-4 px-8 font-bold text-sm ${activeTab === 'RAW' ? 'border-b-4 border-primary text-primary' : 'text-primary/30'}`}>Insumos</button>
        <button onClick={() => setActiveTab('FINAL')} className={`pb-4 px-8 font-bold text-sm ${activeTab === 'FINAL' ? 'border-b-4 border-primary text-primary' : 'text-primary/30'}`}>Receitas Finais</button>
      </div>

      {/* Listagem */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-100">
            {filtered.map(prod => (
                <div key={prod.id} className="p-6 hover:bg-surface-bright transition-colors group">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                            <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center text-primary/40 font-bold">{prod.name.substring(0,1)}</div>
                            <div>
                                <h4 className="font-bold text-primary">{prod.name}</h4>
                                <p className="text-[10px] text-primary/40 uppercase tracking-widest mt-1">ID: {prod.sku} • {prod.type}</p>
                                {prod.type === 'produto_final' && (
                                    <div className="mt-4 p-4 bg-primary/5 rounded-xl border border-primary/5">
                                        <p className="text-[9px] font-bold text-primary/40 uppercase tracking-tighter mb-2">Ficha Técnica Proporcional</p>
                                        <div className="grid grid-cols-2 gap-x-10 gap-y-1 text-xs">
                                            {prod.receita.ingredientes.map((ing, i) => (
                                                <div key={i} className="flex justify-between border-b border-primary/5 py-1">
                                                    <span className="text-primary/60">{ing.nome}</span>
                                                    <span className="font-mono text-[10px]">{ing.uso} {products.find(p=>p.id===ing.id)?.unit || 'unit'}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <button onClick={() => produzirReceita(prod.id, 1)} className="mt-4 bg-primary text-white text-[10px] font-bold px-4 py-1.5 rounded-lg hover:bg-secondary">RODAR FORNADA (+{prod.receita.rendimento})</button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-bold text-primary">{getEstoqueVirtual(prod.id)} {prod.unit}</p>
                            <button onClick={() => handleOpenModal(prod)} className="material-symbols-outlined text-primary/10 hover:text-primary mt-2">edit_note</button>
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
    f.write(new_estoque_jsx)

print("Sistema de Cadastro Automático Injetado!")

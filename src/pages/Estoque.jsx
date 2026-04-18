import React, { useState } from 'react';
import { useStore } from '../contexts/StoreContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { parseSmartText, findBestMatch } from '../utils/smartParser';
import SmartModal from '../components/SmartModal';

export default function Estoque() {
  const {
    products,
    stockMoves,
    getValorPatrimonial,
    getEstoqueVirtual,
    produzirReceita,
    addOrUpdateProduct,
    deleteProduct,
    resetAllData,
    addStockMovement,
  } = useStore();
  const { notifyError } = useFeedback();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('RAW');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState(null);
  const [isSmartModalOpen, setIsSmartModalOpen] = useState(false);
  const [moveData, setMoveData] = useState({
    productId: '',
    type: 'ENTRADA',
    qty: '',
    loteId: '',
    validade: '',
    reason: '',
  });
  const operationalProducts = products.filter(p => p.ativo !== false);

  const notifyIfError = async (resultOrPromise) => {
    const result = await Promise.resolve(resultOrPromise);
    if (!result?.success && result?.error) notifyError(result.error);
    return result?.success;
  };

  const handleOpenModal = (prod = null) => {
    setEditingProd(prod);
    setIsModalOpen(true);
  };

  const handleOpenRecipeModal = (prod = null) => {
    setEditingProd(prod);
    setIsRecipeModalOpen(true);
  };

  const recentManualMoves = stockMoves
    .filter((m) => m.refType === 'manual-stock')
    .slice(-5)
    .reverse();

  const resetMoveData = () => {
    setMoveData({
      productId: '',
      type: 'ENTRADA',
      qty: '',
      loteId: '',
      validade: '',
      reason: '',
    });
  };

  const submitMove = async () => {
    const payload = {
      productId: moveData.productId,
      type: moveData.type,
      qty: Number(moveData.qty),
      loteId: moveData.loteId,
      validade: moveData.validade,
      reason: moveData.reason,
    };

    const result = await addStockMovement(payload);
    if (await notifyIfError(result)) {
      setIsMoveModalOpen(false);
      resetMoveData();
    }
  };

  // ModalForm simples (inline OK pois não tem inputs problemáticos de foco)
  const ModalForm = () => {
    const isNew = !editingProd;
    const [formData, setFormData] = useState(
      editingProd
        ? { ...editingProd, _initialQtd: editingProd.lotes[0]?.qtd || 0 }
        : { name: '', sku: '', type: 'ingrediente', unit: 'kg', custo_producao: 0, _initialQtd: 0 }
    );
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
        <div className="bg-surface-container-lowest p-8 rounded-3xl w-full max-w-md shadow-2xl border border-white/20">
          <h2 className="text-xl font-bold text-primary mb-6">{editingProd ? 'Editar Item' : 'Novo Insumo'}</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Nome</label>
              <input type="text" className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-sm" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">SKU</label>
                <input type="text" className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-sm" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Custo (R$)</label>
                <input type="number" step="0.01" className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-sm" value={formData.custo_producao} onChange={e => setFormData({ ...formData, custo_producao: parseFloat(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Tipo</label>
                <select className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-sm" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                  <option value="ingrediente">Ingrediente</option>
                  <option value="embalagem">Embalagem</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Unidade</label>
                <select className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-sm" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                  <option value="kg">KG</option>
                  <option value="g">g</option>
                  <option value="l">Litro</option>
                  <option value="ml">ml</option>
                  <option value="unidade">Unidade</option>
                  <option value="dz">Dúzia</option>
                </select>
              </div>
            </div>
            {isNew && (
              <div>
                <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Estoque Inicial</label>
                <input type="number" step="0.1" className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-sm" value={formData._initialQtd} onChange={e => setFormData({ ...formData, _initialQtd: parseFloat(e.target.value) })} />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-8">
            {editingProd && (
              <button onClick={async () => { if (await notifyIfError(deleteProduct(editingProd.id))) setIsModalOpen(false); }} className="text-error font-bold text-xs uppercase px-4 hover:bg-error/5 py-2 rounded-xl transition-colors">Excluir</button>
            )}
            <button onClick={() => setIsModalOpen(false)} className="text-primary/40 font-bold text-xs uppercase px-4 hover:bg-surface py-2 rounded-xl transition-colors">Voltar</button>
            <button onClick={async () => { if (await notifyIfError(addOrUpdateProduct(formData))) setIsModalOpen(false); }} className="bg-primary text-white font-bold text-xs uppercase px-6 py-2.5 rounded-xl hover:bg-primary-dim shadow-lg transition-all">Salvar</button>
          </div>
        </div>
      </div>
    );
  };

  const RecipeModal = () => {
    const [formData, setFormData] = useState(
      editingProd && editingProd.type === 'produto_final'
        ? { ...editingProd }
        : { 
            name: '', sku: '', type: 'produto_final', unit: 'caixas', 
            receita: {
              rendimento: 1, valor_venda_sugerido: 0, ingredientes: []
            } 
          }
    );

    const availableIngredients = operationalProducts.filter(p => p.type === 'ingrediente' || p.type === 'embalagem');

    const handleAddIngredient = () => {
      setFormData({
        ...formData,
        receita: {
          ...formData.receita,
          ingredientes: [...formData.receita.ingredientes, { id: '', nome: '', uso: 0, perda_pct: 0 }]
        }
      });
    };

    const handleIngredientChange = (index, field, value) => {
      const newIngs = [...formData.receita.ingredientes];
      if (field === 'id') {
        const selectedProd = operationalProducts.find(p => p.id === value);
        newIngs[index].id = value;
        newIngs[index].nome = selectedProd ? selectedProd.name : '';
        newIngs[index].unit_uso = selectedProd ? selectedProd.unit : ''; // Inicializa a unidade de uso
      } else {
        newIngs[index][field] = value;
      }
      setFormData({ ...formData, receita: { ...formData.receita, ingredientes: newIngs } });
    };

    const handleRemoveIngredient = (index) => {
      const newIngs = formData.receita.ingredientes.filter((_, i) => i !== index);
      setFormData({ ...formData, receita: { ...formData.receita, ingredientes: newIngs } });
    };

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
        <div className="bg-surface-container-lowest p-8 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20">
          <h2 className="text-xl font-bold text-primary mb-6">{editingProd ? 'Editar Receita' : 'Nova Receita'}</h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Nome da Receita</label>
                <input type="text" className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-sm" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">SKU (Código)</label>
                <input type="text" className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-sm" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Unidade</label>
                <select className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-sm" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                  <option value="caixas">Caixas</option>
                  <option value="unidade">Unidade</option>
                  <option value="kg">KG</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Rendimento</label>
                <input type="number" step="1" className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-sm" value={formData.receita.rendimento} onChange={e => setFormData({ ...formData, receita: { ...formData.receita, rendimento: parseFloat(e.target.value) } })} />
              </div>
              <div>
                <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Valor Venda (R$)</label>
                <input type="number" step="0.01" className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-sm" value={formData.receita.valor_venda_sugerido} onChange={e => setFormData({ ...formData, receita: { ...formData.receita, valor_venda_sugerido: parseFloat(e.target.value) } })} />
              </div>
            </div>

            <div className="mt-8 border-t border-surface-container pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-primary uppercase tracking-widest">Insumos da Receita</h3>
                <button onClick={handleAddIngredient} className="text-secondary font-bold text-xs uppercase px-3 py-1.5 bg-secondary/10 hover:bg-secondary/20 rounded-lg transition-colors">+ Adicionar Insumo</button>
              </div>
              
              <div className="space-y-3">
                {formData.receita.ingredientes.map((ing, idx) => (
                  <div key={idx} className="flex gap-3 items-end bg-surface-bright p-3 rounded-xl border border-surface">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Insumo</label>
                      <select className="w-full bg-white border-2 border-primary/10 py-2 px-3 rounded-lg mt-1 outline-none hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-xs" value={ing.id} onChange={e => handleIngredientChange(idx, 'id', e.target.value)}>
                        <option value="">Selecione...</option>
                        {availableIngredients.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-32">
                      <label className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Uso</label>
                      <div className="flex items-center gap-2 mt-1">
                        <input type="number" step="0.01" className="w-full bg-white border-2 border-primary/10 py-2 px-3 rounded-lg outline-none hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-xs" value={ing.uso} onChange={e => handleIngredientChange(idx, 'uso', parseFloat(e.target.value) || 0)} />
                        <select className="text-xs font-bold text-primary/60 bg-transparent outline-none cursor-pointer" value={ing.unit_uso || availableIngredients.find(p => p.id === ing.id)?.unit || ''} onChange={e => handleIngredientChange(idx, 'unit_uso', e.target.value)}>
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="l">l</option>
                          <option value="ml">ml</option>
                          <option value="unidade">unid</option>
                          <option value="dz">dz</option>
                        </select>
                      </div>
                    </div>
                    <div className="w-24">
                      <label className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Perca (%)</label>
                      <input type="number" step="1" className="w-full bg-white border-2 border-primary/10 py-2 px-3 rounded-lg mt-1 outline-none hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-xs" value={ing.perda_pct} onChange={e => handleIngredientChange(idx, 'perda_pct', parseFloat(e.target.value) || 0)} />
                    </div>
                    <button onClick={() => handleRemoveIngredient(idx)} className="h-9 w-9 bg-error/10 text-error rounded-lg flex items-center justify-center hover:bg-error/20 transition-colors">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                ))}
                {formData.receita.ingredientes.length === 0 && (
                  <p className="text-xs text-primary/30 italic text-center py-4">Nenhum insumo adicionado à receita.</p>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-8">
            {editingProd && (
              <button onClick={async () => { if (await notifyIfError(deleteProduct(editingProd.id))) setIsRecipeModalOpen(false); }} className="text-error font-bold text-xs uppercase px-4 hover:bg-error/5 py-2 rounded-xl transition-colors">Excluir</button>
            )}
            <button onClick={() => setIsRecipeModalOpen(false)} className="text-primary/40 font-bold text-xs uppercase px-4 hover:bg-surface py-2 rounded-xl transition-colors">Cancelar</button>
            <button onClick={async () => { if (await notifyIfError(addOrUpdateProduct(formData))) setIsRecipeModalOpen(false); }} className="bg-primary text-white font-bold text-xs uppercase px-6 py-2.5 rounded-xl hover:bg-primary-dim shadow-lg transition-all">Salvar Receita</button>
          </div>
        </div>
      </div>
    );
  };

  const MoveModal = () => {
    const selectedProduct = operationalProducts.find((p) => p.id === moveData.productId);
    const requiresReason = moveData.type === 'AJUSTE' || moveData.type === 'PERDA';

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
        <div className="bg-surface-container-lowest p-8 rounded-3xl w-full max-w-xl shadow-2xl border border-white/20">
          <h2 className="text-xl font-bold text-primary mb-2">Movimentacao Manual de Estoque</h2>
          <p className="text-xs text-primary/50 mb-6">Fluxo 80/20: entrada, saida, ajuste, perda e devolucao com rastreio.</p>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Produto</label>
              <select
                className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 focus:ring-2 focus:ring-primary/20 text-sm"
                value={moveData.productId}
                onChange={(e) => setMoveData({ ...moveData, productId: e.target.value })}
              >
                <option value="">Selecione...</option>
                {operationalProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Tipo</label>
                <select
                  className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 focus:ring-2 focus:ring-primary/20 text-sm"
                  value={moveData.type}
                  onChange={(e) => setMoveData({ ...moveData, type: e.target.value })}
                >
                  <option value="ENTRADA">Entrada</option>
                  <option value="SAIDA">Saida</option>
                  <option value="AJUSTE">Ajuste</option>
                  <option value="PERDA">Perda</option>
                  <option value="DEVOLUCAO">Devolucao</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">
                  Quantidade {moveData.type === 'AJUSTE' ? '(use negativo para baixar)' : ''}
                </label>
                <input
                  type="number"
                  step="0.001"
                  className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 focus:ring-2 focus:ring-primary/20 text-sm"
                  value={moveData.qty}
                  onChange={(e) => setMoveData({ ...moveData, qty: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Lote (opcional)</label>
                <input
                  type="text"
                  className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 focus:ring-2 focus:ring-primary/20 text-sm"
                  value={moveData.loteId}
                  onChange={(e) => setMoveData({ ...moveData, loteId: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Validade (opcional)</label>
                <input
                  type="date"
                  className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 focus:ring-2 focus:ring-primary/20 text-sm"
                  value={moveData.validade}
                  onChange={(e) => setMoveData({ ...moveData, validade: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-primary/40 uppercase tracking-widest">Motivo {requiresReason ? '(obrigatorio)' : '(opcional)'}</label>
              <input
                type="text"
                className="w-full bg-white border-2 border-primary/10 py-2.5 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 focus:ring-2 focus:ring-primary/20 text-sm"
                value={moveData.reason}
                onChange={(e) => setMoveData({ ...moveData, reason: e.target.value })}
              />
            </div>

            {selectedProduct && (
              <div className="bg-surface-bright border border-surface rounded-xl px-4 py-3 text-xs text-primary/70">
                Saldo atual: <span className="font-black text-primary">{Number(getEstoqueVirtual(selectedProduct.id)).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {selectedProduct.unit}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <button
              onClick={() => {
                setIsMoveModalOpen(false);
                resetMoveData();
              }}
              className="text-primary/40 font-bold text-xs uppercase px-4 hover:bg-surface py-2 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={submitMove}
              className="bg-primary text-white font-bold text-xs uppercase px-6 py-2.5 rounded-xl hover:bg-primary-dim shadow-lg transition-all"
              disabled={!moveData.productId || moveData.qty === '' || (requiresReason && !moveData.reason.trim())}
            >
              Registrar Movimento
            </button>
          </div>
        </div>
      </div>
    );
  };

  const filtered = operationalProducts.filter(prod => {
    if (activeTab === 'RAW' && prod.type === 'produto_final') return false;
    if (activeTab === 'FINAL' && prod.type !== 'produto_final') return false;
    return (
      prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-12">

      {/* Dashboard Topo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-primary text-white p-10 rounded-[32px] shadow-[0_24px_48px_rgba(20,24,30,0.12)] relative overflow-hidden group">
          <h3 className="text-white/40 font-bold uppercase tracking-[3px] text-[10px]">Patrimônio em Insumos</h3>
          <p className="text-4xl font-black mt-3 flex items-start gap-2">
            <span className="text-xl text-white/40 font-bold mt-1">R$</span>
            {getValorPatrimonial().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <div className="absolute right-[-20px] bottom-[-20px] material-symbols-outlined text-[140px] opacity-10 rotate-12 group-hover:scale-110 transition-transform">layers</div>
        </div>

        <div className="bg-surface-container-lowest p-10 rounded-[32px] border border-surface shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-primary/30 font-bold uppercase tracking-widest text-[10px]">Alertas Críticos</h3>
            <span className="bg-error/10 text-error px-3 py-1 rounded-full text-[10px] font-black">
              {operationalProducts.filter(p => getEstoqueVirtual(p.id) < 5).length} ITENS
            </span>
          </div>
          <div className="space-y-4">
            {operationalProducts.filter(p => getEstoqueVirtual(p.id) < 5).slice(0, 3).map(p => (
              <div key={p.id} className="flex items-center justify-between">
                <span className="text-sm font-bold text-primary">{p.name}</span>
                <span className="text-xs font-black text-error">{Number(getEstoqueVirtual(p.id)).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {p.unit}</span>
              </div>
            ))}
            {operationalProducts.filter(p => getEstoqueVirtual(p.id) < 5).length === 0 && (
              <p className="text-xs text-primary/20 italic">Todo o estoque está saudável.</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => setIsSmartModalOpen(true)}
            className="flex-1 bg-white text-primary border-2 border-primary/10 rounded-[24px] flex items-center justify-center gap-4 hover:bg-surface-bright transition-all group shadow-sm px-6"
          >
            <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
              <span className="material-symbols-outlined text-2xl">auto_fix_high</span>
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Importar Lista TXT</p>
              <p className="text-sm font-black">Cadastro Inteligente</p>
            </div>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => handleOpenModal()} className="h-14 bg-secondary text-white rounded-[20px] font-black text-[10px] uppercase tracking-widest shadow-lg shadow-secondary/10 hover:scale-[1.02] transition-all">
              + Novo Insumo
            </button>
            <button onClick={() => handleOpenRecipeModal()} className="h-14 bg-primary text-white rounded-[20px] font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/10 hover:scale-[1.02] transition-all">
              + Nova Receita
            </button>
          </div>
          <button onClick={() => setIsMoveModalOpen(true)} className="h-12 bg-white border border-primary/20 text-primary rounded-[20px] font-black text-[10px] uppercase tracking-widest hover:bg-surface-bright transition-all">
            + Movimentar Estoque
          </button>
          <button onClick={resetAllData} className="h-10 border border-error/20 text-error rounded-[24px] font-bold text-[10px] uppercase tracking-widest hover:bg-error/5 transition-all">
            🗑 Zerar Estoque
          </button>
        </div>
      </div>

      {recentManualMoves.length > 0 && (
        <div className="bg-white rounded-[28px] border border-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-primary uppercase tracking-widest">Ultimas Movimentacoes Manuais</h3>
            <span className="text-[10px] font-black text-primary/30 uppercase tracking-widest">TOP 5</span>
          </div>
          <div className="space-y-2">
            {recentManualMoves.map((move) => {
              const product = operationalProducts.find((p) => p.id === move.productId);
              return (
                <div key={move.id} className="grid grid-cols-12 items-center gap-3 bg-surface-bright rounded-xl px-4 py-3 text-xs">
                  <div className="col-span-3 font-bold text-primary">{move.kind}</div>
                  <div className="col-span-5 text-primary/70 truncate">{product?.name || move.productId}</div>
                  <div className="col-span-2 text-primary/70">{Number(move.qty).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {move.unit}</div>
                  <div className="col-span-2 text-right text-primary/40">{new Date(move.at).toLocaleDateString('pt-BR')}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-surface-container">
        <button
          onClick={() => setActiveTab('RAW')}
          className={`pb-6 px-10 text-[11px] uppercase tracking-[3px] font-black transition-all ${activeTab === 'RAW' ? 'border-b-4 border-primary text-primary' : 'text-primary/20 hover:text-primary/40'}`}
        >
          Matérias-Primas & Embalagens
        </button>
        <button
          onClick={() => setActiveTab('FINAL')}
          className={`pb-6 px-10 text-[11px] uppercase tracking-[3px] font-black transition-all ${activeTab === 'FINAL' ? 'border-b-4 border-primary text-primary' : 'text-primary/20 hover:text-primary/40'}`}
        >
          Receitas Finais
        </button>
      </div>

      {/* Listagem */}
      <div className="bg-white rounded-[40px] shadow-[0_32px_96px_rgba(20,24,30,0.06)] overflow-hidden border border-surface">
        {/* Barra de busca */}
        <div className="px-8 py-6 border-b border-surface-container">
          <div className="relative w-80">
            <span className="material-symbols-outlined absolute left-4 top-2.5 text-primary/30 text-[20px]">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou SKU..."
              className="w-full bg-surface-bright py-2.5 pl-12 pr-4 rounded-full text-sm outline-none"
            />
          </div>
        </div>

        <div className="divide-y divide-surface-container">
          {filtered.map(prod => (
            <div key={prod.id} className="p-8 hover:bg-surface-bright transition-all group">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-8">
                  <div className="w-16 h-16 bg-surface-bright rounded-3xl flex items-center justify-center text-primary/10 group-hover:bg-white group-hover:shadow-md transition-all flex-shrink-0">
                    <span className="material-symbols-outlined text-3xl">{prod.type === 'produto_final' ? 'cookie' : 'egg'}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-black text-primary">{prod.name}</h4>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-[10px] font-black text-primary/20 uppercase tracking-widest">REF: {prod.sku}</span>
                      {prod.type !== 'produto_final' && (
                        <span className="text-[10px] font-black text-secondary uppercase tracking-widest bg-secondary/10 px-2 py-0.5 rounded-lg">
                          R$ {(prod.custo_producao || 0).toFixed(2)}/{prod.unit}
                        </span>
                      )}
                    </div>

                    {/* Ficha Técnica */}
                    {prod.type === 'produto_final' && prod.receita && (
                      <div className="mt-6 bg-surface-bright p-6 rounded-[24px] border border-surface max-w-lg">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-[10px] font-black text-primary/30 uppercase tracking-[2px]">Ficha Técnica</p>
                          <span className="bg-primary/5 text-primary text-[10px] font-bold px-3 py-1 rounded-full">Rende {prod.receita.rendimento} {prod.unit}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {prod.receita.ingredientes.slice(0, 6).map((ing, i) => (
                            <div key={i} className="flex justify-between items-center bg-white/60 p-3 rounded-xl">
                              <span className="text-xs font-bold text-primary/60 truncate">{ing.nome}</span>
                              <span className="text-xs font-black text-primary ml-2">{ing.uso} {ing.unit_uso || operationalProducts.find(p => p.id === ing.id)?.unit || 'u'}</span>
                            </div>
                          ))}
                        </div>
                        {prod.receita.ingredientes.length > 6 && (
                          <p className="text-[10px] text-primary/20 font-bold mt-2">+ {prod.receita.ingredientes.length - 6} outros ingredientes...</p>
                        )}
                        <button
                          onClick={async () => { await notifyIfError(produzirReceita(prod.id, 1)); }}
                          className="mt-6 w-full bg-primary text-white text-[11px] font-black uppercase tracking-[2px] py-4 rounded-2xl hover:bg-secondary hover:scale-[1.02] shadow-xl shadow-primary/10 transition-all"
                        >
                          Iniciar Produção (+{prod.receita.rendimento})
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0 ml-8">
                  <p className="text-[10px] font-black text-primary/20 uppercase tracking-widest mb-1">Disponível</p>
                  <div className="flex items-baseline justify-end gap-2">
                    <span className="text-4xl font-black text-primary">{Number(getEstoqueVirtual(prod.id)).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                    <span className="text-sm font-bold text-primary/30 uppercase">{prod.unit}</span>
                  </div>
                  <button onClick={() => {
                    if(prod.type === 'produto_final') handleOpenRecipeModal(prod);
                    else handleOpenModal(prod);
                  }} className="mt-3 w-10 h-10 bg-surface rounded-full flex items-center justify-center hover:bg-white hover:shadow-md transition-all ml-auto">
                    <span className="material-symbols-outlined text-primary/40 text-xl">edit_note</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-16 text-center">
              <span className="material-symbols-outlined text-4xl text-primary/10">search_off</span>
              <p className="text-primary/20 font-bold mt-2">Nenhum item encontrado.</p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && <ModalForm />}
      {isRecipeModalOpen && <RecipeModal />}
      {isMoveModalOpen && <MoveModal />}

      {/* SmartModal: componente externo estável — não remonta ao mudar estado do pai */}
      <SmartModal
        isOpen={isSmartModalOpen}
        onClose={() => setIsSmartModalOpen(false)}
        products={operationalProducts}
        addOrUpdateProduct={addOrUpdateProduct}
        parseSmartText={parseSmartText}
        findBestMatch={findBestMatch}
      />
    </div>
  );
}

import React, { useState } from 'react';
import { useFeedback } from '../contexts/FeedbackContext';

export default function SmartModal({ isOpen, onClose, products, addOrUpdateProduct, parseSmartText, findBestMatch }) {
  const { notifyError } = useFeedback();
  const [step, setStep] = useState(1);
  const [rawText, setRawText] = useState('');
  const [smartResults, setSmartResults] = useState({ recipe: [] });
  const [pendingIngredients, setPendingIngredients] = useState([]);
  const [finalData, setFinalData] = useState({ name: '', rendimento: 10, preco_venda: 45 });
  const [debugInfo, setDebugInfo] = useState(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setStep(1);
    setRawText('');
    setPendingIngredients([]);
    setSmartResults({ recipe: [] });
    onClose();
  };

  const processText = () => {
    const { masterData, recipeData } = parseSmartText(rawText);
    console.log('=== SMART PARSER DEBUG ===');
    console.log('masterData:', masterData);
    console.log('recipeData:', recipeData);
    setDebugInfo({ masterCount: masterData.length, recipeCount: recipeData.length });

    const ingredients = products.filter(p => p.type !== 'produto_final');

    // Se não há linhas de receita, usa o masterData direto para registrar ingredientes
    const sourceData = recipeData.length > 0 ? recipeData : masterData.map(m => ({
      name: m.name,
      amount: 0,
      unit: m.unit,
      masterInfo: m
    }));

    const results = sourceData.map(item => {
      const existing = findBestMatch(item.name, ingredients);
      const inMaster = masterData.find(m =>
        m.name.toLowerCase().includes(item.name.toLowerCase()) ||
        item.name.toLowerCase().includes(m.name.toLowerCase())
      );
      return {
        ...item,
        existingId: existing?.id || null,
        existingName: existing?.name || null,
        masterInfo: item.masterInfo || inMaster || null
      };
    });

    setSmartResults({ recipe: results });

    const newOnes = results
      .filter(r => !r.existingId)
      .map(r => ({
        _tempId: Math.random().toString(36).substr(2, 6),
        name: r.masterInfo?.name || r.name,
        unit: r.masterInfo?.unit || 'kg',
        custo_producao: r.masterInfo?.price || 0,
        qtd_inicial: 0,
        type: 'ingrediente'
      }))
      .filter((item, index, self) => {
        // Remove duplicatas pelo nome normalizado
        const normalized = item.name.toLowerCase().trim();
        return self.findIndex(i => i.name.toLowerCase().trim() === normalized) === index;
      });

    setPendingIngredients(newOnes);
    setStep(2);
  };

  const updatePending = (tempId, field, value) => {
    setPendingIngredients(prev =>
      prev.map(p => p._tempId === tempId ? { ...p, [field]: value } : p)
    );
  };

  const confirmAndRegister = async () => {
    for (const item of pendingIngredients) {
      const result = await addOrUpdateProduct({
        id: 'ING-' + Math.random().toString(36).substr(2, 9),
        type: item.type,
        name: item.name,
        sku: 'AUTO-' + Math.floor(Math.random() * 9999),
        unit: item.unit,
        custo_producao: parseFloat(item.custo_producao) || 0,
        lotes: [{ loteId: 'L-INICIAL', qtd: parseFloat(item.qtd_inicial) || 0, validade: '2099-12-31' }]
      });
      if (!result?.success) {
        notifyError(result?.error || 'Falha ao cadastrar insumo.');
        return;
      }
    }
    setStep(3);
  };

  const saveRecipe = async () => {
    const allIngredients = products.filter(p => p.type !== 'produto_final');
    const ingredientsFinal = smartResults.recipe.map(it => {
      const match = findBestMatch(it.name, allIngredients);
      return {
        id: match?.id || 'PENDING-' + it.name,
        nome: match?.name || it.name,
        uso: it.amount,
        perda_pct: 0
      };
    });

    const result = await addOrUpdateProduct({
      id: 'PROD-' + Date.now(),
      type: 'produto_final',
      name: finalData.name,
      sku: 'REC-' + Math.floor(Math.random() * 1000),
      unit: 'caixas',
      lotes: [],
      receita: {
        rendimento: finalData.rendimento,
        valor_venda_sugerido: finalData.preco_venda,
        ingredientes: ingredientsFinal
      }
    });
    if (!result?.success) {
      notifyError(result?.error || 'Falha ao salvar receita.');
      return;
    }
    handleClose();
  };

  return (
    <div className="fixed inset-0 bg-primary/20 backdrop-blur-xl z-[210] flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] w-full max-w-4xl shadow-[0_32px_64px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-10 border-b border-gray-50 flex justify-between items-center bg-surface-bright">
          <div>
            <h2 className="text-2xl font-black text-primary flex items-center gap-4">
              <div className="w-10 h-10 bg-secondary/10 rounded-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary text-2xl">auto_awesome</span>
              </div>
              Assistente de Receitas
            </h2>
            <p className="text-primary/30 text-xs font-bold uppercase tracking-widest mt-2 ml-14">Passo {step} de 3</p>
          </div>
          <button onClick={handleClose} className="w-10 h-10 bg-surface rounded-full flex items-center justify-center hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-primary/20">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-10 overflow-y-auto flex-1 bg-white">

          {/* Step 1: Text input */}
          {step === 1 && (
            <div className="space-y-6">
              <p className="text-sm text-primary/60 font-medium">Cole sua lista de insumos com preços e as medidas de uso abaixo.</p>
              <textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                className="w-full h-80 p-8 bg-surface-bright border-none rounded-3xl outline-none font-mono text-xs shadow-inner leading-relaxed placeholder:text-primary/10"
                placeholder={"Insumos para Cadastro (Preço Base):\nManteiga sem Sal: R$ 60,00 por kg\n...\nMedidas de Uso (Ficha Técnica):\nManteiga sem Sal: 200 g\n..."}
              />
            </div>
          )}

          {/* Step 2: Review table */}
          {step === 2 && (
            <div className="space-y-6">

              {/* DEBUG PANEL */}
              {debugInfo && (
                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 font-mono text-xs space-y-2">
                  <p className="font-black text-primary text-[10px] uppercase tracking-widest">🔍 Resultado da Análise</p>
                  <p className="text-primary/60">Linhas de <strong>preço</strong> encontradas: <span className="text-secondary font-black">{debugInfo.masterCount}</span></p>
                  <p className="text-primary/60">Linhas de <strong>medida de receita</strong> encontradas: <span className="text-secondary font-black">{debugInfo.recipeCount}</span></p>
                  {debugInfo.recipeCount === 0 && debugInfo.masterCount > 0 && (
                    <p className="text-amber-600 font-bold">ℹ️ Modo cadastro de insumos — sem receita. Os ingredientes abaixo serão cadastrados com seus preços.</p>
                  )}
                  {debugInfo.masterCount > 0 && debugInfo.recipeCount > 0 && (
                    <p className="text-secondary font-bold">✅ Modo completo: preços + receita detectados!</p>
                  )}
                  {debugInfo.masterCount === 0 && debugInfo.recipeCount === 0 && (
                    <p className="text-error font-bold">⚠️ Nenhum dado reconhecido. Verifique se o formato está correto.</p>
                  )}
                </div>
              )}

              {/* Already found */}
              {smartResults.recipe.filter(r => r.existingId).length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Já Cadastrados ({smartResults.recipe.filter(r => r.existingId).length})
                  </p>
                  <div className="space-y-2">
                    {smartResults.recipe.filter(r => r.existingId).map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-secondary/5 rounded-2xl border border-secondary/10">
                        <span className="text-sm font-bold text-primary">{item.amount} {item.unit} — {item.name}</span>
                        <span className="text-[10px] font-black text-secondary bg-secondary/10 px-3 py-1 rounded-full">Vinculado: {item.existingName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Editable table of NEW ingredients */}
              {pendingIngredients.length > 0 ? (
                <div>
                  <p className="text-[10px] font-black text-error uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">warning</span>
                    Novos Insumos — Revise e corrija antes de cadastrar ({pendingIngredients.length})
                  </p>
                  <div className="overflow-x-auto border border-surface-container rounded-2xl">
                    <table className="w-full text-xs">
                      <thead className="bg-surface-bright">
                        <tr className="border-b border-surface-container">
                          <th className="text-left py-3 px-4 text-primary/30 font-black uppercase tracking-widest text-[9px]">Nome</th>
                          <th className="text-left py-3 px-4 text-primary/30 font-black uppercase tracking-widest text-[9px]">Tipo</th>
                          <th className="text-left py-3 px-4 text-primary/30 font-black uppercase tracking-widest text-[9px]">Unid. de Compra</th>
                          <th className="text-left py-3 px-4 text-primary/30 font-black uppercase tracking-widest text-[9px]">Custo Unit. (R$)</th>
                          <th className="text-left py-3 px-4 text-primary/30 font-black uppercase tracking-widest text-[9px]">Qtd. em Estoque</th>
                          <th className="py-3 px-4"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container">
                        {pendingIngredients.map(item => (
                          <tr key={item._tempId} className="hover:bg-surface-bright/50">
                            <td className="py-2 px-4">
                              <input
                                className="w-full bg-white border-2 border-primary/10 hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all px-3 py-2 rounded-xl outline-none font-bold"
                                value={item.name}
                                onChange={e => updatePending(item._tempId, 'name', e.target.value)}
                              />
                            </td>
                            <td className="py-2 px-4">
                              <select
                                className="bg-white border-2 border-primary/10 hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all px-3 py-2 rounded-xl outline-none w-full"
                                value={item.type}
                                onChange={e => updatePending(item._tempId, 'type', e.target.value)}
                              >
                                <option value="ingrediente">Ingrediente</option>
                                <option value="embalagem">Embalagem</option>
                              </select>
                            </td>
                            <td className="py-2 px-4">
                              <select
                                className="bg-white border-2 border-primary/10 hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all px-3 py-2 rounded-xl outline-none w-full"
                                value={item.unit}
                                onChange={e => updatePending(item._tempId, 'unit', e.target.value)}
                              >
                                <option value="kg">KG</option>
                                <option value="g">g</option>
                                <option value="l">Litro</option>
                                <option value="ml">ml</option>
                                <option value="unidade">Unidade</option>
                                <option value="dz">Dúzia</option>
                              </select>
                            </td>
                            <td className="py-2 px-4">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-28 bg-white border-2 border-primary/10 hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all px-3 py-2 rounded-xl outline-none font-mono"
                                value={item.custo_producao}
                                onChange={e => updatePending(item._tempId, 'custo_producao', e.target.value)}
                              />
                            </td>
                            <td className="py-2 px-4">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                className="w-28 bg-white border-2 border-primary/10 hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all px-3 py-2 rounded-xl outline-none font-mono"
                                value={item.qtd_inicial}
                                onChange={e => updatePending(item._tempId, 'qtd_inicial', e.target.value)}
                              />
                            </td>
                            <td className="py-2 px-4">
                              <button
                                onClick={() => setPendingIngredients(prev => prev.filter(p => p._tempId !== item._tempId))}
                                className="w-8 h-8 bg-error/5 rounded-full flex items-center justify-center hover:bg-error/20 transition-colors"
                              >
                                <span className="material-symbols-outlined text-error text-sm">delete</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-secondary/5 rounded-2xl text-center">
                  <span className="material-symbols-outlined text-secondary text-3xl">check_circle</span>
                  <p className="font-bold text-primary mt-2">Todos os insumos já estão cadastrados!</p>
                  <p className="text-xs text-primary/40 mt-1">Pode prosseguir para criar a receita.</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Recipe details */}
          {step === 3 && (
            <div className="space-y-8">
              <h4 className="font-bold text-primary uppercase text-xs tracking-widest opacity-40">Configurações Finais do Produto</h4>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Nome do Produto Final</label>
                  <input
                    type="text"
                    className="w-full bg-white border-2 border-primary/10 hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all py-4 px-6 rounded-2xl mt-2 outline-none font-bold text-primary"
                    value={finalData.name}
                    onChange={e => setFinalData({ ...finalData, name: e.target.value })}
                    placeholder="Ex: Cookie Baunilha Master"
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Rendimento (unid.)</label>
                    <input
                      type="number"
                      className="w-full bg-white border-2 border-primary/10 hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all py-4 px-6 rounded-2xl mt-2 outline-none"
                      value={finalData.rendimento}
                      onChange={e => setFinalData({ ...finalData, rendimento: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Preço de Venda (R$)</label>
                    <input
                      type="number"
                      className="w-full bg-white border-2 border-primary/10 hover:border-primary/20 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all py-4 px-6 rounded-2xl mt-2 outline-none"
                      value={finalData.preco_venda}
                      onChange={e => setFinalData({ ...finalData, preco_venda: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-10 bg-surface-bright border-t border-gray-100 flex justify-end gap-5">
          <button onClick={handleClose} className="px-6 text-primary/20 text-xs font-black uppercase tracking-widest hover:text-primary transition-colors">
            Descartar
          </button>
          {step === 1 && (
            <button onClick={processText} className="bg-primary text-white font-black text-xs uppercase tracking-widest px-8 py-4 rounded-2xl hover:scale-[1.02] shadow-xl transition-all">
              Analisar Texto
            </button>
          )}
          {step === 2 && (
            <button onClick={() => { void confirmAndRegister(); }} className="bg-secondary text-white font-black text-xs uppercase tracking-widest px-8 py-4 rounded-2xl hover:scale-[1.02] shadow-xl shadow-secondary/20 transition-all">
              Cadastrar {pendingIngredients.length} Insumos e Continuar →
            </button>
          )}
          {step === 3 && (
            <button onClick={() => { void saveRecipe(); }} className="bg-secondary text-white font-black text-xs uppercase tracking-widest px-8 py-4 rounded-2xl hover:scale-[1.02] shadow-xl shadow-secondary/20 transition-all">
              Salvar Receita
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

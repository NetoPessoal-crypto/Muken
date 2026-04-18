import os

# 1. mockDB.js REWRITE
mock_db = """export const initialProducts = [
  // MATÉRIAS PRIMAS
  {
    id: "ING-001",
    type: "ingrediente",
    name: "Farinha Especial Premium",
    sku: "FAR-01",
    unit: "kg",
    custo_producao: 4.50, // per kg
    lotes: [
        { loteId: "L-231101", qtd: 50.0, validade: "2024-05-10" },
        { loteId: "L-231105", qtd: 25.0, validade: "2024-05-20" }
    ]
  },
  {
    id: "ING-002",
    type: "ingrediente",
    name: "Chocolate Amargo Belgian",
    sku: "CHOC-02",
    unit: "kg",
    custo_producao: 42.00,
    lotes: [
        { loteId: "L-231015", qtd: 12.5, validade: "2024-02-15" }
    ]
  },
  {
    id: "EMB-001",
    type: "embalagem",
    name: "Caixa Rosa Veludo (12 unid)",
    sku: "CX-VLD-12",
    unit: "unidade",
    custo_producao: 3.20,
    lotes: [
        { loteId: "N/A", qtd: 350, validade: "2099-12-31" }
    ]
  },
  
  // PRODUTOS FINAIS
  {
    id: "PROD-CC_PREMIUM",
    type: "produto_final",
    name: "Caixa Cookies Choco Premium",
    sku: "CC-PREM-CX",
    unit: "caixas",
    lotes: [
        { loteId: "L-PR-1110", qtd: 15, validade: "2024-01-10" }
    ],
    // Ficha Técnica Automática
    receita: {
        rendimento: 10, // 1 fornada rende 10 caixas
        valor_venda_sugerido: 45.00, // Cada caixa é vendida a R$45
        ingredientes: [
            { id: "ING-001", nome: "Farinha Especial Premium", uso: 2.5, perda_pct: 2 }, // Usa 2.5kg + 2% de perda na bancada
            { id: "ING-002", nome: "Chocolate Amargo Belgian", uso: 1.2, perda_pct: 5 },
            { id: "EMB-001", nome: "Caixa Rosa Veludo (12 unid)", uso: 10, perda_pct: 0 } // Gasta 10 caixas
        ]
    }
  }
];

export const initialEquipments = [
  { id: "EQ-001", name: "Forno Industrial 1", type: "oven_gen", health: 75, status: "Normal" }
];

export const initialMetrics = {
  caixaRealizado: 34500.00
};
"""

# 2. StoreContext.jsx REWRITE
store_ctx = """import React, { createContext, useContext, useState } from 'react';
import { initialProducts, initialEquipments, initialMetrics } from '../data/mockDB';

const StoreContext = createContext();

export function StoreProvider({ children }) {
  const [products, setProducts] = useState(initialProducts);
  const [equipments, setEquipments] = useState(initialEquipments);
  const [metrics, setMetrics] = useState(initialMetrics);

  const getValorPatrimonial = () => {
     let total = 0;
     products.forEach(p => {
        if(p.type === 'ingrediente' || p.type === 'embalagem') {
           const qtdTotal = p.lotes.reduce((acc, lote) => acc + lote.qtd, 0);
           total += qtdTotal * p.custo_producao;
        }
     });
     return total;
  };

  const getEstoqueVirtual = (id) => {
     const prod = products.find(p => p.id === id);
     if (!prod) return 0;
     return prod.lotes.reduce((acc, lote) => acc + lote.qtd, 0);
  };

  // Dá baixa no estoque de ingredientes com base na ficha técnica
  const produzirReceita = (produtoFinalId, fornadas) => {
     const prodFinal = products.find(p => p.id === produtoFinalId);
     if(!prodFinal || !prodFinal.receita) return;

     let novosProdutos = [...products];

     // Subtrair ingredientes
     prodFinal.receita.ingredientes.forEach(req => {
        const ingIndex = novosProdutos.findIndex(p => p.id === req.id);
        if(ingIndex > -1) {
           const ing = novosProdutos[ingIndex];
           const totalNecessario = (req.uso * fornadas) * (1 + (req.perda_pct / 100)); // Inclui % de perda
           
           let faltaAbater = totalNecessario;
           let novosLotes = [...ing.lotes];
           
           // Abate cronológico nos lotes (FIFO)
           for (let i = 0; i < novosLotes.length; i++) {
               if(faltaAbater <= 0) break;
               
               if(novosLotes[i].qtd >= faltaAbater) {
                   novosLotes[i].qtd -= faltaAbater;
                   faltaAbater = 0;
               } else {
                   faltaAbater -= novosLotes[i].qtd;
                   novosLotes[i].qtd = 0;
               }
           }
           novosProdutos[ingIndex].lotes = novosLotes.filter(l => l.qtd > 0);
        }
     });

     // Adicionar o produto final no lote
     const pfIndex = novosProdutos.findIndex(p => p.id === produtoFinalId);
     const qtdProduzida = prodFinal.receita.rendimento * fornadas;
     const dataPadrao = "2024-12-31"; // mock
     
     novosProdutos[pfIndex].lotes.push({ loteId: "L-PR-" + Date.now().toString().slice(-4), qtd: qtdProduzida, validade: dataPadrao });

     setProducts(novosProdutos);
  };

  return (
    <StoreContext.Provider value={{ 
        products, 
        getValorPatrimonial, 
        getEstoqueVirtual,
        produzirReceita 
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
"""

# 3. Estoque.jsx REWRITE
estoque_jsx = """import React, { useState } from 'react';
import { useStore } from '../contexts/StoreContext';

export default function Estoque() {
  const { products, getValorPatrimonial, getEstoqueVirtual, produzirReceita } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("RAW"); // RAW ou FINAL

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
                <button className="flex-1 bg-secondary text-white text-xs font-bold py-2 rounded-lg hover:bg-secondary-dim transition-colors">Nova Compra</button>
                <button className="flex-1 bg-surface-container text-primary text-xs font-bold py-2 rounded-lg hover:bg-surface transition-colors">+ Ajuste</button>
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
                </div>
            )})}
            
            {filtered.length === 0 && (
                <div className="p-12 text-center text-primary/40">Nenhum registro encontrado.</div>
            )}
        </div>

      </div>
    </div>
  );
}
"""

with open('src/data/mockDB.js', 'w', encoding='utf-8') as f:
    f.write(mock_db)

with open('src/contexts/StoreContext.jsx', 'w', encoding='utf-8') as f:
    f.write(store_ctx)

with open('src/pages/Estoque.jsx', 'w', encoding='utf-8') as f:
    f.write(estoque_jsx)

print("ERP Atualizado!")

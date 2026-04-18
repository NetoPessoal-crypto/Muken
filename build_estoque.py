import os

estoque_jsx = """import React, { useState } from 'react';
import { useStore } from '../contexts/StoreContext';

export default function Estoque() {
  const { products } = useStore();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProducts = products.filter((prod) => 
    prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prod.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prod.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-12">
      {/* Categoria e Buscas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-surface-container-lowest p-8 rounded-lg shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-primary mb-2">Visão Geral do Armazém</h2>
          <div className="flex gap-4">
            <span className="text-sm font-medium text-primary/60 px-4 py-1.5 bg-surface-container-low rounded-full">Total de Itens: {products.length}</span>
            <span className="text-sm font-bold text-error px-4 py-1.5 bg-error/10 rounded-full">Baixo Estoque: {products.filter(p => !p.status.includes('Disponível')).length}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-2 text-primary/40">search</span>
            <input 
              type="text" 
              placeholder="Buscar por nome ou SKU..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-80 bg-surface-container-low border-none rounded-full py-2.5 pl-12 pr-4 focus:ring-2 focus:ring-secondary/50 outline-none text-sm placeholder:text-primary/40"
            />
          </div>
          <button className="p-2.5 rounded-full border border-outline-variant/30 hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-primary/60 text-[20px]">filter_list</span>
          </button>
        </div>
      </div>

      {/* Tabela de Produtos */}
      <div className="bg-surface-container-lowest rounded-lg shadow-[0px_24px_48px_rgba(16,20,26,0.04)] overflow-hidden">
        {/* Cabecalho da Tabela */}
        <div className="grid grid-cols-12 gap-4 p-6 border-b border-surface-container bg-surface-bright items-center">
            <div className="col-span-1 flex items-center justify-center">
                <input type="checkbox" className="w-4 h-4 rounded text-secondary focus:ring-secondary/50 border-outline-variant/50 cursor-pointer" />
            </div>
            <div className="col-span-4 text-left text-[10px] font-bold text-primary/40 uppercase tracking-widest">Produto e Categoria</div>
            <div className="col-span-2 text-left text-[10px] font-bold text-primary/40 uppercase tracking-widest">Estoque</div>
            <div className="col-span-2 text-left text-[10px] font-bold text-primary/40 uppercase tracking-widest">Preços (Custo/Venda)</div>
            <div className="col-span-2 text-left text-[10px] font-bold text-primary/40 uppercase tracking-widest">Validade / Status</div>
            <div className="col-span-1 text-center text-[10px] font-bold text-primary/40 uppercase tracking-widest">Ação</div>
        </div>

        {/* Linhas (Mapped) */}
        <div className="divide-y divide-surface-container">
            {filteredProducts.map(prod => (
                <div key={prod.id} className="grid grid-cols-12 gap-4 p-6 items-center hover:bg-surface-bright transition-colors group">
                    <div className="col-span-1 flex items-center justify-center">
                        <input type="checkbox" className="w-4 h-4 rounded text-secondary focus:ring-secondary/50 border-outline-variant/50 cursor-pointer opacity-50 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {/* Produto Info */}
                    <div className="col-span-4 flex items-center gap-4">
                        <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center text-secondary font-bold text-xs uppercase overflow-hidden">
                           {prod.category === 'Massa (Crua)' ? <span className="material-symbols-outlined absolute opacity-20 text-[40px]">texture</span> : <span className="material-symbols-outlined absolute opacity-20 text-[40px]">cookie</span>}
                           {prod.name.substring(0, 2)}
                        </div>
                        <div>
                            <h4 className="font-bold text-primary text-sm">{prod.name}</h4>
                            <p className="text-[10px] text-primary/50 mt-1">SKU: {prod.sku} • {prod.category}</p>
                        </div>
                    </div>
                    {/* Estoque */}
                    <div className="col-span-2">
                        <div className="text-sm font-bold text-primary">{prod.stock} <span className="text-[10px] text-primary/40 font-normal">{prod.unit}</span></div>
                        <div className="text-[10px] text-primary/40 mt-1">Últ. Entrada: {prod.lastRestock}</div>
                    </div>
                    {/* Precos */}
                    <div className="col-span-2">
                        <div className="text-sm font-bold text-primary">R$ {prod.preco_venda_distribuicao.toFixed(2)}</div>
                        <div className="text-[10px] text-error mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[10px]">arrow_downward</span>
                            Custo: R$ {prod.custo_producao.toFixed(2)}
                        </div>
                    </div>
                     {/* Validade E Status */}
                     <div className="col-span-2">
                        <div className="text-sm font-bold text-primary">{prod.validade}</div>
                        <div className="mt-1">
                            {prod.status === 'Disponível' && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-secondary/10 text-secondary">Normal</span>}
                            {prod.status === 'Estoque Baixo' && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700">Atenção</span>}
                            {prod.status === 'Crítico' && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-error/10 text-error">Crítico</span>}
                        </div>
                    </div>
                    {/* Botões Acão */}
                    <div className="col-span-1 flex items-center justify-center gap-2">
                        <button className="text-primary/40 hover:text-primary transition-colors p-1">
                            <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button className="text-primary/40 hover:text-secondary transition-colors p-1">
                            <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
                        </button>
                    </div>
                </div>
            ))}
            
            {filteredProducts.length === 0 && (
                <div className="p-12 text-center text-primary/40">
                   <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
                   <p className="font-medium">Nenhum produto encontrado para "{searchTerm}"</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
"""

with open('src/pages/Estoque.jsx', 'w', encoding='utf-8') as f:
    f.write(estoque_jsx)

print("Estoque Atualizado!")

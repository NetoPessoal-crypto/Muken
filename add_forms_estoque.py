import os
import re

# 1. StoreContext.jsx: Add `addOrUpdateProduct` and `deleteProduct`
with open('src/contexts/StoreContext.jsx', 'r', encoding='utf-8') as f:
    ctx = f.read()

func_add = """
  const addOrUpdateProduct = (prodData) => {
    setProducts(prev => {
        const index = prev.findIndex(p => p.id === prodData.id);
        if (index > -1) {
            // Update
            const newProd = [...prev];
            newProd[index] = { ...newProd[index], ...prodData };
            return newProd;
        } else {
            // Create
            return [...prev, { ...prodData, id: prodData.id || "ING-" + Date.now(), lotes: prodData.lotes || [{ loteId: "L-NEW", qtd: 0, validade: "2099-12-31" }] }];
        }
    });
  };

  const deleteProduct = (id) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };
"""

ctx = ctx.replace('const produzirReceita', func_add + '\n  const produzirReceita')
ctx = ctx.replace('produzirReceita ', 'produzirReceita, addOrUpdateProduct, deleteProduct ')

with open('src/contexts/StoreContext.jsx', 'w', encoding='utf-8') as f:
    f.write(ctx)

# 2. Estoque.jsx: Add Modal State and Form
with open('src/pages/Estoque.jsx', 'r', encoding='utf-8') as f:
    estoque = f.read()

# Add states 
state_inj = """  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("RAW"); // RAW ou FINAL
  
  // States Modal Cadastro
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState(null);
  
  const handleOpenModal = (prod = null) => {
      setEditingProd(prod);
      setIsModalOpen(true);
  };

  const ModalForm = () => {
      const [formData, setFormData] = useState(editingProd || { name: '', sku: '', type: 'ingrediente', unit: 'kg', custo_producao: 0 });
      
      return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center">
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
"""
estoque = estoque.replace('  const [searchTerm, setSearchTerm] = useState("");\n  const [activeTab, setActiveTab] = useState("RAW"); // RAW ou FINAL', state_inj)

# Inject addOrUpdateProduct and deleteProduct from context
estoque = estoque.replace('produzirReceita } = useStore();', 'produzirReceita, addOrUpdateProduct, deleteProduct } = useStore();')

# Link the modal to the component tree
estoque = estoque.replace('</button>\n        <button \n            onClick={() => setActiveTab(\'FINAL\')}', '</button>\n        <button \n            onClick={() => setActiveTab(\'FINAL\')}')
# We inject {isModalOpen && <ModalForm />} right before final closing div
estoque = estoque.replace('</div>\n    </div>\n  );\n}', '{isModalOpen && <ModalForm />}\n    </div>\n  );\n}')

# Link "Nova Compra" button => To prevent breaking string, we use re
estoque = re.sub(
    r'<button\s+className="flex-1\s+bg-secondary\s+text-white.*?Nova Compra</button>',
    r'<button onClick={() => handleOpenModal()} className="flex-1 bg-secondary text-white text-xs font-bold py-2 rounded-lg hover:bg-secondary-dim transition-colors">Novo Insumo</button>',
    estoque, flags=re.DOTALL
)

# Connect edit button
estoque = estoque.replace(
    '''<button className="text-primary/40 hover:text-primary transition-colors p-1">
                            <span className="material-symbols-outlined text-lg">edit</span>
                        </button>''',
    '''<button onClick={() => handleOpenModal(prod)} className="text-primary/40 hover:text-primary transition-colors p-1">
                            <span className="material-symbols-outlined text-lg">edit</span>
                        </button>'''
)


with open('src/pages/Estoque.jsx', 'w', encoding='utf-8') as f:
    f.write(estoque)

print("Modal de Formulários Injetado!")

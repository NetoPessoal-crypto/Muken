with open('src/contexts/StoreContext.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix imports
content = content.replace("import React, { createContext, useContext, useState } from 'react';",
                          "import React, { createContext, useContext, useState, useEffect } from 'react';")

# Replace initial states
old_states = """  const [products, setProducts] = useState(initialProducts);
  const [equipments, setEquipments] = useState(initialEquipments);
  const [metrics, setMetrics] = useState(initialMetrics);"""

new_states = """  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem('crmProducts');
    return saved ? JSON.parse(saved) : initialProducts;
  });
  const [equipments, setEquipments] = useState(() => {
    const saved = localStorage.getItem('crmEquips');
    return saved ? JSON.parse(saved) : initialEquipments;
  });
  const [metrics, setMetrics] = useState(() => {
    const saved = localStorage.getItem('crmMetrics');
    return saved ? JSON.parse(saved) : initialMetrics;
  });

  useEffect(() => { localStorage.setItem('crmProducts', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('crmEquips', JSON.stringify(equipments)); }, [equipments]);
  useEffect(() => { localStorage.setItem('crmMetrics', JSON.stringify(metrics)); }, [metrics]);"""

content = content.replace(old_states, new_states)

with open('src/contexts/StoreContext.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Local Storage Injetado!")

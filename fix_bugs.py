import os
import re

def fix_styles(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all style="..."
    def style_replacer(match):
        style_str = match.group(1)
        # basic parsing of "key: value;"
        props = [p.strip() for p in style_str.split(';') if p.strip()]
        obj_props = []
        for p in props:
            if ':' in p:
                k, v = p.split(':', 1)
                k = k.strip()
                v = v.strip()
                # camelCase the key
                parts = k.split('-')
                k_camel = parts[0] + ''.join(word.capitalize() for word in parts[1:])
                # remove extra quotes if they exist, then quote everything
                v = v.replace("'", "").replace('"', "")
                obj_props.append(f'{k_camel}: "{v}"')
        return 'style={{ ' + ', '.join(obj_props) + ' }}'

    content = re.sub(r'style="([^"]*)"', style_replacer, content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

fix_styles('src/pages/Jornada.jsx')
fix_styles('src/pages/Forno.jsx')
try:
    fix_styles('src/pages/Estoque.jsx')
except:
    pass

# Edit Estoque to remove photos of ingredients and Fornecedor column
with open('src/pages/Estoque.jsx', 'r', encoding='utf-8') as f:
    estoque = f.read()

# Remove Fornecedor header
estoque = re.sub(r'<div className="text-left text-\[10px].*?Fornecedor</div>', '', estoque, flags=re.IGNORECASE | re.DOTALL)
# Remove Fornecedor column content in rows (it usually is next to Status or validade)
# Because it's hard to safely regex HTML table-like grids blindly, we can just remove "Fornecedor: XYZ" texts 
# and the <img> tags.
estoque = re.sub(r'<img[^>]*>', '', estoque, flags=re.IGNORECASE)
estoque = re.sub(r'<div className="text-xs text-secondary mt-1".*?</div>', '', estoque, flags=re.IGNORECASE | re.DOTALL)
estoque = re.sub(r'<p className="text-\[10px] text-gray-400">.*?Fornecedor:.*?</p>', '', estoque, flags=re.IGNORECASE | re.DOTALL)

with open('src/pages/Estoque.jsx', 'w', encoding='utf-8') as f:
    f.write(estoque)

# Add Relatorio map in Layout
with open('src/components/Layout.jsx', 'r', encoding='utf-8') as f:
    layout = f.read()

layout = layout.replace(
    '<a className="text-[#8D7873] p-3 hover:text-primary hover:bg-[#eddfe0] rounded-full transition-all" href="#">',
    '<Link to="/relatorios" className={loc.pathname === "/relatorios" ? "bg-primary text-white rounded-full p-3 transition-transform duration-300 scale-110 shadow-md" : "text-[#8D7873] p-3 hover:text-primary hover:bg-[#eddfe0] rounded-full transition-all"}>'
).replace(
    '''<span className="material-symbols-outlined">assessment</span>
            </a>''',
    '''<span className="material-symbols-outlined">assessment</span>
            </Link>'''
)

with open('src/components/Layout.jsx', 'w', encoding='utf-8') as f:
    f.write(layout)

# Create Relatorio
relatorio_jsx = """import React from 'react';
export default function Relatorio() {
    return <div className="text-center mt-20"><h2 className="text-2xl text-primary font-bold">Módulo de Relatórios</h2><p className="text-[#8D7873] mt-4">Em breve você terá gráficos detalhados aqui!</p></div>;
}
"""
with open('src/pages/Relatorio.jsx', 'w', encoding='utf-8') as f:
    f.write(relatorio_jsx)

# App.jsx 
with open('src/App.jsx', 'r', encoding='utf-8') as f:
    app_jsx = f.read()

if 'import Relatorio' not in app_jsx:
    app_jsx = app_jsx.replace("import Forno from './pages/Forno';", "import Forno from './pages/Forno';\\nimport Relatorio from './pages/Relatorio';")
    app_jsx = app_jsx.replace('<Route path="fornos" element={<Forno />} />', '<Route path="fornos" element={<Forno />} />\\n          <Route path="relatorios" element={<Relatorio />} />')
    with open('src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(app_jsx)

print("Fixed Bugs!")

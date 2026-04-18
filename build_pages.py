import os
import re

html_files = {
    'Dashboard.jsx': 'painel_soft_curator.html',
    'Estoque.jsx': 'estoque_e_vendas.html',
    'Jornada.jsx': 'jornada_do_pedido.html',
    'Forno.jsx': 'monitoramento_de_equipamentos.html'
}

os.makedirs('src/pages', exist_ok=True)
os.makedirs('src/components', exist_ok=True)

# 1. We will extract the Sidebar and Header from painel_soft_curator.html
with open('painel_soft_curator.html', 'r', encoding='utf-8') as f:
    master_html = f.read()

# Extract NAV
nav_match = re.search(r'<nav[^>]*>.*?</nav>', master_html, re.IGNORECASE | re.DOTALL)
nav_content = nav_match.group(0) if nav_match else ""

# Extract HEADER
header_match = re.search(r'<header[^>]*>.*?</header>', master_html, re.IGNORECASE | re.DOTALL)
header_content = header_match.group(0) if header_match else ""

def to_jsx(html_string):
    c = html_string
    replacements = {
        'class=': 'className=',
        'for=': 'htmlFor=',
        'stroke-width=': 'strokeWidth=',
        'stroke-linecap=': 'strokeLinecap=',
        'stroke-linejoin=': 'strokeLinejoin=',
        'stroke-dasharray=': 'strokeDasharray=',
        'fill-rule=': 'fillRule=',
        'clip-rule=': 'clipRule=',
        '<!--': '{/* ',
        '-->': ' */}'
    }
    for old, new in replacements.items():
        c = c.replace(old, new)
    c = re.sub(r'viewbox=', 'viewBox=', c, flags=re.IGNORECASE)

    # Convert ahref in Sidebar to Link if possible, but manually is safer.
    # self closing
    self_closing = ['img', 'input', 'hr', 'br', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'ellipse']
    for tag in self_closing:
        c = re.sub(rf'<{tag}(\s+[^>]*)?(?<!/)>', rf'<{tag}\1 />', c, flags=re.IGNORECASE)
    
    # Fix double tags
    # Path tags fixed safely
    c = c.replace(' /></path>', ' />')
    c = c.replace(' /></circle>', ' />')
    
    return c

# Create Layout Component
layout_jsx = f"""import React from 'react';
import {{ Outlet, Link, useLocation }} from 'react-router-dom';

export default function Layout() {{
  const loc = useLocation();
  const isActive = (path) => loc.pathname === path ? "bg-primary text-white rounded-full p-3 transition-transform duration-300 scale-110 shadow-md" : "text-[#8D7873] p-3 hover:text-primary hover:bg-[#eddfe0] rounded-full transition-all";

  return (
    <>
      <nav className="fixed left-0 top-0 h-screen w-20 flex flex-col items-center py-8 bg-[#fff8f7] dark:bg-[#442a22] z-[60] shadow-[20px_0_60px_rgba(68,42,34,0.03)] border-r border-[#eddfe0]">
        <div className="flex flex-col gap-8">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mb-4 overflow-hidden shadow-lg">
                <img alt="Brand Logo" className="w-6 h-6 invert" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAIYeJL8vbgwWK7CwXuBlVr5_YtOvQgYS5T3a22Z7MACr8AIhC34nYvEgIEhpxdSfgKLrWJ0F4-vNZnnUkaMRpP6YK1_0sep78yEHOFFPhzXXiGbqZdkwc4h30j3BxwJMi-Fj1B0FhBFDRYewFG2YXXzb4c5o0tdSfcd2i6V0ncwzaGw7BEMtJ8aKjDXr5IGMx6kd50R9MDi2WH1gsnc2_zit_VdwtzRsMkUezaLkDMH3DfjQjSZiKwdtD5LEYZ2FU9-mW748FcC8w" />
            </div>
            <Link to="/" className={{isActive('/')}}>
                <span className="material-symbols-outlined">dashboard</span>
            </Link>
            <Link to="/jornada" className={{isActive('/jornada')}}>
                <span className="material-symbols-outlined">bakery_dining</span>
            </Link>
            <Link to="/estoque" className={{isActive('/estoque')}}>
                <span className="material-symbols-outlined">inventory_2</span>
            </Link>
            <Link to="/fornos" className={{isActive('/fornos')}}>
                <span className="material-symbols-outlined">oven_gen</span>
            </Link>
            <a className="text-[#8D7873] p-3 hover:text-primary hover:bg-[#eddfe0] rounded-full transition-all" href="#">
                <span className="material-symbols-outlined">assessment</span>
            </a>
        </div>
      </nav>

      <main className="ml-20 min-h-screen pb-20">
        <header className="sticky top-0 z-50 flex items-center justify-between h-16 w-[calc(100%-3rem)] ml-auto bg-[#fff8f7]/70 backdrop-blur-xl rounded-full mt-4 mx-6 px-6 shadow-[0_10px_30px_rgba(68,42,34,0.05)] border border-white/50">
            <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-primary">search</span>
            <span className="font-['Plus_Jakarta_Sans'] font-medium text-[#8D7873]">Search cookie batches or cafes...</span>
            </div>
            <div className="flex items-center gap-6">
            <div className="hidden md:flex gap-8">
                <span className="text-primary font-bold text-sm tracking-tight">Dashboard</span>
                <span className="text-[#8D7873] text-sm hover:text-primary transition-all cursor-pointer">Live Ovens</span>
                <span className="text-[#8D7873] text-sm hover:text-primary transition-all cursor-pointer">Logistics</span>
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden ring-2 ring-primary/10">
                <img alt="profile_photo" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDeW97Zm40lUvWuNG-ZPUKeEVO5eC8dYaG0pECJz8AlN7wKwDS89AW93kU3njyiMO-zWZ3hduFPaFqZL_VKrmoD-a-1hHM82iNLDIoXlCE_eCh-enYbGZX-rk45A9hgV8d0oVPx3ld0nJ_7G5GoY5XiYwBNJ2PuKiM2tQ28WchKmLOtmbWTPiU4X3IUrQ_122pZivjvVlcPPPXO-EQSj0UMNUGF9jsIFXw6Ekn-8JeyxfjK4C2iyFpQB88Rv3VaDtE1st-EJeV2NO8" />
            </div>
            </div>
        </header>

        <section className="px-10 mt-12">
            <Outlet />
        </section>
      </main>
    </>
  );
}}
"""

with open('src/components/Layout.jsx', 'w', encoding='utf-8') as f:
    f.write(layout_jsx)

print("Layout Component Created")

# Process Pages
for comp, html_filename in html_files.items():
    if not os.path.exists(html_filename):
        print(f"Skipping {{html_filename}}, doesn't exist.")
        continue

    with open(html_filename, 'r', encoding='utf-8') as f:
        html_code = f.read()

    # We just want the stuff inside <section className="px-10 mt-12">...</section>
    # Wait, the other pages might have <section> or just <main>.
    # Safest is to get `<main` and strip `<nav>` and `<header>` from inside it.
    
    main_match = re.search(r'<main[^>]*>(.*?)</main>', html_code, re.IGNORECASE | re.DOTALL)
    if not main_match:
        # Fallback to body
        main_match = re.search(r'<body[^>]*>(.*?)</body>', html_code, re.IGNORECASE | re.DOTALL)
    
    if main_match:
        inner = main_match.group(1)
        # remove header
        inner = re.sub(r'<header[^>]*>.*?</header>', '', inner, flags=re.IGNORECASE | re.DOTALL)
        # remove <section class="px-10 mt-12"> and its closing tag, to leave raw elements for Layout
        # Just strip those tags out? Or leave them because `Layout` has `<section className="px-10 mt-12">`
        # Actually our Layout already has the section padding. So we can remove the `<section...>` outer wrapper if it exists exactly.
        # Too risky with regex, let's just use it as is, or remove outer section if present.
        
        jsx_content = to_jsx(inner)

        page_jsx = f"""import React from 'react';

export default function {comp.split('.')[0]}() {{
  return (
    <>
      {jsx_content}
    </>
  );
}}
"""
        with open(f'src/pages/{comp}', 'w', encoding='utf-8') as f:
            f.write(page_jsx)
        print(f"Created {{comp}}")

# Update App.jsx with Router
app_jsx = """import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Estoque from './pages/Estoque';
import Jornada from './pages/Jornada';
import Forno from './pages/Forno';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="estoque" element={<Estoque />} />
          <Route path="jornada" element={<Jornada />} />
          <Route path="fornos" element={<Forno />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
"""

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(app_jsx)

print("Updated App.jsx with React Router")

import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../contexts/StoreContext';
import { useFeedback } from '../contexts/FeedbackContext';

export default function Layout() {
  const loc = useLocation();
  const { signOut } = useAuth();
  const { authContext } = useStore();
  const { notifyError } = useFeedback();
  const isActive = (path) => loc.pathname === path ? "bg-primary text-white rounded-full p-3 transition-transform duration-300 scale-110 shadow-md" : "text-[#8D7873] p-3 hover:text-primary hover:bg-[#eddfe0] rounded-full transition-all";

  const onLogout = async () => {
    const result = await signOut();
    if (!result.success) {
      notifyError(result.error || 'Falha ao sair da conta.');
    }
  };

  return (
    <>
      <nav className="fixed left-0 top-0 h-screen w-20 flex flex-col items-center py-8 bg-[#fff8f7] dark:bg-[#442a22] z-[60] shadow-[20px_0_60px_rgba(68,42,34,0.03)] border-r border-[#eddfe0]">
        <div className="flex flex-col gap-8">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mb-4 overflow-hidden shadow-lg">
                <img alt="Brand Logo" className="w-6 h-6 invert" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAIYeJL8vbgwWK7CwXuBlVr5_YtOvQgYS5T3a22Z7MACr8AIhC34nYvEgIEhpxdSfgKLrWJ0F4-vNZnnUkaMRpP6YK1_0sep78yEHOFFPhzXXiGbqZdkwc4h30j3BxwJMi-Fj1B0FhBFDRYewFG2YXXzb4c5o0tdSfcd2i6V0ncwzaGw7BEMtJ8aKjDXr5IGMx6kd50R9MDi2WH1gsnc2_zit_VdwtzRsMkUezaLkDMH3DfjQjSZiKwdtD5LEYZ2FU9-mW748FcC8w" />
            </div>
            <Link to="/" className={isActive('/')}>
                <span className="material-symbols-outlined">dashboard</span>
            </Link>
            <Link to="/jornada" className={isActive('/jornada')}>
                <span className="material-symbols-outlined">bakery_dining</span>
            </Link>
            <Link to="/estoque" className={isActive('/estoque')}>
                <span className="material-symbols-outlined">inventory_2</span>
            </Link>
            <Link to="/fornos" className={isActive('/fornos')}>
                <span className="material-symbols-outlined">oven_gen</span>
            </Link>
            <Link to="/expedicao" className={isActive('/expedicao')}>
                <span className="material-symbols-outlined">local_shipping</span>
            </Link>
            <Link to="/inventario" className={isActive('/inventario')}>
                <span className="material-symbols-outlined">checklist</span>
            </Link>
            <Link to="/relatorios" className={loc.pathname === "/relatorios" ? "bg-primary text-white rounded-full p-3 transition-transform duration-300 scale-110 shadow-md" : "text-[#8D7873] p-3 hover:text-primary hover:bg-[#eddfe0] rounded-full transition-all"}>
                <span className="material-symbols-outlined">assessment</span>
            </Link>
            <Link to="/acessos" className={isActive('/acessos')}>
                <span className="material-symbols-outlined">manage_accounts</span>
            </Link>
        </div>
      </nav>

      <main className="ml-20 min-h-screen pb-20">
        <header className="sticky top-0 z-50 flex items-center justify-between h-16 w-[calc(100%-3rem)] ml-auto bg-[#fff8f7]/70 backdrop-blur-xl rounded-full mt-4 mx-6 px-6 shadow-[0_10px_30px_rgba(68,42,34,0.05)] border border-white/50">
            <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-primary">search</span>
            <span className="font-['Plus_Jakarta_Sans'] font-medium text-[#8D7873]">Pesquisar lotes de cookies ou cafés...</span>
            </div>
            <div className="flex items-center gap-6">
            <div className="hidden md:flex gap-8">
                <span className="text-primary font-bold text-sm tracking-tight">Visão Geral</span>
                <span className="text-[#8D7873] text-sm hover:text-primary transition-all cursor-pointer">Fornos em Tempo Real</span>
                <span className="text-[#8D7873] text-sm hover:text-primary transition-all cursor-pointer">Logística</span>
            </div>
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-[#eddfe0]">
              <span className="text-[10px] font-black tracking-widest text-primary/40 uppercase">Perfil</span>
              <span className="text-xs font-bold text-primary">{authContext?.tenant?.role || 'operacao'}</span>
            </div>
            <button onClick={onLogout} className="text-[10px] font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors">Sair</button>
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
}

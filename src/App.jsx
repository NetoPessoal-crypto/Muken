import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import AuthScreen from './components/AuthScreen';
import Dashboard from './pages/Dashboard';
import Estoque from './pages/Estoque';
import Jornada from './pages/Jornada';
import Forno from './pages/Forno';
import Relatorio from './pages/Relatorio';
import Acessos from './pages/Acessos';
import Expedicao from './pages/Expedicao';
import Inventario from './pages/Inventario';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { StoreProvider } from './contexts/StoreContext';
import { FeedbackProvider } from './contexts/FeedbackContext';
import { startRuntimeMonitor } from './services/runtimeMonitor';

function AppGate() {
  const { isConfigured, user, loading } = useAuth();

  useEffect(() => {
    if (!isConfigured || !user) return undefined;
    const stop = startRuntimeMonitor();
    return () => {
      stop?.();
    };
  }, [isConfigured, user]);

  if (!isConfigured) {
    return <div className="p-8 text-sm text-error">Supabase não configurado. Verifique `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.</div>;
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-primary font-bold">Carregando sessão...</div>;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <FeedbackProvider>
      <StoreProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="estoque" element={<Estoque />} />
              <Route path="jornada" element={<Jornada />} />
              <Route path="fornos" element={<Forno />} />
              <Route path="expedicao" element={<Expedicao />} />
              <Route path="relatorios" element={<Relatorio />} />
              <Route path="inventario" element={<Inventario />} />
              <Route path="acessos" element={<Acessos />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </StoreProvider>
    </FeedbackProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}

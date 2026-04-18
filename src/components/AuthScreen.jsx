import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function AuthScreen() {
  const { signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setPending(true);
    setError('');
    setMessage('');

    const action = mode === 'login' ? signInWithPassword : signUpWithPassword;
    const result = await action(email.trim(), password);

    if (!result.success) {
      setError(result.error || 'Falha de autenticação.');
      setPending(false);
      return;
    }

    if (mode === 'signup') {
      if (result.needsConfirmation) {
        setMessage('Conta criada. Confirme no seu e-mail e depois faça login.');
      } else {
        setMessage('Conta criada e sessão iniciada com sucesso.');
      }
    }

    setPending(false);
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-[28px] p-8 shadow-[0_24px_48px_rgba(16,20,26,0.08)] border border-surface-container">
        <div className="mb-8">
          <p className="text-[10px] font-black tracking-[2px] uppercase text-primary/40">Acesso seguro</p>
          <h1 className="text-2xl font-black text-primary mt-2">Entrar no BECA</h1>
          <p className="text-sm text-primary/50 mt-2">Use seu e-mail para acessar o sistema.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border-2 border-primary/10 py-3 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-sm"
              placeholder="voce@empresa.com"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Senha</label>
            <input
              type="password"
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white border-2 border-primary/10 py-3 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-sm"
              placeholder="******"
            />
          </div>

          {error && <p className="text-xs text-error font-bold">{error}</p>}
          {message && <p className="text-xs text-secondary font-bold">{message}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-primary text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:bg-primary/90 transition-all disabled:opacity-60"
          >
            {pending ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div className="mt-6 text-center">
          {mode === 'login' ? (
            <button onClick={() => setMode('signup')} className="text-xs font-bold text-primary/60 hover:text-primary">
              Não tem conta? Criar acesso
            </button>
          ) : (
            <button onClick={() => setMode('login')} className="text-xs font-bold text-primary/60 hover:text-primary">
              Já tem conta? Entrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

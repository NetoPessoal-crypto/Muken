import React, { useEffect, useState } from 'react';
import { useStore } from '../contexts/StoreContext';
import { addMemberByEmail, listMembers, removeMember, setMemberRole } from '../services/accessAdmin';

const ROLES = ['admin', 'operacao', 'leitura'];

export default function Acessos() {
  const { canAdmin, authContext } = useStore();
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('operacao');
  const [loading, setLoading] = useState(() => canAdmin);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const result = await listMembers();
    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setMembers(result.data);
    setLoading(false);
  };

  useEffect(() => {
    if (!canAdmin) return;
    const timer = setTimeout(() => {
      load();
    }, 0);

    return () => clearTimeout(timer);
  }, [canAdmin]);

  const onAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    const result = await addMemberByEmail(email.trim(), role);
    if (!result.success) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setEmail('');
    setRole('operacao');
    setMessage('Membro adicionado/atualizado com sucesso.');
    await load();
    setSaving(false);
  };

  const onRoleChange = async (userId, nextRole) => {
    setError('');
    setMessage('');
    const result = await setMemberRole(userId, nextRole);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setMessage('Role atualizada.');
    await load();
  };

  const onRemove = async (userId) => {
    setError('');
    setMessage('');
    if (!window.confirm('Remover este membro do tenant atual?')) return;
    const result = await removeMember(userId);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setMessage('Membro removido.');
    await load();
  };

  if (!canAdmin) {
    return (
      <div className="max-w-3xl mx-auto bg-white border border-surface-container rounded-3xl p-10">
        <h2 className="text-xl font-black text-primary">Acesso restrito</h2>
        <p className="text-sm text-primary/60 mt-2">Somente administradores podem gerenciar usuários e papéis.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="bg-white border border-surface-container rounded-3xl p-8">
        <p className="text-[10px] font-black uppercase tracking-[2px] text-primary/40">Tenant</p>
        <h1 className="text-2xl font-black text-primary mt-2">Gestão de Acessos</h1>
        <p className="text-sm text-primary/60 mt-2">Tenant atual: <span className="font-bold">{authContext?.tenant?.tenant_id || '-'}</span></p>
      </div>

      <form onSubmit={onAdd} className="bg-white border border-surface-container rounded-3xl p-8 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
        <div className="md:col-span-3">
          <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">E-mail do usuário</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white border-2 border-primary/10 py-3 px-4 rounded-xl mt-1 outline-none hover:border-primary/20 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-sm"
            placeholder="usuario@empresa.com"
          />
        </div>
        <div>
          <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full bg-white border-2 border-primary/10 py-3 px-4 rounded-xl mt-1 outline-none text-sm">
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button type="submit" disabled={saving} className="h-[46px] bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-60">
          {saving ? 'Salvando...' : 'Adicionar'}
        </button>
      </form>

      {(error || message) && (
        <div className="bg-white border border-surface-container rounded-2xl px-6 py-4">
          {error && <p className="text-xs font-bold text-error">{error}</p>}
          {message && <p className="text-xs font-bold text-secondary">{message}</p>}
        </div>
      )}

      <div className="bg-white border border-surface-container rounded-3xl overflow-hidden">
        <div className="grid grid-cols-12 px-8 py-4 bg-surface-bright text-[10px] font-black uppercase tracking-widest text-primary/40">
          <div className="col-span-5">E-mail</div>
          <div className="col-span-4">User ID</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-1 text-right">Ação</div>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-primary/50">Carregando membros...</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-sm text-primary/50">Nenhum membro encontrado.</div>
        ) : (
          members.map((m) => (
            <div key={m.user_id} className="grid grid-cols-12 items-center px-8 py-4 border-t border-surface-container/70">
              <div className="col-span-5 text-sm font-semibold text-primary truncate">{m.email || 'sem-email'}</div>
              <div className="col-span-4 text-[11px] font-mono text-primary/50 truncate">{m.user_id}</div>
              <div className="col-span-2">
                <select
                  value={m.role}
                  onChange={(e) => onRoleChange(m.user_id, e.target.value)}
                  className="w-full bg-white border border-primary/20 py-2 px-3 rounded-lg text-xs font-bold"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="col-span-1 text-right">
                <button
                  onClick={() => onRemove(m.user_id)}
                  disabled={m.user_id === authContext?.userId}
                  className="text-[10px] font-black uppercase tracking-widest text-error disabled:opacity-30"
                >
                  Remover
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

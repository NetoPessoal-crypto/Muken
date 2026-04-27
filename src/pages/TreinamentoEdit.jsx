import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useFeedback } from '../contexts/FeedbackContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function TreinamentoEdit() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fb = useFeedback();
  const nav = useNavigate();

  const bucketCandidates = ['training', 'public', 'beca'];
  const objectPath = 'training/training.md';

  useEffect(() => {
    let mounted = true;
    async function load() {
      for (const bucket of bucketCandidates) {
        try {
          const { data, error } = await supabase.storage.from(bucket).download(objectPath);
          if (!error && data) {
            const text = await data.text();
            if (mounted) setContent(text);
            setLoading(false);
            return;
          }
        } catch (err) {
          // try next
        }
      }
      // fallback to local version already bundled
      try {
        const resp = await fetch('/src/content/training.md');
        if (resp.ok) {
          const txt = await resp.text();
          if (mounted) setContent(txt);
        }
      } catch (e) {
        // ignore
      }
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, []);

  async function onSave() {
    setSaving(true);
    // try to save to first writable bucket
    for (const bucket of bucketCandidates) {
      try {
        const { data, error } = await supabase.storage.from(bucket).upload(objectPath, new Blob([content], { type: 'text/markdown' }), { upsert: true });
        if (!error) {
          fb.notify('Salvo no bucket ' + bucket);
          setSaving(false);
          return;
        }
      } catch (err) {
        // continue
      }
    }
    fb.notifyError('Falha ao salvar no supabase storage. Verifique permissões.');
    setSaving(false);
  }

  function onDownload() {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'training.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center">Carregando...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-primary">Editar Treinamento</h1>
        <div className="flex gap-2">
          <button onClick={onDownload} className="px-3 py-1 border rounded">Download</button>
          <button onClick={onSave} disabled={saving} className="px-3 py-1 bg-primary text-white rounded">{saving ? 'Salvando...' : 'Salvar no Storage'}</button>
          <button onClick={() => nav('/treinamento')} className="px-3 py-1 border rounded">Cancelar</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <textarea value={content} onChange={e => setContent(e.target.value)} className="w-full h-[60vh] p-3 border rounded font-mono" />
        <div className="w-full h-[60vh] p-3 border rounded overflow-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

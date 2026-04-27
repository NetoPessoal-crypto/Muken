import React, { useEffect, useRef, useState } from 'react';
import trainingMd from '../content/training.md?raw';

function extractSection(md, pathname) {
  // basic mapping from pathname to heading id
  const map = {
    '/': 'Dashboard',
    '/jornada': 'Jornada / Pedidos',
    '/estoque': 'Estoque (Produtos e Lotes)',
    '/fornos': 'Fornos / Equipamentos',
    '/expedicao': 'Expedição',
    '/inventario': 'Inventário',
    '/relatorios': 'Relatórios e Rastreabilidade',
    '/acessos': 'Acessos e Permissões',
    '/treinamento': 'Guia de Treinamento e Uso',
  };
  const heading = map[pathname] || map['/'];
  const parts = md.split('\n');
  const start = parts.findIndex(l => l.trim().startsWith('#') && l.includes(heading));
  if (start === -1) return md.slice(0, 1000);
  const slice = parts.slice(start, start + 60).join('\n');
  return slice;
}

export default function HelpModal({ open, onClose, pathname, onStartTour }) {
  if (!open) return null;
  const chunk = extractSection(trainingMd || '', pathname);
  const containerRef = useRef(null);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const el = containerRef.current;
    if (el) el.focus();

    // detect if content is scrollable
    const checkScrollable = () => {
      if (!el) return setScrollable(false);
      setScrollable(el.scrollHeight > el.clientHeight + 10);
    };
    checkScrollable();
    const ro = new ResizeObserver(checkScrollable);
    ro.observe(el);

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      try { ro.disconnect(); } catch (e) {}
    };
  }, [open, onClose]);

  function onKeyDown(e) {
    if (e.key !== 'Tab') return;
    const el = containerRef.current;
    if (!el) return;
    const focusable = Array.from(el.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])')).filter(n => !n.hasAttribute('disabled'));
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" role="dialog" aria-modal="true" onClick={(ev) => { if (ev.target === ev.currentTarget) onClose?.(); }}>
      <div ref={containerRef} onKeyDown={onKeyDown} className="bg-white max-w-2xl w-full p-6 rounded shadow-lg max-h-[calc(100vh-160px)] overflow-auto" tabIndex={-1}>
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-bold">Ajuda - Conteúdo Rápido</h3>
          <button onClick={onClose} className="text-sm text-primary">Fechar</button>
        </div>
        <div className="mt-4 prose max-w-none">
          <pre style={{whiteSpace: 'pre-wrap', margin: 0}}>{chunk}</pre>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => { onStartTour?.(); onClose?.(); }} className="px-3 py-1 border rounded">Iniciar Tour</button>
          <a href="/treinamento" className="px-3 py-1 bg-primary text-white rounded">Abrir Treinamento</a>
        </div>
        {scrollable && (
          <div className="absolute right-6 bottom-6 flex flex-col gap-2">
            <button aria-label="scroll-up" onClick={() => { containerRef.current?.scrollBy({ top: -320, behavior: 'smooth' }); }} className="w-10 h-10 rounded-full bg-white border shadow flex items-center justify-center">▲</button>
            <button aria-label="scroll-down" onClick={() => { containerRef.current?.scrollBy({ top: 320, behavior: 'smooth' }); }} className="w-10 h-10 rounded-full bg-white border shadow flex items-center justify-center">▼</button>
          </div>
        )}
      </div>
    </div>
  );
}

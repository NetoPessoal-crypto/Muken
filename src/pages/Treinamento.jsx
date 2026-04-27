import React, { useMemo } from 'react';
import trainingMd from '../content/training.md?raw';
import { useAuth } from '../contexts/AuthContext';

function simpleMdToHtml(md) {
  // Very small markdown -> HTML converter for headings, paragraphs, lists and links.
  let html = md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/\n\n+/gim, '</p><p>');
  // Wrap list items into <ul>
  html = html.replace(/(?:<li>.*?<\/li>\s*)+/gim, (match) => `<ul>${match}</ul>`);
  // Wrap remaining text in paragraphs
  if (!html.startsWith('<h1') && !html.startsWith('<h2') && !html.startsWith('<h3')) {
    html = `<p>${html}</p>`;
  }
  // basic links
  html = html.replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return html;
}

export default function Treinamento() {
  const { user } = useAuth();
  const html = useMemo(() => simpleMdToHtml(trainingMd || ''), [trainingMd]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-primary">Guia de Treinamento e Uso</h1>
        {user?.role === 'admin' && (
          <a href="/treinamento/edit" className="text-sm px-3 py-1 bg-primary text-white rounded">Editar</a>
        )}
      </div>

      <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

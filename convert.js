import fs from 'fs';

let html = fs.readFileSync('painel_soft_curator.html', 'utf8');

const bodyMatch = html.match(/<body[^>]*>([\\s\\S]*?)<\\/body>/i);
let content = bodyMatch ? bodyMatch[1] : html;

// JSX substitutions
content = content.replace(/class=/g, 'className=');
content = content.replace(/for=/g, 'htmlFor=');
content = content.replace(/stroke-width=/g, 'strokeWidth=');
content = content.replace(/stroke-linecap=/g, 'strokeLinecap=');
content = content.replace(/stroke-linejoin=/g, 'strokeLinejoin=');
content = content.replace(/stroke-dasharray=/g, 'strokeDasharray=');
content = content.replace(/fill-rule=/g, 'fillRule=');
content = content.replace(/clip-rule=/g, 'clipRule=');
content = content.replace(/viewbox=/gi, 'viewBox=');

// Fix unclosed tags using regex without backreferences causing syntax error in earlier node versions
content = content.replace(/<img(.*?)>/gi, '<img$1 />');
content = content.replace(/<img(.*?)\/> \/>/gi, '<img$1 />'); // Fix double close if it was already closed
content = content.replace(/<input(.*?)>/gi, '<input$1 />');
content = content.replace(/<input(.*?)\/> \/>/gi, '<input$1 />');
content = content.replace(/<hr(.*?)>/gi, '<hr$1 />');
content = content.replace(/<br(.*?)>/gi, '<br$1 />');
content = content.replace(/<path(.*?)>/gi, '<path$1 />');
content = content.replace(/<path(.*?)\/> \/>/gi, '<path$1 />');
content = content.replace(/<circle(.*?)>/gi, '<circle$1 />');
content = content.replace(/<circle(.*?)\/> \/>/gi, '<circle$1 />');

// Remove comments
content = content.replace(/<!--[\\s\\S]*?-->/g, '');

const jsx = \`import React from 'react';

export default function App() {
  return (
    <>
      \${content}
    </>
  );
}
\`;

fs.writeFileSync('src/App.jsx', jsx);
console.log('Done!');

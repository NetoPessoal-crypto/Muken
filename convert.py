import re

with open('painel_soft_curator.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Extract body
body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.IGNORECASE | re.DOTALL)
if body_match:
    content = body_match.group(1)
else:
    content = html

# JSX Replacements
replacements = {
    'class=': 'className=',
    'for=': 'htmlFor=',
    'stroke-width=': 'strokeWidth=',
    'stroke-linecap=': 'strokeLinecap=',
    'stroke-linejoin=': 'strokeLinejoin=',
    'stroke-dasharray=': 'strokeDasharray=',
    'fill-rule=': 'fillRule=',
    'clip-rule=': 'clipRule=',
    'viewbox=': 'viewBox=',
    '<!--': '{/* ',
    '-->': ' */}'
}

# Apply dictionary replacements
for old, new in replacements.items():
    # Case insensitive specifically for viewbox
    if old == 'viewbox=':
        content = re.sub(re.escape(old), new, content, flags=re.IGNORECASE)
    else:
        content = content.replace(old, new)

# Fix unclosed self-closing tags
self_closing = ['img', 'input', 'hr', 'br', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'ellipse']
for tag in self_closing:
    # Match tag with attributes. If not ending in '/>', make it '/>'
    content = re.sub(rf'<{tag}(\s+[^>]*)?(?<!/)>', rf'<{tag}\1 />', content, flags=re.IGNORECASE)

jsx = f"""import React from 'react';

export default function App() {{
  return (
    <>
{content}
    </>
  );
}}
"""

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(jsx)

print("App.jsx created successfully")

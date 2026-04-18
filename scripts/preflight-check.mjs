import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function parseEnv(filePath) {
  const text = readFileSync(filePath, 'utf8');
  const result = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    result[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return result;
}

const root = process.cwd();
const envFile = process.argv[2] || '.env.local';
const filePath = path.join(root, envFile);

if (!existsSync(filePath)) {
  console.error(`Arquivo nao encontrado: ${envFile}`);
  process.exit(1);
}

const env = parseEnv(filePath);
const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
const missing = required.filter((key) => !env[key]);

if (missing.length > 0) {
  console.error(`Variaveis faltando em ${envFile}: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`Preflight OK para ${envFile}`);

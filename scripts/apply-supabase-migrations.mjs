import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Client } from 'pg';

function parseEnvText(text) {
  const env = {};
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    env[key] = value;
  }
  return env;
}

async function loadEnvFile(filePath) {
  const text = await readFile(filePath, 'utf8');
  return parseEnvText(text);
}

function buildConnectionString(env) {
  if (env.SUPABASE_DB_URL) return env.SUPABASE_DB_URL;

  const ref = env.SUPABASE_PROJECT_REF;
  const password = env.SUPABASE_DB_PASSWORD;
  if (!ref || !password) {
    throw new Error('Faltam variaveis SUPABASE_PROJECT_REF/SUPABASE_DB_PASSWORD (ou SUPABASE_DB_URL).');
  }

  return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
}

async function main() {
  const root = process.cwd();
  const envPath = path.join(root, '.env.supabase');
  const migrationsDir = path.join(root, 'supabase', 'migrations');

  const env = await loadEnvFile(envPath);
  const connectionString = buildConnectionString(env);

  const allFiles = (await readdir(migrationsDir))
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const selected = process.argv.slice(2);
  const files = selected.length > 0
    ? selected
    : allFiles;

  if (files.length === 0) {
    console.log('Nenhuma migration encontrada.');
    return;
  }

  for (const file of files) {
    if (!allFiles.includes(file)) {
      throw new Error(`Migration nao encontrada: ${file}`);
    }
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    for (const file of files) {
      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      if (!sql.trim()) continue;

      console.log(`Aplicando: ${file}`);
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw new Error(`Falha em ${file}: ${error.message}`);
      }
    }

    console.log('Migrations aplicadas com sucesso.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

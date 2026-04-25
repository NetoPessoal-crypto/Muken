import { readFile } from 'node:fs/promises';
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
  if (!ref || !password) throw new Error('Faltam variaveis SUPABASE_PROJECT_REF/SUPABASE_DB_PASSWORD (ou SUPABASE_DB_URL).');
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
}

async function main() {
  const root = process.cwd();
  const envPath = path.join(root, '.env.supabase');
  const env = await loadEnvFile(envPath);
  const connectionString = buildConnectionString(env);

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    console.log('Connected. Running checks...');

    const res1 = await client.query("SELECT to_regclass('public.beca_lot_genealogy') as exists; ");
    console.log('b e c a_lot_genealogy exists:', res1.rows[0].exists);

    const res2 = await client.query("SELECT count(*) as ct FROM public.beca_lot_genealogy;");
    console.log('b e c a_lot_genealogy row count:', res2.rows[0].ct);

    const res3 = await client.query("SELECT proname FROM pg_proc WHERE proname = 'beca_get_lot_genealogy';");
    console.log('func beca_get_lot_genealogy present:', res3.rowCount > 0);

    const res4 = await client.query("SELECT oid FROM pg_proc WHERE proname = 'beca_advance_order_status' LIMIT 1;");
    if (res4.rowCount > 0) {
      const oid = res4.rows[0].oid;
      const def = await client.query('SELECT pg_get_functiondef($1::oid) as def', [oid]);
      const found = def.rows[0].def.includes('b e c a_lot_genealogy') || def.rows[0].def.includes('beca_lot_genealogy');
      console.log('beca_advance_order_status contains reference to beca_lot_genealogy:', found);
    } else {
      console.log('beca_advance_order_status not found');
    }

    // call the read RPC (safe) to ensure it executes
    try {
      const g = await client.query("select public.beca_get_lot_genealogy(null, null, null) as data;");
      console.log('beca_get_lot_genealogy() executed; sample length:', Array.isArray(g.rows) ? (g.rows[0].data ? g.rows[0].data.length : 0) : 'n/a');
    } catch (err) {
      console.log('Error calling beca_get_lot_genealogy():', err.message);
    }

    console.log('Checks complete.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

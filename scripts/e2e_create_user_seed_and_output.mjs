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

async function createAdminUser(supabaseUrl, serviceKey, email, password) {
  const url = `${supabaseUrl.replace(/\/+$/,'')}/auth/v1/admin/users`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`failed to create admin user: ${res.status} ${text}`);
  }
  return res.json();
}

async function main() {
  const root = process.cwd();
  const envSupPath = path.join(root, '.env.supabase');
  const envLocalPath = path.join(root, '.env.local');
  let envSup = {};
  let envLocal = {};
  try { envSup = await loadEnvFile(envSupPath); } catch (e) { envSup = {}; }
  try { envLocal = await loadEnvFile(envLocalPath); } catch (e) { envLocal = {}; }

  // prefer environment variables (CI secrets) over files
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ACCESS_TOKEN || envSup.SUPABASE_SERVICE_ROLE_KEY || envSup.SUPABASE_ACCESS_TOKEN;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || envLocal.VITE_SUPABASE_URL || envSup.SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ACCESS_TOKEN) or VITE_SUPABASE_URL. Add them as repo secrets or in .env files.');
  }

  const email = `e2e+${Date.now()}@example.com`;
  const password = 'Test123!';

  const user = await createAdminUser(supabaseUrl, serviceKey, email, password);
  const userId = user?.id || user?.data?.id;
  if (!userId) throw new Error('admin user creation returned no id');

  const client = new Client({ connectionString: buildConnectionString(envSup), ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // create tenant and membership for this user
    const t = await client.query("insert into public.beca_tenants(name) values('E2E Tenant') returning id");
    const tenantId = t.rows[0].id;
    await client.query("insert into public.beca_memberships(tenant_id, user_id, role) values ($1, $2, 'admin') on conflict (tenant_id, user_id) do update set role = excluded.role;", [tenantId, userId]);
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);

    // seed products, lots and order
    await client.query("insert into public.beca_products(id, tenant_id, type, name, sku, unit, custo_producao) values ('A',$1,'ingrediente','Insumo A','A-001','kg',0) on conflict (id) do update set tenant_id=excluded.tenant_id;", [tenantId]);
    await client.query("insert into public.beca_products(id, tenant_id, type, name, sku, unit, custo_producao) values ('B',$1,'ingrediente','Insumo B','B-001','kg',0) on conflict (id) do update set tenant_id=excluded.tenant_id;", [tenantId]);
    const receita = JSON.stringify({ rendimento: 1, ingredientes: [ { id: 'A', uso: 0.5, unit_uso: 'kg' }, { id: 'B', uso: 0.25, unit_uso: 'kg' } ] });
    await client.query("insert into public.beca_products(id, tenant_id, type, name, sku, unit, custo_producao, receita) values ('P',$2,'produto_final','Produto P','P-001','kg',0, $1) on conflict (id) do update set receita = excluded.receita, tenant_id=excluded.tenant_id;", [receita, tenantId]);

    await client.query("insert into public.beca_product_lots(product_id, lote_id, qtd, validade, tenant_id) values ('A',$2 || '-LA1', 100, '2099-12-31', $1) on conflict (product_id, lote_id) do update set qtd = public.beca_product_lots.qtd + excluded.qtd;", [tenantId, tenantId.slice(0,8)]);
    await client.query("insert into public.beca_product_lots(product_id, lote_id, qtd, validade, tenant_id) values ('B',$2 || '-LB1', 100, '2099-12-31', $1) on conflict (product_id, lote_id) do update set qtd = public.beca_product_lots.qtd + excluded.qtd;", [tenantId, tenantId.slice(0,8)]);

    const orderId = 'E2E-' + Math.random().toString(36).slice(2, 8);
    await client.query("insert into public.beca_orders(id, cliente, produto_final_id, quantidade, status, data, tenant_id) values ($1,'E2E Test','P', 1, 'pendente', now(), $2)", [orderId, tenantId]);

    await client.query("select public.beca_advance_order_status($1, 'producao','e2e-create')", [orderId]);

    const produced = await client.query("select id, lote_id, qtd from public.beca_product_lots where product_id='P' and tenant_id=$1 order by created_at desc limit 1", [tenantId]);
    const genealogy = await client.query("select parent_lot_uuid, child_lot_uuid, qty_used from public.beca_lot_genealogy where order_id=$1", [orderId]);

    const out = {
      email,
      password,
      orderId,
      producedLot: produced.rows[0] || null,
      genealogy: genealogy.rows || [],
    };

    console.log(JSON.stringify(out));
    process.exit(0);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

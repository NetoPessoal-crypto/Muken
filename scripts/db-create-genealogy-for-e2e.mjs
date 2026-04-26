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
  const client = new Client({ connectionString: buildConnectionString(env), ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // create tenant and test user
    const t = await client.query("insert into public.beca_tenants(name) values('E2E Tenant') returning id");
    const tenantId = t.rows[0].id;

    const u = await client.query("select gen_random_uuid() as id");
    const userId = u.rows[0].id;
    await client.query("insert into public.beca_memberships(tenant_id, user_id, role) values ($1, $2, 'admin') on conflict (tenant_id, user_id) do update set role = excluded.role;", [tenantId, userId]);

    // create products and recipe
    await client.query("insert into public.beca_products(id, tenant_id, type, name, sku, unit, custo_producao) values ('A',$1,'ingrediente','Insumo A','A-001','kg',0) on conflict (id) do update set tenant_id=excluded.tenant_id;", [tenantId]);
    await client.query("insert into public.beca_products(id, tenant_id, type, name, sku, unit, custo_producao) values ('B',$1,'ingrediente','Insumo B','B-001','kg',0) on conflict (id) do update set tenant_id=excluded.tenant_id;", [tenantId]);
    const receita = JSON.stringify({ rendimento: 1, ingredientes: [ { id: 'A', uso: 0.5, unit_uso: 'kg' }, { id: 'B', uso: 0.25, unit_uso: 'kg' } ] });
    await client.query("insert into public.beca_products(id, tenant_id, type, name, sku, unit, custo_producao, receita) values ('P',$2,'produto_final','Produto P','P-001','kg',0, $1) on conflict (id) do update set receita = excluded.receita, tenant_id=excluded.tenant_id;", [receita, tenantId]);

    // add stock
    await client.query("insert into public.beca_product_lots(product_id, lote_id, qtd, validade, tenant_id) values ('A', $2 || '-LA1', 100, '2099-12-31', $1) on conflict (product_id, lote_id) do update set qtd = public.beca_product_lots.qtd + excluded.qtd;", [tenantId, tenantId.slice(0,8)]);
    await client.query("insert into public.beca_product_lots(product_id, lote_id, qtd, validade, tenant_id) values ('B', $2 || '-LB1', 100, '2099-12-31', $1) on conflict (product_id, lote_id) do update set qtd = public.beca_product_lots.qtd + excluded.qtd;", [tenantId, tenantId.slice(0,8)]);

    const orderId = 'E2E-' + Math.random().toString(36).slice(2, 8);
    await client.query("insert into public.beca_orders(id, cliente, produto_final_id, quantidade, status, data, tenant_id) values ($1,'E2E Test','P', 1, 'pendente', now(), $2)", [orderId, tenantId]);

    // set session claim for the subsequent RPC
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);

    await client.query("select public.beca_advance_order_status($1, 'producao','e2e-create')", [orderId]);

    const produced = await client.query("select id, lote_id, qtd from public.beca_product_lots where product_id='P' and tenant_id=$1 order by created_at desc limit 1", [tenantId]);
    const genealogy = await client.query("select parent_lot_uuid, child_lot_uuid, qty_used from public.beca_lot_genealogy where order_id=$1", [orderId]);

    const out = {
      orderId,
      producedLot: produced.rows[0] || null,
      genealogy: genealogy.rows || [],
      tenantId,
      userId,
    };

    console.log(JSON.stringify(out));
    process.exit(0);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

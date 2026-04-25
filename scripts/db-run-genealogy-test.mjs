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

async function run() {
  // allow CI to pass credentials as env vars; fall back to .env.supabase when running locally
  const root = process.cwd();
  const envPath = path.join(root, '.env.supabase');
  let env = {};
  try { env = await loadEnvFile(envPath); } catch (e) { env = {}; }
  // override with process.env if present
  env.SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || env.SUPABASE_PROJECT_REF;
  env.SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || env.SUPABASE_DB_PASSWORD;
  const client = new Client({ connectionString: buildConnectionString(env), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('Iniciando teste de genealogia (transação com rollback)');
  await client.query('begin');
  try {
    // ensure tenant exists
    const t = await client.query("select id from public.beca_tenants limit 1");
    let tenantId;
    if (t.rowCount === 0) {
      const r = await client.query("insert into public.beca_tenants(name) values('Test Tenant CI') returning id");
      tenantId = r.rows[0].id;
    } else {
      tenantId = t.rows[0].id;
    }

    // create a test user context
    const u = await client.query("select gen_random_uuid() as id");
    const testUserId = u.rows[0].id;
    await client.query("insert into public.beca_memberships(tenant_id, user_id, role) values ($1, $2, 'admin') on conflict (tenant_id, user_id) do update set role = excluded.role;", [tenantId, testUserId]);
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [testUserId]);

    // create products and recipe
    await client.query("insert into public.beca_products(id, tenant_id, type, name, sku, unit, custo_producao) values ('A',$1,'ingrediente','Insumo A','A-001','kg',0) on conflict (id) do update set tenant_id=excluded.tenant_id;", [tenantId]);
    await client.query("insert into public.beca_products(id, tenant_id, type, name, sku, unit, custo_producao) values ('B',$1,'ingrediente','Insumo B','B-001','kg',0) on conflict (id) do update set tenant_id=excluded.tenant_id;", [tenantId]);
    const receita = JSON.stringify({ rendimento: 1, ingredientes: [ { id: 'A', uso: 0.5, unit_uso: 'kg' }, { id: 'B', uso: 0.25, unit_uso: 'kg' } ] });
    await client.query("insert into public.beca_products(id, tenant_id, type, name, sku, unit, custo_producao, receita) values ('P',$2,'produto_final','Produto P','P-001','kg',0, $1) on conflict (id) do update set receita = excluded.receita, tenant_id=excluded.tenant_id;", [receita, tenantId]);

    // create parent lots
    await client.query("insert into public.beca_product_lots(product_id, lote_id, qtd, validade, tenant_id) values ('A','LA1', 10, '2099-12-31', $1) on conflict (product_id, lote_id) do update set qtd = public.beca_product_lots.qtd + excluded.qtd;", [tenantId]);
    await client.query("insert into public.beca_product_lots(product_id, lote_id, qtd, validade, tenant_id) values ('B','LB1', 10, '2099-12-31', $1) on conflict (product_id, lote_id) do update set qtd = public.beca_product_lots.qtd + excluded.qtd;", [tenantId]);

    // create order
    const orderId = 'CI-' + Math.random().toString(36).slice(2, 8);
    await client.query("insert into public.beca_orders(id, cliente, produto_final_id, quantidade, status, data, tenant_id) values ($1,'CI Test','P', 1, 'pendente', now(), $2)", [orderId, tenantId]);

    // advance to production
    await client.query("select public.beca_advance_order_status($1, 'producao','ci-test')", [orderId]);

    // assertions
    const moves = await client.query("select kind, product_id, lote_id, qty from public.beca_stock_moves where ref_type='order' and ref_id=$1 order by at", [orderId]);
    if (moves.rowCount < 3) throw new Error('esperado >=3 stock_moves gerados');

    const produced = await client.query("select id, lote_id, qtd from public.beca_product_lots where product_id='P' and tenant_id=$1 order by created_at desc limit 1", [tenantId]);
    if (produced.rowCount === 0) throw new Error('lote produzido nao encontrado');

    const gene = await client.query("select count(*)::int as ct from public.beca_lot_genealogy where order_id=$1", [orderId]);
    if (gene.rows[0].ct < 1) throw new Error('genealogia nao populada');

    // test cancellation
    await client.query("select public.beca_advance_order_status($1, 'cancelado','ci-test-cancel')", [orderId]);
    const geneAfter = await client.query("select count(*)::int as ct from public.beca_lot_genealogy where order_id=$1", [orderId]);
    if (geneAfter.rows[0].ct !== 0) throw new Error('genealogia deveria ter sido removida apos cancelamento');

    // if everything ok, rollback (we used transaction) to leave DB untouched
    await client.query('rollback');
    console.log('Teste de genealogia passou (transação revertida)');
    process.exit(0);
  } catch (err) {
    try { await client.query('rollback'); } catch (e) {}
    console.error('Teste falhou:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });

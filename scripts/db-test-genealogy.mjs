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
    console.log('=== criando dados de teste ===');
    // descobrir tenant (ou criar se ausente)
    const t = await client.query("select id from public.beca_tenants limit 1");
    let tenantId;
    if (t.rowCount === 0) {
      const r = await client.query("insert into public.beca_tenants(name) values('Test Tenant') returning id;");
      tenantId = r.rows[0].id;
    } else {
      tenantId = t.rows[0].id;
    }

    // criar um user_id de teste e membership para simular auth.uid()
    const u = await client.query("select gen_random_uuid() as id");
    const testUserId = u.rows[0].id;
    await client.query("insert into public.beca_memberships(tenant_id, user_id, role) values ($1, $2, 'admin') on conflict (tenant_id, user_id) do update set role = excluded.role;", [tenantId, testUserId]);
    // set session jwt claim so auth.uid() resolves to our test user
    // set session jwt claim so auth.uid() resolves to our test user (not local to transaction)
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [testUserId]);

    // criar produtos: insumo A, insumo B, produto final P (incluindo tenant_id)
    await client.query("insert into public.beca_products(id, tenant_id, type, name, sku, unit, custo_producao) values ('A',$1,'ingrediente','Insumo A','A-001','kg',0) on conflict (id) do update set tenant_id=excluded.tenant_id;", [tenantId]);
    await client.query("insert into public.beca_products(id, tenant_id, type, name, sku, unit, custo_producao) values ('B',$1,'ingrediente','Insumo B','B-001','kg',0) on conflict (id) do update set tenant_id=excluded.tenant_id;", [tenantId]);
    // receita: usa 0.5 kg A e 0.25 kg B, rendimento 1
    const receita = JSON.stringify({ rendimento: 1, ingredientes: [ { id: 'A', uso: 0.5, unit_uso: 'kg' }, { id: 'B', uso: 0.25, unit_uso: 'kg' } ] });
    await client.query("insert into public.beca_products(id, tenant_id, type, name, sku, unit, custo_producao, receita) values ('P',$2,'produto_final','Produto P','P-001','kg',0, $1) on conflict (id) do update set receita = excluded.receita, tenant_id=excluded.tenant_id;", [receita, tenantId]);

    // criar lotes pais para A e B
    await client.query("insert into public.beca_product_lots(product_id, lote_id, qtd, validade, tenant_id) values ('A','LA1', 10, '2099-12-31', $1) on conflict (product_id, lote_id) do update set qtd = public.beca_product_lots.qtd + excluded.qtd;", [tenantId]);
    await client.query("insert into public.beca_product_lots(product_id, lote_id, qtd, validade, tenant_id) values ('B','LB1', 10, '2099-12-31', $1) on conflict (product_id, lote_id) do update set qtd = public.beca_product_lots.qtd + excluded.qtd;", [tenantId]);

    // criar order
    const orderId = 'TST-' + Math.random().toString(36).slice(2, 8);
    await client.query("insert into public.beca_orders(id, cliente, produto_final_id, quantidade, status, data, tenant_id) values ($1,'Cliente Teste','P', 1, 'pendente', now(), $2)", [orderId, tenantId]);
    console.log('Order criada:', orderId);

    // diagnostico: imprimir auth.uid() e setting
    const au = await client.query("select auth.uid() as uid, current_setting('request.jwt.claim.sub', true) as jwt_sub;");
    console.log('auth.uid(), jwt_sub:', au.rows[0]);
    const mem = await client.query('select * from public.beca_memberships where tenant_id = $1 and user_id = $2', [tenantId, au.rows[0].uid]);
    console.log('membership rows matching auth.uid():', mem.rows.length);

    // avançar para producao
    console.log('Chamando beca_advance_order_status -> producao');
    await client.query("select public.beca_advance_order_status($1, 'producao','test-genealogy')", [orderId]);

    // checar stock_moves e genealogy
    const moves = await client.query("select id, kind, product_id, lote_id, qty from public.beca_stock_moves where ref_type='order' and ref_id=$1 order by at", [orderId]);
    console.log('stock_moves for order:', moves.rows);

    const producedLot = await client.query("select * from public.beca_product_lots where product_id='P' order by created_at desc limit 1");
    console.log('produced lot row:', producedLot.rows[0]);

    const genealogy = await client.query("select * from public.beca_lot_genealogy where order_id=$1", [orderId]);
    console.log('genealogy rows for order:', genealogy.rows);

    // agora estornar (cancelar)
    console.log('Chamando beca_advance_order_status -> cancelado');
    await client.query("select public.beca_advance_order_status($1, 'cancelado','test-estorno')", [orderId]);

    const genealogyAfter = await client.query("select * from public.beca_lot_genealogy where order_id=$1", [orderId]);
    console.log('genealogy rows after cancel:', genealogyAfter.rows);

    console.log('=== cleanup (removendo order e stock moves criados) ===');
    await client.query("delete from public.beca_stock_moves where ref_type='order' and ref_id=$1", [orderId]);
    await client.query("delete from public.beca_orders where id=$1", [orderId]);

    console.log('Teste concluido.');
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

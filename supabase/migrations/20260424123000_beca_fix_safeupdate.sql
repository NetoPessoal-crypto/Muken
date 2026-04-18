create or replace function public.beca_replace_app_state(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _products jsonb := coalesce(p_payload->'products', '[]'::jsonb);
  _equipments jsonb := coalesce(p_payload->'equipments', '[]'::jsonb);
  _metrics jsonb := coalesce(p_payload->'metrics', '{}'::jsonb);
  _orders jsonb := coalesce(p_payload->'orders', '[]'::jsonb);
  _stock_moves jsonb := coalesce(p_payload->'stockMoves', '[]'::jsonb);
  _audit_logs jsonb := coalesce(p_payload->'auditLogs', '[]'::jsonb);
begin
  insert into public.beca_products (id, type, name, sku, unit, custo_producao, ativo, receita)
  select
    p->>'id',
    p->>'type',
    p->>'name',
    p->>'sku',
    p->>'unit',
    coalesce((p->>'custo_producao')::numeric, 0),
    coalesce((p->>'ativo')::boolean, true),
    p->'receita'
  from jsonb_array_elements(_products) p
  on conflict (id) do update set
    type = excluded.type,
    name = excluded.name,
    sku = excluded.sku,
    unit = excluded.unit,
    custo_producao = excluded.custo_producao,
    ativo = excluded.ativo,
    receita = excluded.receita;

  delete from public.beca_products
  where id not in (select p->>'id' from jsonb_array_elements(_products) p)
    and true;

  delete from public.beca_product_lots where true;
  insert into public.beca_product_lots (product_id, lote_id, qtd, validade)
  select
    p->>'id',
    l->>'loteId',
    coalesce((l->>'qtd')::numeric, 0),
    nullif(l->>'validade', '')::date
  from jsonb_array_elements(_products) p
  cross join lateral jsonb_array_elements(coalesce(p->'lotes', '[]'::jsonb)) l
  where p->>'id' is not null and l->>'loteId' is not null;

  insert into public.beca_equipments (id, name, type, health, status)
  select
    e->>'id',
    e->>'name',
    e->>'type',
    nullif(e->>'health', '')::numeric,
    e->>'status'
  from jsonb_array_elements(_equipments) e
  on conflict (id) do update set
    name = excluded.name,
    type = excluded.type,
    health = excluded.health,
    status = excluded.status;

  delete from public.beca_equipments
  where id not in (select e->>'id' from jsonb_array_elements(_equipments) e)
    and true;

  insert into public.beca_orders (
    id,
    cliente,
    produto_final_id,
    quantidade,
    status,
    data,
    prazo,
    estoque_baixado,
    move_refs,
    history
  )
  select
    o->>'id',
    o->>'cliente',
    o->>'produtoFinalId',
    coalesce((o->>'quantidade')::numeric, 0),
    o->>'status',
    coalesce((o->>'data')::timestamptz, now()),
    nullif(o->>'prazo', '')::date,
    coalesce((o->>'estoqueBaixado')::boolean, false),
    coalesce(o->'moveRefs', '[]'::jsonb),
    coalesce(o->'history', '[]'::jsonb)
  from jsonb_array_elements(_orders) o
  on conflict (id) do update set
    cliente = excluded.cliente,
    produto_final_id = excluded.produto_final_id,
    quantidade = excluded.quantidade,
    status = excluded.status,
    data = excluded.data,
    prazo = excluded.prazo,
    estoque_baixado = excluded.estoque_baixado,
    move_refs = excluded.move_refs,
    history = excluded.history;

  delete from public.beca_orders
  where id not in (select o->>'id' from jsonb_array_elements(_orders) o)
    and true;

  insert into public.beca_stock_moves (
    id,
    kind,
    ref_type,
    ref_id,
    product_id,
    lote_id,
    qty,
    unit,
    at
  )
  select
    s->>'id',
    s->>'kind',
    s->>'refType',
    s->>'refId',
    s->>'productId',
    s->>'loteId',
    nullif(s->>'qty', '')::numeric,
    s->>'unit',
    coalesce((s->>'at')::timestamptz, now())
  from jsonb_array_elements(_stock_moves) s
  on conflict (id) do update set
    kind = excluded.kind,
    ref_type = excluded.ref_type,
    ref_id = excluded.ref_id,
    product_id = excluded.product_id,
    lote_id = excluded.lote_id,
    qty = excluded.qty,
    unit = excluded.unit,
    at = excluded.at;

  delete from public.beca_stock_moves
  where id not in (select s->>'id' from jsonb_array_elements(_stock_moves) s)
    and true;

  insert into public.beca_audit_logs (
    id,
    action,
    entity,
    before_data,
    after_data,
    reason,
    at
  )
  select
    a->>'id',
    a->>'action',
    a->>'entity',
    a->'before',
    a->'after',
    a->>'reason',
    coalesce((a->>'at')::timestamptz, now())
  from jsonb_array_elements(_audit_logs) a
  on conflict (id) do update set
    action = excluded.action,
    entity = excluded.entity,
    before_data = excluded.before_data,
    after_data = excluded.after_data,
    reason = excluded.reason,
    at = excluded.at;

  delete from public.beca_audit_logs
  where id not in (select a->>'id' from jsonb_array_elements(_audit_logs) a)
    and true;

  insert into public.beca_metrics (id, data)
  values (1, _metrics)
  on conflict (id) do update set data = excluded.data;

  return public.beca_get_app_state();
end;
$$;

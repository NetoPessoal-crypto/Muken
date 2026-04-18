create or replace function public.beca_get_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.beca_memberships m
  where m.user_id = auth.uid()
  order by m.created_at asc
  limit 1;
$$;

create or replace function public.beca_can_write()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.beca_get_current_role() in ('admin', 'operacao'), false);
$$;

create or replace function public.beca_get_my_access()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'tenant_id', public.beca_get_current_tenant_id(),
    'role', public.beca_get_current_role(),
    'can_write', public.beca_can_write()
  );
$$;

create or replace function public.beca_replace_app_state(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant_id uuid := public.beca_get_current_tenant_id();
  _role text := public.beca_get_current_role();
  _products jsonb := coalesce(p_payload->'products', '[]'::jsonb);
  _equipments jsonb := coalesce(p_payload->'equipments', '[]'::jsonb);
  _metrics jsonb := coalesce(p_payload->'metrics', '{}'::jsonb);
  _orders jsonb := coalesce(p_payload->'orders', '[]'::jsonb);
  _stock_moves jsonb := coalesce(p_payload->'stockMoves', '[]'::jsonb);
  _audit_logs jsonb := coalesce(p_payload->'auditLogs', '[]'::jsonb);
begin
  if _tenant_id is null then
    raise exception 'Tenant não encontrado para o usuário atual.';
  end if;

  if _role not in ('admin', 'operacao') then
    raise exception 'Permissão negada para escrita de estado.';
  end if;

  insert into public.beca_products (id, tenant_id, type, name, sku, unit, custo_producao, ativo, receita)
  select
    p->>'id',
    _tenant_id,
    p->>'type',
    p->>'name',
    p->>'sku',
    p->>'unit',
    coalesce((p->>'custo_producao')::numeric, 0),
    coalesce((p->>'ativo')::boolean, true),
    p->'receita'
  from jsonb_array_elements(_products) p
  on conflict (id) do update set
    tenant_id = excluded.tenant_id,
    type = excluded.type,
    name = excluded.name,
    sku = excluded.sku,
    unit = excluded.unit,
    custo_producao = excluded.custo_producao,
    ativo = excluded.ativo,
    receita = excluded.receita;

  delete from public.beca_products
  where tenant_id = _tenant_id
    and id not in (select p->>'id' from jsonb_array_elements(_products) p)
    and true;

  delete from public.beca_product_lots where tenant_id = _tenant_id and true;
  insert into public.beca_product_lots (tenant_id, product_id, lote_id, qtd, validade)
  select
    _tenant_id,
    p->>'id',
    l->>'loteId',
    coalesce((l->>'qtd')::numeric, 0),
    nullif(l->>'validade', '')::date
  from jsonb_array_elements(_products) p
  cross join lateral jsonb_array_elements(coalesce(p->'lotes', '[]'::jsonb)) l
  where p->>'id' is not null and l->>'loteId' is not null;

  insert into public.beca_equipments (id, tenant_id, name, type, health, status)
  select
    e->>'id',
    _tenant_id,
    e->>'name',
    e->>'type',
    nullif(e->>'health', '')::numeric,
    e->>'status'
  from jsonb_array_elements(_equipments) e
  on conflict (id) do update set
    tenant_id = excluded.tenant_id,
    name = excluded.name,
    type = excluded.type,
    health = excluded.health,
    status = excluded.status;

  delete from public.beca_equipments
  where tenant_id = _tenant_id
    and id not in (select e->>'id' from jsonb_array_elements(_equipments) e)
    and true;

  insert into public.beca_orders (
    id,
    tenant_id,
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
    _tenant_id,
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
    tenant_id = excluded.tenant_id,
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
  where tenant_id = _tenant_id
    and id not in (select o->>'id' from jsonb_array_elements(_orders) o)
    and true;

  insert into public.beca_stock_moves (
    id,
    tenant_id,
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
    _tenant_id,
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
    tenant_id = excluded.tenant_id,
    kind = excluded.kind,
    ref_type = excluded.ref_type,
    ref_id = excluded.ref_id,
    product_id = excluded.product_id,
    lote_id = excluded.lote_id,
    qty = excluded.qty,
    unit = excluded.unit,
    at = excluded.at;

  delete from public.beca_stock_moves
  where tenant_id = _tenant_id
    and id not in (select s->>'id' from jsonb_array_elements(_stock_moves) s)
    and true;

  insert into public.beca_audit_logs (
    id,
    tenant_id,
    action,
    entity,
    before_data,
    after_data,
    reason,
    at
  )
  select
    a->>'id',
    _tenant_id,
    a->>'action',
    a->>'entity',
    a->'before',
    a->'after',
    a->>'reason',
    coalesce((a->>'at')::timestamptz, now())
  from jsonb_array_elements(_audit_logs) a
  on conflict (id) do update set
    tenant_id = excluded.tenant_id,
    action = excluded.action,
    entity = excluded.entity,
    before_data = excluded.before_data,
    after_data = excluded.after_data,
    reason = excluded.reason,
    at = excluded.at;

  delete from public.beca_audit_logs
  where tenant_id = _tenant_id
    and id not in (select a->>'id' from jsonb_array_elements(_audit_logs) a)
    and true;

  insert into public.beca_metrics (tenant_id, id, data)
  values (_tenant_id, 1, _metrics)
  on conflict (tenant_id) do update set data = excluded.data;

  return public.beca_get_app_state();
end;
$$;

drop policy if exists beca_products_tenant on public.beca_products;
create policy beca_products_tenant_select on public.beca_products
for select to authenticated
using (tenant_id = public.beca_get_current_tenant_id());
create policy beca_products_tenant_write on public.beca_products
for all to authenticated
using (tenant_id = public.beca_get_current_tenant_id() and public.beca_can_write())
with check (tenant_id = public.beca_get_current_tenant_id() and public.beca_can_write());

drop policy if exists beca_product_lots_tenant on public.beca_product_lots;
create policy beca_product_lots_tenant_select on public.beca_product_lots
for select to authenticated
using (tenant_id = public.beca_get_current_tenant_id());
create policy beca_product_lots_tenant_write on public.beca_product_lots
for all to authenticated
using (tenant_id = public.beca_get_current_tenant_id() and public.beca_can_write())
with check (tenant_id = public.beca_get_current_tenant_id() and public.beca_can_write());

drop policy if exists beca_orders_tenant on public.beca_orders;
create policy beca_orders_tenant_select on public.beca_orders
for select to authenticated
using (tenant_id = public.beca_get_current_tenant_id());
create policy beca_orders_tenant_write on public.beca_orders
for all to authenticated
using (tenant_id = public.beca_get_current_tenant_id() and public.beca_can_write())
with check (tenant_id = public.beca_get_current_tenant_id() and public.beca_can_write());

drop policy if exists beca_equipments_tenant on public.beca_equipments;
create policy beca_equipments_tenant_select on public.beca_equipments
for select to authenticated
using (tenant_id = public.beca_get_current_tenant_id());
create policy beca_equipments_tenant_write on public.beca_equipments
for all to authenticated
using (tenant_id = public.beca_get_current_tenant_id() and public.beca_can_write())
with check (tenant_id = public.beca_get_current_tenant_id() and public.beca_can_write());

drop policy if exists beca_metrics_tenant on public.beca_metrics;
create policy beca_metrics_tenant_select on public.beca_metrics
for select to authenticated
using (tenant_id = public.beca_get_current_tenant_id());
create policy beca_metrics_tenant_write on public.beca_metrics
for all to authenticated
using (tenant_id = public.beca_get_current_tenant_id() and public.beca_can_write())
with check (tenant_id = public.beca_get_current_tenant_id() and public.beca_can_write());

drop policy if exists beca_stock_moves_tenant on public.beca_stock_moves;
create policy beca_stock_moves_tenant_select on public.beca_stock_moves
for select to authenticated
using (tenant_id = public.beca_get_current_tenant_id());
create policy beca_stock_moves_tenant_write on public.beca_stock_moves
for all to authenticated
using (tenant_id = public.beca_get_current_tenant_id() and public.beca_can_write())
with check (tenant_id = public.beca_get_current_tenant_id() and public.beca_can_write());

drop policy if exists beca_audit_logs_tenant on public.beca_audit_logs;
create policy beca_audit_logs_tenant_select on public.beca_audit_logs
for select to authenticated
using (tenant_id = public.beca_get_current_tenant_id());
create policy beca_audit_logs_tenant_write on public.beca_audit_logs
for all to authenticated
using (tenant_id = public.beca_get_current_tenant_id() and public.beca_can_write())
with check (tenant_id = public.beca_get_current_tenant_id() and public.beca_can_write());

grant execute on function public.beca_get_current_role() to authenticated;
grant execute on function public.beca_can_write() to authenticated;
grant execute on function public.beca_get_my_access() to authenticated;

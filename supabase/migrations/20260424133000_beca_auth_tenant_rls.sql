create table if not exists public.beca_tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.beca_memberships (
  tenant_id uuid not null references public.beca_tenants(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('admin', 'operacao', 'leitura')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

do $$
declare
  v_legacy_tenant uuid;
begin
  select id into v_legacy_tenant
  from public.beca_tenants
  where name = 'Legacy Tenant'
  order by created_at asc
  limit 1;

  if v_legacy_tenant is null then
    insert into public.beca_tenants (name)
    values ('Legacy Tenant')
    returning id into v_legacy_tenant;
  end if;

  alter table public.beca_products add column if not exists tenant_id uuid references public.beca_tenants(id);
  update public.beca_products set tenant_id = v_legacy_tenant where tenant_id is null;
  alter table public.beca_products alter column tenant_id set not null;

  alter table public.beca_orders add column if not exists tenant_id uuid references public.beca_tenants(id);
  update public.beca_orders set tenant_id = v_legacy_tenant where tenant_id is null;
  alter table public.beca_orders alter column tenant_id set not null;

  alter table public.beca_equipments add column if not exists tenant_id uuid references public.beca_tenants(id);
  update public.beca_equipments set tenant_id = v_legacy_tenant where tenant_id is null;
  alter table public.beca_equipments alter column tenant_id set not null;

  alter table public.beca_stock_moves add column if not exists tenant_id uuid references public.beca_tenants(id);
  update public.beca_stock_moves set tenant_id = v_legacy_tenant where tenant_id is null;
  alter table public.beca_stock_moves alter column tenant_id set not null;

  alter table public.beca_audit_logs add column if not exists tenant_id uuid references public.beca_tenants(id);
  update public.beca_audit_logs set tenant_id = v_legacy_tenant where tenant_id is null;
  alter table public.beca_audit_logs alter column tenant_id set not null;

  alter table public.beca_product_lots add column if not exists tenant_id uuid references public.beca_tenants(id);
  update public.beca_product_lots l
  set tenant_id = p.tenant_id
  from public.beca_products p
  where l.product_id = p.id and l.tenant_id is null;
  update public.beca_product_lots set tenant_id = v_legacy_tenant where tenant_id is null;
  alter table public.beca_product_lots alter column tenant_id set not null;

  alter table public.beca_metrics add column if not exists tenant_id uuid references public.beca_tenants(id);
  update public.beca_metrics set tenant_id = v_legacy_tenant where tenant_id is null;
  alter table public.beca_metrics alter column tenant_id set not null;
end;
$$;

do $$ begin
  alter table public.beca_metrics drop constraint if exists beca_metrics_id_check;
exception when undefined_object then null;
end $$;

do $$ begin
  alter table public.beca_metrics drop constraint if exists beca_metrics_pkey;
exception when undefined_object then null;
end $$;

alter table public.beca_metrics add constraint beca_metrics_pkey primary key (tenant_id);

create index if not exists beca_products_tenant_idx on public.beca_products(tenant_id);
create index if not exists beca_product_lots_tenant_idx on public.beca_product_lots(tenant_id);
create index if not exists beca_orders_tenant_idx on public.beca_orders(tenant_id);
create index if not exists beca_equipments_tenant_idx on public.beca_equipments(tenant_id);
create index if not exists beca_stock_moves_tenant_idx on public.beca_stock_moves(tenant_id);
create index if not exists beca_audit_logs_tenant_idx on public.beca_audit_logs(tenant_id);
create index if not exists beca_memberships_user_idx on public.beca_memberships(user_id);

create or replace function public.beca_get_current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.tenant_id
  from public.beca_memberships m
  where m.user_id = auth.uid()
  order by m.created_at asc
  limit 1;
$$;

create or replace function public.beca_bootstrap_user(p_tenant_name text default 'BECA Operacao')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_role text;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select m.tenant_id, m.role
    into v_tenant_id, v_role
  from public.beca_memberships m
  where m.user_id = v_user_id
  limit 1;

  if v_tenant_id is not null then
    return jsonb_build_object('tenant_id', v_tenant_id, 'role', v_role, 'user_id', v_user_id);
  end if;

  select t.id
    into v_tenant_id
  from public.beca_tenants t
  where t.name = 'Legacy Tenant' and t.owner_user_id is null
  order by t.created_at asc
  limit 1;

  if v_tenant_id is not null then
    update public.beca_tenants
    set owner_user_id = v_user_id
    where id = v_tenant_id;

    insert into public.beca_memberships (tenant_id, user_id, role)
    values (v_tenant_id, v_user_id, 'admin')
    on conflict (tenant_id, user_id) do update set role = excluded.role;

    return jsonb_build_object('tenant_id', v_tenant_id, 'role', 'admin', 'user_id', v_user_id);
  end if;

  insert into public.beca_tenants (name, owner_user_id)
  values (coalesce(nullif(trim(p_tenant_name), ''), 'BECA Operacao'), v_user_id)
  returning id into v_tenant_id;

  insert into public.beca_memberships (tenant_id, user_id, role)
  values (v_tenant_id, v_user_id, 'admin');

  return jsonb_build_object('tenant_id', v_tenant_id, 'role', 'admin', 'user_id', v_user_id);
end;
$$;

create or replace function public.beca_get_app_state()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with ctx as (
    select public.beca_get_current_tenant_id() as tenant_id
  )
  select
    case
      when (select tenant_id from ctx) is null then
        jsonb_build_object(
          'products', '[]'::jsonb,
          'equipments', '[]'::jsonb,
          'metrics', '{}'::jsonb,
          'orders', '[]'::jsonb,
          'stockMoves', '[]'::jsonb,
          'auditLogs', '[]'::jsonb
        )
      else
        jsonb_build_object(
          'products', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', p.id,
                'type', p.type,
                'name', p.name,
                'sku', p.sku,
                'unit', p.unit,
                'custo_producao', p.custo_producao,
                'ativo', p.ativo,
                'receita', p.receita,
                'lotes', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'loteId', l.lote_id,
                      'qtd', l.qtd,
                      'validade', to_char(l.validade, 'YYYY-MM-DD')
                    )
                    order by l.created_at
                  )
                  from public.beca_product_lots l
                  where l.product_id = p.id and l.tenant_id = p.tenant_id
                ), '[]'::jsonb)
              )
              order by p.created_at
            )
            from public.beca_products p
            where p.tenant_id = (select tenant_id from ctx)
          ), '[]'::jsonb),
          'equipments', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', e.id,
                'name', e.name,
                'type', e.type,
                'health', e.health,
                'status', e.status
              )
              order by e.id
            )
            from public.beca_equipments e
            where e.tenant_id = (select tenant_id from ctx)
          ), '[]'::jsonb),
          'metrics', coalesce((select m.data from public.beca_metrics m where m.tenant_id = (select tenant_id from ctx)), '{}'::jsonb),
          'orders', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', o.id,
                'cliente', o.cliente,
                'produtoFinalId', o.produto_final_id,
                'quantidade', o.quantidade,
                'status', o.status,
                'data', o.data,
                'prazo', o.prazo,
                'estoqueBaixado', o.estoque_baixado,
                'moveRefs', o.move_refs,
                'history', o.history
              )
              order by o.data
            )
            from public.beca_orders o
            where o.tenant_id = (select tenant_id from ctx)
          ), '[]'::jsonb),
          'stockMoves', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', s.id,
                'kind', s.kind,
                'refType', s.ref_type,
                'refId', s.ref_id,
                'productId', s.product_id,
                'loteId', s.lote_id,
                'qty', s.qty,
                'unit', s.unit,
                'at', s.at
              )
              order by s.at
            )
            from public.beca_stock_moves s
            where s.tenant_id = (select tenant_id from ctx)
          ), '[]'::jsonb),
          'auditLogs', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', a.id,
                'action', a.action,
                'entity', a.entity,
                'before', a.before_data,
                'after', a.after_data,
                'reason', a.reason,
                'at', a.at
              )
              order by a.at
            )
            from public.beca_audit_logs a
            where a.tenant_id = (select tenant_id from ctx)
          ), '[]'::jsonb)
        )
    end;
$$;

create or replace function public.beca_replace_app_state(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant_id uuid := public.beca_get_current_tenant_id();
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

drop policy if exists beca_products_all on public.beca_products;
drop policy if exists beca_product_lots_all on public.beca_product_lots;
drop policy if exists beca_orders_all on public.beca_orders;
drop policy if exists beca_equipments_all on public.beca_equipments;
drop policy if exists beca_metrics_all on public.beca_metrics;
drop policy if exists beca_stock_moves_all on public.beca_stock_moves;
drop policy if exists beca_audit_logs_all on public.beca_audit_logs;

drop policy if exists beca_products_tenant on public.beca_products;
create policy beca_products_tenant on public.beca_products
for all to authenticated
using (tenant_id = public.beca_get_current_tenant_id())
with check (tenant_id = public.beca_get_current_tenant_id());

drop policy if exists beca_product_lots_tenant on public.beca_product_lots;
create policy beca_product_lots_tenant on public.beca_product_lots
for all to authenticated
using (tenant_id = public.beca_get_current_tenant_id())
with check (tenant_id = public.beca_get_current_tenant_id());

drop policy if exists beca_orders_tenant on public.beca_orders;
create policy beca_orders_tenant on public.beca_orders
for all to authenticated
using (tenant_id = public.beca_get_current_tenant_id())
with check (tenant_id = public.beca_get_current_tenant_id());

drop policy if exists beca_equipments_tenant on public.beca_equipments;
create policy beca_equipments_tenant on public.beca_equipments
for all to authenticated
using (tenant_id = public.beca_get_current_tenant_id())
with check (tenant_id = public.beca_get_current_tenant_id());

drop policy if exists beca_metrics_tenant on public.beca_metrics;
create policy beca_metrics_tenant on public.beca_metrics
for all to authenticated
using (tenant_id = public.beca_get_current_tenant_id())
with check (tenant_id = public.beca_get_current_tenant_id());

drop policy if exists beca_stock_moves_tenant on public.beca_stock_moves;
create policy beca_stock_moves_tenant on public.beca_stock_moves
for all to authenticated
using (tenant_id = public.beca_get_current_tenant_id())
with check (tenant_id = public.beca_get_current_tenant_id());

drop policy if exists beca_audit_logs_tenant on public.beca_audit_logs;
create policy beca_audit_logs_tenant on public.beca_audit_logs
for all to authenticated
using (tenant_id = public.beca_get_current_tenant_id())
with check (tenant_id = public.beca_get_current_tenant_id());

alter table public.beca_tenants enable row level security;
alter table public.beca_memberships enable row level security;

drop policy if exists beca_tenants_members on public.beca_tenants;
create policy beca_tenants_members on public.beca_tenants
for select to authenticated
using (id in (select tenant_id from public.beca_memberships where user_id = auth.uid()));

drop policy if exists beca_memberships_self on public.beca_memberships;
create policy beca_memberships_self on public.beca_memberships
for select to authenticated
using (user_id = auth.uid());

revoke all on table public.beca_products from anon;
revoke all on table public.beca_product_lots from anon;
revoke all on table public.beca_orders from anon;
revoke all on table public.beca_equipments from anon;
revoke all on table public.beca_metrics from anon;
revoke all on table public.beca_stock_moves from anon;
revoke all on table public.beca_audit_logs from anon;
revoke all on table public.beca_tenants from anon;
revoke all on table public.beca_memberships from anon;

grant select, insert, update, delete on public.beca_products to authenticated;
grant select, insert, update, delete on public.beca_product_lots to authenticated;
grant select, insert, update, delete on public.beca_orders to authenticated;
grant select, insert, update, delete on public.beca_equipments to authenticated;
grant select, insert, update, delete on public.beca_metrics to authenticated;
grant select, insert, update, delete on public.beca_stock_moves to authenticated;
grant select, insert, update, delete on public.beca_audit_logs to authenticated;
grant select on public.beca_tenants to authenticated;
grant select on public.beca_memberships to authenticated;

revoke execute on function public.beca_get_app_state() from anon;
revoke execute on function public.beca_replace_app_state(jsonb) from anon;
revoke execute on function public.beca_bootstrap_user(text) from anon;

grant execute on function public.beca_get_app_state() to authenticated;
grant execute on function public.beca_replace_app_state(jsonb) to authenticated;
grant execute on function public.beca_bootstrap_user(text) to authenticated;

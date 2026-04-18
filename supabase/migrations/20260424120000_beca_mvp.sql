create extension if not exists pgcrypto;

create table if not exists public.beca_products (
  id text primary key,
  type text not null check (type in ('ingrediente', 'embalagem', 'produto_final')),
  name text not null,
  sku text not null unique,
  unit text not null,
  custo_producao numeric(14,4) default 0,
  ativo boolean not null default true,
  receita jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.beca_product_lots (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.beca_products(id) on delete cascade,
  lote_id text not null,
  qtd numeric(18,6) not null default 0,
  validade date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, lote_id)
);

create table if not exists public.beca_orders (
  id text primary key,
  cliente text not null,
  produto_final_id text not null references public.beca_products(id),
  quantidade numeric(14,3) not null check (quantidade > 0),
  status text not null check (status in ('pendente', 'producao', 'logistica', 'concluido', 'cancelado')),
  data timestamptz not null,
  prazo date,
  estoque_baixado boolean not null default false,
  move_refs jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.beca_equipments (
  id text primary key,
  name text not null,
  type text,
  health numeric(6,2),
  status text,
  updated_at timestamptz not null default now()
);

create table if not exists public.beca_metrics (
  id int primary key default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  check (id = 1)
);

create table if not exists public.beca_stock_moves (
  id text primary key,
  kind text not null,
  ref_type text,
  ref_id text,
  product_id text,
  lote_id text,
  qty numeric(18,6),
  unit text,
  at timestamptz not null default now()
);

create table if not exists public.beca_audit_logs (
  id text primary key,
  action text not null,
  entity text not null,
  before_data jsonb,
  after_data jsonb,
  reason text,
  at timestamptz not null default now()
);

create or replace function public.beca_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists beca_products_set_updated_at on public.beca_products;
create trigger beca_products_set_updated_at
before update on public.beca_products
for each row execute function public.beca_set_updated_at();

drop trigger if exists beca_product_lots_set_updated_at on public.beca_product_lots;
create trigger beca_product_lots_set_updated_at
before update on public.beca_product_lots
for each row execute function public.beca_set_updated_at();

drop trigger if exists beca_orders_set_updated_at on public.beca_orders;
create trigger beca_orders_set_updated_at
before update on public.beca_orders
for each row execute function public.beca_set_updated_at();

drop trigger if exists beca_equipments_set_updated_at on public.beca_equipments;
create trigger beca_equipments_set_updated_at
before update on public.beca_equipments
for each row execute function public.beca_set_updated_at();

drop trigger if exists beca_metrics_set_updated_at on public.beca_metrics;
create trigger beca_metrics_set_updated_at
before update on public.beca_metrics
for each row execute function public.beca_set_updated_at();

create or replace function public.beca_get_app_state()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
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
            where l.product_id = p.id
          ), '[]'::jsonb)
        )
        order by p.created_at
      )
      from public.beca_products p
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
    ), '[]'::jsonb),
    'metrics', coalesce((select m.data from public.beca_metrics m where m.id = 1), '{}'::jsonb),
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
    ), '[]'::jsonb)
  );
$$;

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
  where id not in (select p->>'id' from jsonb_array_elements(_products) p);

  delete from public.beca_product_lots;
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
  where id not in (select e->>'id' from jsonb_array_elements(_equipments) e);

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
  where id not in (select o->>'id' from jsonb_array_elements(_orders) o);

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
  where id not in (select s->>'id' from jsonb_array_elements(_stock_moves) s);

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
  where id not in (select a->>'id' from jsonb_array_elements(_audit_logs) a);

  insert into public.beca_metrics (id, data)
  values (1, _metrics)
  on conflict (id) do update set data = excluded.data;

  return public.beca_get_app_state();
end;
$$;

alter table public.beca_products enable row level security;
alter table public.beca_product_lots enable row level security;
alter table public.beca_orders enable row level security;
alter table public.beca_equipments enable row level security;
alter table public.beca_metrics enable row level security;
alter table public.beca_stock_moves enable row level security;
alter table public.beca_audit_logs enable row level security;

drop policy if exists beca_products_all on public.beca_products;
create policy beca_products_all on public.beca_products for all to anon, authenticated using (true) with check (true);

drop policy if exists beca_product_lots_all on public.beca_product_lots;
create policy beca_product_lots_all on public.beca_product_lots for all to anon, authenticated using (true) with check (true);

drop policy if exists beca_orders_all on public.beca_orders;
create policy beca_orders_all on public.beca_orders for all to anon, authenticated using (true) with check (true);

drop policy if exists beca_equipments_all on public.beca_equipments;
create policy beca_equipments_all on public.beca_equipments for all to anon, authenticated using (true) with check (true);

drop policy if exists beca_metrics_all on public.beca_metrics;
create policy beca_metrics_all on public.beca_metrics for all to anon, authenticated using (true) with check (true);

drop policy if exists beca_stock_moves_all on public.beca_stock_moves;
create policy beca_stock_moves_all on public.beca_stock_moves for all to anon, authenticated using (true) with check (true);

drop policy if exists beca_audit_logs_all on public.beca_audit_logs;
create policy beca_audit_logs_all on public.beca_audit_logs for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.beca_products to anon, authenticated;
grant select, insert, update, delete on public.beca_product_lots to anon, authenticated;
grant select, insert, update, delete on public.beca_orders to anon, authenticated;
grant select, insert, update, delete on public.beca_equipments to anon, authenticated;
grant select, insert, update, delete on public.beca_metrics to anon, authenticated;
grant select, insert, update, delete on public.beca_stock_moves to anon, authenticated;
grant select, insert, update, delete on public.beca_audit_logs to anon, authenticated;

grant execute on function public.beca_get_app_state() to anon, authenticated;
grant execute on function public.beca_replace_app_state(jsonb) to anon, authenticated;

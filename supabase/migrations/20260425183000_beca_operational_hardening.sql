alter table public.beca_audit_logs
  add column if not exists actor_user_id uuid;

create or replace function public.beca_fill_audit_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.actor_user_id is null then
    new.actor_user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists beca_audit_logs_fill_actor on public.beca_audit_logs;
create trigger beca_audit_logs_fill_actor
before insert on public.beca_audit_logs
for each row execute function public.beca_fill_audit_actor();

create table if not exists public.beca_production_orders (
  id text primary key,
  tenant_id uuid not null references public.beca_tenants(id) on delete cascade,
  order_id text not null references public.beca_orders(id) on delete cascade,
  produto_final_id text not null references public.beca_products(id),
  quantidade numeric(14,3) not null,
  fornadas numeric(14,3) not null,
  status text not null check (status in ('aberta', 'em_producao', 'finalizada', 'cancelada')),
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, order_id)
);

create index if not exists beca_production_orders_tenant_idx on public.beca_production_orders(tenant_id);
create index if not exists beca_production_orders_status_idx on public.beca_production_orders(tenant_id, status);

drop trigger if exists beca_production_orders_set_updated_at on public.beca_production_orders;
create trigger beca_production_orders_set_updated_at
before update on public.beca_production_orders
for each row execute function public.beca_set_updated_at();

alter table public.beca_production_orders enable row level security;

drop policy if exists beca_production_orders_tenant_select on public.beca_production_orders;
create policy beca_production_orders_tenant_select on public.beca_production_orders
for select to authenticated
using (tenant_id = public.beca_get_current_tenant_id());

drop policy if exists beca_production_orders_tenant_write on public.beca_production_orders;
create policy beca_production_orders_tenant_write on public.beca_production_orders
for all to authenticated
using (tenant_id = public.beca_get_current_tenant_id() and public.beca_can_write())
with check (tenant_id = public.beca_get_current_tenant_id() and public.beca_can_write());

grant select, insert, update, delete on public.beca_production_orders to authenticated;

create or replace function public.beca_sync_production_order_from_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rendimento numeric;
  v_fornadas numeric;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status = 'producao' then
    select coalesce((p.receita->>'rendimento')::numeric, 0)
      into v_rendimento
    from public.beca_products p
    where p.tenant_id = new.tenant_id
      and p.id = new.produto_final_id
    limit 1;

    if v_rendimento <= 0 then
      v_fornadas := 1;
    else
      v_fornadas := ceil(new.quantidade / v_rendimento);
    end if;

    insert into public.beca_production_orders (
      id,
      tenant_id,
      order_id,
      produto_final_id,
      quantidade,
      fornadas,
      status,
      started_at,
      created_by
    )
    values (
      public.beca_make_id('OP'),
      new.tenant_id,
      new.id,
      new.produto_final_id,
      new.quantidade,
      v_fornadas,
      'em_producao',
      now(),
      auth.uid()
    )
    on conflict (tenant_id, order_id)
    do update set
      status = 'em_producao',
      quantidade = excluded.quantidade,
      fornadas = excluded.fornadas,
      started_at = coalesce(public.beca_production_orders.started_at, excluded.started_at),
      finished_at = null;
  elsif new.status = 'logistica' then
    update public.beca_production_orders
    set status = 'finalizada',
        finished_at = coalesce(finished_at, now())
    where tenant_id = new.tenant_id
      and order_id = new.id
      and status in ('aberta', 'em_producao');
  elsif new.status = 'cancelado' then
    update public.beca_production_orders
    set status = 'cancelada',
        finished_at = coalesce(finished_at, now())
    where tenant_id = new.tenant_id
      and order_id = new.id
      and status in ('aberta', 'em_producao');
  end if;

  return new;
end;
$$;

drop trigger if exists beca_orders_sync_production_order on public.beca_orders;
create trigger beca_orders_sync_production_order
after update of status on public.beca_orders
for each row execute function public.beca_sync_production_order_from_status();

create or replace function public.beca_list_production_orders()
returns table (
  id text,
  order_id text,
  produto_final_id text,
  produto_final_nome text,
  cliente text,
  quantidade numeric,
  fornadas numeric,
  status text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    op.id,
    op.order_id,
    op.produto_final_id,
    p.name as produto_final_nome,
    o.cliente,
    op.quantidade,
    op.fornadas,
    op.status,
    op.started_at,
    op.finished_at,
    op.created_at
  from public.beca_production_orders op
  join public.beca_orders o
    on o.id = op.order_id and o.tenant_id = op.tenant_id
  join public.beca_products p
    on p.id = op.produto_final_id and p.tenant_id = op.tenant_id
  where op.tenant_id = public.beca_get_current_tenant_id()
  order by op.created_at desc;
$$;

create or replace function public.beca_set_logistics_step(
  p_order_id text,
  p_step text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant_id uuid := public.beca_get_current_tenant_id();
  _role text := public.beca_get_current_role();
  _order public.beca_orders%rowtype;
  _step text := lower(coalesce(trim(p_step), ''));
  _reason text;
  _now timestamptz := now();
  _has_separado boolean;
  _has_conferido boolean;
begin
  if _tenant_id is null then
    raise exception 'Tenant nao encontrado para o usuario atual.';
  end if;

  if _role not in ('admin', 'operacao') then
    raise exception 'Permissao negada para etapa logistica.';
  end if;

  if _step not in ('separado', 'conferido', 'expedido') then
    raise exception 'Etapa logistica invalida.';
  end if;

  select *
    into _order
  from public.beca_orders o
  where o.tenant_id = _tenant_id
    and o.id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido nao encontrado.';
  end if;

  if _order.status <> 'logistica' then
    raise exception 'Etapa logistica so pode ser registrada com pedido em logistica.';
  end if;

  _has_separado := jsonb_path_exists(coalesce(_order.history, '[]'::jsonb), '$[*] ? (@.reason == "dispatch:separado")');
  _has_conferido := jsonb_path_exists(coalesce(_order.history, '[]'::jsonb), '$[*] ? (@.reason == "dispatch:conferido")');

  if _step = 'conferido' and not _has_separado then
    raise exception 'Pedido precisa passar por separacao antes da conferencia.';
  end if;

  if _step = 'expedido' and not (_has_conferido or jsonb_path_exists(coalesce(_order.history, '[]'::jsonb), '$[*] ? (@.reason == "dispatch:expedido")')) then
    raise exception 'Pedido precisa passar por conferencia antes da expedicao.';
  end if;

  _reason := 'dispatch:' || _step;

  update public.beca_orders
  set history = coalesce(history, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('at', _now, 'from', status, 'to', status, 'reason', _reason)
    )
  where tenant_id = _tenant_id
    and id = _order.id;

  insert into public.beca_audit_logs (id, tenant_id, action, entity, before_data, after_data, reason, at)
  values (
    public.beca_make_id('AUD'),
    _tenant_id,
    'order.logistics-step',
    'order',
    jsonb_build_object('id', _order.id, 'status', _order.status),
    jsonb_build_object('id', _order.id, 'status', _order.status, 'logisticsStep', _step),
    _reason,
    _now
  );

  return public.beca_get_app_state();
end;
$$;

create or replace function public.beca_complete_order(
  p_order_id text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant_id uuid := public.beca_get_current_tenant_id();
  _order public.beca_orders%rowtype;
  _reason text := coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'order-completed');
begin
  if _tenant_id is null then
    raise exception 'Tenant nao encontrado para o usuario atual.';
  end if;

  select *
    into _order
  from public.beca_orders o
  where o.tenant_id = _tenant_id
    and o.id = p_order_id
  limit 1;

  if not found then
    raise exception 'Pedido nao encontrado.';
  end if;

  if _order.status <> 'logistica' then
    raise exception 'Somente pedidos em logistica podem ser concluidos por este fluxo.';
  end if;

  if not jsonb_path_exists(coalesce(_order.history, '[]'::jsonb), '$[*] ? (@.reason == "dispatch:expedido")') then
    raise exception 'Pedido precisa ser expedido antes de concluir.';
  end if;

  return public.beca_advance_order_status(p_order_id, 'concluido', _reason);
end;
$$;

create or replace function public.beca_log_runtime_error(
  p_message text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant_id uuid := public.beca_get_current_tenant_id();
  _now timestamptz := now();
begin
  if _tenant_id is null then
    raise exception 'Tenant nao encontrado para o usuario atual.';
  end if;

  insert into public.beca_audit_logs (id, tenant_id, action, entity, before_data, after_data, reason, at)
  values (
    public.beca_make_id('AUD'),
    _tenant_id,
    'app.runtime-error',
    'system',
    null,
    jsonb_build_object('message', coalesce(p_message, 'unknown-error'), 'metadata', coalesce(p_metadata, '{}'::jsonb)),
    'runtime-error',
    _now
  );

  return jsonb_build_object('ok', true, 'at', _now);
end;
$$;

grant execute on function public.beca_list_production_orders() to authenticated;
grant execute on function public.beca_set_logistics_step(text, text) to authenticated;
grant execute on function public.beca_complete_order(text, text) to authenticated;
grant execute on function public.beca_log_runtime_error(text, jsonb) to authenticated;

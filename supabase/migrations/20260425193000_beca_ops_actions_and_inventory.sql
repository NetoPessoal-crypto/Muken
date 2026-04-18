create or replace function public.beca_start_production_order(
  p_production_order_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant_id uuid := public.beca_get_current_tenant_id();
  _role text := public.beca_get_current_role();
  _op public.beca_production_orders%rowtype;
  _now timestamptz := now();
begin
  if _tenant_id is null then
    raise exception 'Tenant nao encontrado para o usuario atual.';
  end if;

  if _role not in ('admin', 'operacao') then
    raise exception 'Permissao negada para iniciar OP.';
  end if;

  select *
    into _op
  from public.beca_production_orders op
  where op.tenant_id = _tenant_id
    and op.id = p_production_order_id
  for update;

  if not found then
    raise exception 'Ordem de producao nao encontrada.';
  end if;

  if _op.status in ('finalizada', 'cancelada') then
    raise exception 'Nao e possivel iniciar OP finalizada/cancelada.';
  end if;

  update public.beca_production_orders
  set status = 'em_producao',
      started_at = coalesce(started_at, _now)
  where tenant_id = _tenant_id
    and id = _op.id;

  insert into public.beca_audit_logs (id, tenant_id, action, entity, before_data, after_data, reason, at)
  values (
    public.beca_make_id('AUD'),
    _tenant_id,
    'production.started',
    'production_order',
    jsonb_build_object('id', _op.id, 'status', _op.status),
    jsonb_build_object('id', _op.id, 'status', 'em_producao'),
    'op-started',
    _now
  );

  return public.beca_get_app_state();
end;
$$;

create or replace function public.beca_finalize_production_order(
  p_production_order_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant_id uuid := public.beca_get_current_tenant_id();
  _role text := public.beca_get_current_role();
  _op public.beca_production_orders%rowtype;
begin
  if _tenant_id is null then
    raise exception 'Tenant nao encontrado para o usuario atual.';
  end if;

  if _role not in ('admin', 'operacao') then
    raise exception 'Permissao negada para finalizar OP.';
  end if;

  select *
    into _op
  from public.beca_production_orders op
  where op.tenant_id = _tenant_id
    and op.id = p_production_order_id
  for update;

  if not found then
    raise exception 'Ordem de producao nao encontrada.';
  end if;

  if _op.status = 'cancelada' then
    raise exception 'OP cancelada nao pode ser finalizada.';
  end if;

  if _op.status <> 'finalizada' then
    update public.beca_production_orders
    set status = 'finalizada',
        finished_at = coalesce(finished_at, now())
    where tenant_id = _tenant_id
      and id = _op.id;
  end if;

  return public.beca_advance_order_status(_op.order_id, 'logistica', 'op-finalizada');
end;
$$;

create or replace function public.beca_cancel_production_order(
  p_production_order_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant_id uuid := public.beca_get_current_tenant_id();
  _role text := public.beca_get_current_role();
  _op public.beca_production_orders%rowtype;
begin
  if _tenant_id is null then
    raise exception 'Tenant nao encontrado para o usuario atual.';
  end if;

  if _role <> 'admin' then
    raise exception 'Apenas admin pode cancelar OP.';
  end if;

  select *
    into _op
  from public.beca_production_orders op
  where op.tenant_id = _tenant_id
    and op.id = p_production_order_id
  for update;

  if not found then
    raise exception 'Ordem de producao nao encontrada.';
  end if;

  return public.beca_advance_order_status(_op.order_id, 'cancelado', 'op-cancelada');
end;
$$;

create or replace function public.beca_inventory_count(
  p_product_id text,
  p_physical_qty numeric,
  p_reason text,
  p_lote_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant_id uuid := public.beca_get_current_tenant_id();
  _role text := public.beca_get_current_role();
  _system_qty numeric;
  _physical_qty numeric := coalesce(p_physical_qty, 0);
  _diff numeric;
  _reason text := coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'inventario-ciclico');
begin
  if _tenant_id is null then
    raise exception 'Tenant nao encontrado para o usuario atual.';
  end if;

  if _role not in ('admin', 'operacao') then
    raise exception 'Permissao negada para inventario.';
  end if;

  if _physical_qty < 0 then
    raise exception 'Quantidade fisica invalida.';
  end if;

  select coalesce(sum(l.qtd), 0)
    into _system_qty
  from public.beca_product_lots l
  where l.tenant_id = _tenant_id
    and l.product_id = p_product_id;

  _diff := round((_physical_qty - _system_qty)::numeric, 6);

  if _diff = 0 then
    return public.beca_get_app_state();
  end if;

  return public.beca_stock_move(
    p_product_id,
    'AJUSTE',
    _diff,
    _reason,
    p_lote_id,
    null
  );
end;
$$;

grant execute on function public.beca_start_production_order(text) to authenticated;
grant execute on function public.beca_finalize_production_order(text) to authenticated;
grant execute on function public.beca_cancel_production_order(text) to authenticated;
grant execute on function public.beca_inventory_count(text, numeric, text, text) to authenticated;

create or replace function public.beca_can_cancel_order(
  p_role text,
  p_current_status text
)
returns boolean
language sql
immutable
as $$
  select
    case lower(coalesce(trim(p_current_status), ''))
      when 'pendente' then lower(coalesce(trim(p_role), '')) in ('admin', 'operacao')
      when 'producao' then lower(coalesce(trim(p_role), '')) = 'admin'
      when 'logistica' then lower(coalesce(trim(p_role), '')) = 'admin'
      else false
    end;
$$;

create or replace function public.beca_advance_order_status(
  p_order_id text,
  p_new_status text,
  p_reason text default null
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
  _new_status text := lower(coalesce(trim(p_new_status), ''));
  _now timestamptz := now();
  _reason text := nullif(trim(coalesce(p_reason, '')), '');
  _prod_final public.beca_products%rowtype;
  _rendimento numeric;
  _fornadas numeric;
  _req jsonb;
  _ing public.beca_products%rowtype;
  _unit_uso text;
  _factor numeric;
  _need_usage numeric;
  _need_base numeric;
  _current_stock numeric;
  _remaining numeric;
  _take numeric;
  _lot record;
  _output_qty numeric;
  _output_lote text;
  _move_id text;
  _move record;
  _move_refs jsonb;
  _genealogy_tmp jsonb := '[]'::jsonb; -- temporary store of consumed parent lots to link to produced child lot
  _output_lote_row_id uuid;
  _child_lot_id uuid;
begin
  if _tenant_id is null then
    raise exception 'Tenant nao encontrado para o usuario atual.';
  end if;

  if _role not in ('admin', 'operacao') then
    raise exception 'Permissao negada para alterar status de pedido.';
  end if;

  if _new_status not in ('pendente', 'producao', 'logistica', 'concluido', 'cancelado') then
    raise exception 'Status de pedido invalido.';
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

  if _order.status = _new_status then
    return public.beca_get_app_state();
  end if;

  if not (
    (_order.status = 'pendente' and _new_status in ('producao', 'cancelado')) or
    (_order.status = 'producao' and _new_status in ('logistica', 'cancelado')) or
    (_order.status = 'logistica' and _new_status in ('concluido', 'cancelado'))
  ) then
    raise exception 'Transicao invalida: % -> %.', _order.status, _new_status;
  end if;

  if _new_status = 'cancelado' and not public.beca_can_cancel_order(_role, _order.status) then
    if _order.status = 'pendente' then
      raise exception 'Somente admin ou operacao podem cancelar pedidos pendentes.';
    elsif _order.status in ('producao', 'logistica') then
      raise exception 'Somente admin pode cancelar pedidos em producao ou logistica.';
    else
      raise exception 'Cancelamento nao permitido para esta etapa.';
    end if;
  end if;

  _move_refs := coalesce(_order.move_refs, '[]'::jsonb);

  if _new_status = 'producao' and _order.estoque_baixado = false then
    select *
      into _prod_final
    from public.beca_products p
    where p.tenant_id = _tenant_id
      and p.id = _order.produto_final_id
    for update;

    if not found then
      raise exception 'Produto final nao encontrado para producao.';
    end if;

    _rendimento := coalesce((_prod_final.receita->>'rendimento')::numeric, 0);
    if _rendimento <= 0 then
      raise exception 'Produto final sem receita valida para produzir.';
    end if;

    _fornadas := ceil(_order.quantidade / _rendimento);

    for _req in
      select value
      from jsonb_array_elements(coalesce(_prod_final.receita->'ingredientes', '[]'::jsonb))
    loop
      select *
        into _ing
      from public.beca_products p
      where p.tenant_id = _tenant_id
        and p.id = _req->>'id'
      for update;

      if not found then
        raise exception 'Insumo % nao encontrado.', coalesce(_req->>'nome', _req->>'id');
      end if;

      if _ing.ativo is false then
        raise exception 'Insumo % esta inativo.', _ing.name;
      end if;

      _unit_uso := coalesce(nullif(_req->>'unit_uso', ''), _ing.unit);
      _factor := public.beca_conversion_factor(_unit_uso, _ing.unit);
      if _factor is null then
        raise exception 'Conversao invalida entre % e % no insumo %.', _unit_uso, _ing.unit, _ing.name;
      end if;

      _need_usage := coalesce((_req->>'uso')::numeric, 0) * _fornadas * (1 + coalesce((_req->>'perda_pct')::numeric, 0) / 100);
      _need_base := round((_need_usage * _factor)::numeric, 6);

      if _need_base <= 0 then
        raise exception 'Quantidade de consumo invalida para insumo %.', _ing.name;
      end if;

      select coalesce(sum(l.qtd), 0)
        into _current_stock
      from public.beca_product_lots l
      where l.tenant_id = _tenant_id
        and l.product_id = _ing.id;

      if _current_stock < _need_base then
        raise exception 'Estoque insuficiente para %. Necessario: %, disponivel: %.', _ing.name, _need_base, _current_stock;
      end if;

      _remaining := _need_base;
      for _lot in
        select l.id, l.lote_id, l.qtd
        from public.beca_product_lots l
        where l.tenant_id = _tenant_id
          and l.product_id = _ing.id
          and l.qtd > 0
        order by l.created_at asc
      loop
        exit when _remaining <= 0;
        _take := least(_lot.qtd, _remaining);

        update public.beca_product_lots
        set qtd = round(greatest(qtd - _take, 0)::numeric, 6)
        where id = _lot.id;

        _move_id := public.beca_make_id('MOV');
        insert into public.beca_stock_moves (id, tenant_id, kind, ref_type, ref_id, product_id, lote_id, qty, unit, at)
        values (_move_id, _tenant_id, 'CONSUMO', 'order', _order.id, _ing.id, _lot.lote_id, _take, _ing.unit, _now);

        _move_refs := _move_refs || to_jsonb(_move_id);
        _remaining := round((_remaining - _take)::numeric, 6);
      end loop;

      if _remaining > 0 then
        raise exception 'Falha de baixa atomica para %.', _ing.name;
      end if;

      delete from public.beca_product_lots
      where tenant_id = _tenant_id
        and product_id = _ing.id
        and qtd <= 0;
    end loop;

    _output_qty := round((_rendimento * _fornadas)::numeric, 6);
    _output_lote := public.beca_make_id('LPR');

    -- create output lot and capture its row id so we can record genealogy links
    insert into public.beca_product_lots (tenant_id, product_id, lote_id, qtd, validade)
    values (_tenant_id, _prod_final.id, _output_lote, _output_qty, date '2099-12-31')
    returning id into _output_lote_row_id;

    _move_id := public.beca_make_id('MOV');
    insert into public.beca_stock_moves (id, tenant_id, kind, ref_type, ref_id, product_id, lote_id, qty, unit, at)
    values (_move_id, _tenant_id, 'PRODUCAO_ENTRADA', 'order', _order.id, _prod_final.id, _output_lote, _output_qty, _prod_final.unit, _now);

    _move_refs := _move_refs || to_jsonb(_move_id);

    -- persist genealogy: for each consumed parent lot, link to this produced child lot
    for _req in select value from jsonb_array_elements(coalesce(_genealogy_tmp, '[]'::jsonb)) loop
      insert into public.beca_lot_genealogy (tenant_id, parent_lot_uuid, child_lot_uuid, qty_used, unit, order_id)
      values (
        _tenant_id,
        (_req->>'parent_id')::uuid,
        _output_lote_row_id,
        coalesce((_req->>'qty')::numeric, 0),
        _req->>'unit',
        _order.id
      );
    end loop;

    update public.beca_orders
    set estoque_baixado = true,
        move_refs = _move_refs
    where tenant_id = _tenant_id
      and id = _order.id;

    _order.estoque_baixado := true;
  end if;

  if _new_status = 'cancelado' and _order.estoque_baixado = true then
    for _move in
      select *
      from public.beca_stock_moves s
      where s.tenant_id = _tenant_id
        and s.ref_type = 'order'
        and s.ref_id = _order.id
        and s.kind = 'CONSUMO'
      order by s.at asc
    loop
      insert into public.beca_product_lots (tenant_id, product_id, lote_id, qtd, validade)
      values (_tenant_id, _move.product_id, _move.lote_id, _move.qty, date '2099-12-31')
      on conflict (product_id, lote_id)
      do update set qtd = public.beca_product_lots.qtd + excluded.qtd;

      _move_id := public.beca_make_id('MOV');
      insert into public.beca_stock_moves (id, tenant_id, kind, ref_type, ref_id, product_id, lote_id, qty, unit, at)
      values (_move_id, _tenant_id, 'ESTORNO_CONSUMO', 'order', _order.id, _move.product_id, _move.lote_id, _move.qty, _move.unit, _now);

      _move_refs := _move_refs || to_jsonb(_move_id);
    end loop;

    for _move in
      select *
      from public.beca_stock_moves s
      where s.tenant_id = _tenant_id
        and s.ref_type = 'order'
        and s.ref_id = _order.id
        and s.kind = 'PRODUCAO_ENTRADA'
      order by s.at asc
    loop
      _remaining := _move.qty;

      for _lot in
        select l.id, l.lote_id, l.qtd
        from public.beca_product_lots l
        where l.tenant_id = _tenant_id
          and l.product_id = _move.product_id
          and l.qtd > 0
        order by case when l.lote_id = _move.lote_id then 0 else 1 end, l.created_at asc
      loop
        exit when _remaining <= 0;
        _take := least(_lot.qtd, _remaining);

        update public.beca_product_lots
        set qtd = round(greatest(qtd - _take, 0)::numeric, 6)
        where id = _lot.id;

        _remaining := round((_remaining - _take)::numeric, 6);
      end loop;

      if _remaining > 0 then
        raise exception 'Nao ha estoque suficiente do produto final para estornar cancelamento.';
      end if;

      _move_id := public.beca_make_id('MOV');
      insert into public.beca_stock_moves (id, tenant_id, kind, ref_type, ref_id, product_id, lote_id, qty, unit, at)
      values (_move_id, _tenant_id, 'ESTORNO_PRODUCAO', 'order', _order.id, _move.product_id, _move.lote_id, _move.qty, _move.unit, _now);

      _move_refs := _move_refs || to_jsonb(_move_id);
    end loop;

    -- remove genealogy records related to produced lots that were estornado
    for _move in
      select *
      from public.beca_stock_moves s
      where s.tenant_id = _tenant_id
        and s.ref_type = 'order'
        and s.ref_id = _order.id
        and s.kind = 'PRODUCAO_ENTRADA'
    loop
      -- find the product_lots row id for this produced lote (if still exists)
      select id into _child_lot_id
      from public.beca_product_lots l
      where l.tenant_id = _tenant_id
        and l.product_id = _move.product_id
        and l.lote_id = _move.lote_id
      limit 1;

      if _child_lot_id is not null then
        delete from public.beca_lot_genealogy where tenant_id = _tenant_id and child_lot_uuid = _child_lot_id;
      end if;
    end loop;

    delete from public.beca_product_lots
    where tenant_id = _tenant_id
      and qtd <= 0;

    update public.beca_orders
    set estoque_baixado = false,
        move_refs = _move_refs
    where tenant_id = _tenant_id
      and id = _order.id;

    _order.estoque_baixado := false;
  end if;

  update public.beca_orders
  set status = _new_status,
      history = coalesce(history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', _now, 'from', _order.status, 'to', _new_status, 'reason', _reason))
  where tenant_id = _tenant_id
    and id = _order.id;

  insert into public.beca_audit_logs (id, tenant_id, action, entity, before_data, after_data, reason, at)
  values (
    public.beca_make_id('AUD'),
    _tenant_id,
    'order.status-changed',
    'order',
    jsonb_build_object('id', _order.id, 'status', _order.status),
    jsonb_build_object('id', _order.id, 'status', _new_status),
    coalesce(_reason, 'status-change'),
    _now
  );

  return public.beca_get_app_state();
end;
$$;

grant execute on function public.beca_can_cancel_order(text, text) to authenticated;
grant execute on function public.beca_advance_order_status(text, text, text) to authenticated;

create or replace function public.beca_make_id(p_prefix text)
returns text
language sql
stable
as $$
  select upper(coalesce(nullif(trim(p_prefix), ''), 'ID')) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
$$;

create or replace function public.beca_conversion_factor(p_unit_uso text, p_unit_base text)
returns numeric
language plpgsql
immutable
as $$
begin
  if p_unit_uso is null or p_unit_base is null or p_unit_uso = p_unit_base then
    return 1;
  end if;

  if p_unit_uso in ('kg', 'g') and p_unit_base in ('kg', 'g') then
    if p_unit_uso = 'g' and p_unit_base = 'kg' then return 0.001; end if;
    if p_unit_uso = 'kg' and p_unit_base = 'g' then return 1000; end if;
    return 1;
  end if;

  if p_unit_uso in ('l', 'ml') and p_unit_base in ('l', 'ml') then
    if p_unit_uso = 'ml' and p_unit_base = 'l' then return 0.001; end if;
    if p_unit_uso = 'l' and p_unit_base = 'ml' then return 1000; end if;
    return 1;
  end if;

  if p_unit_uso in ('unidade', 'dz') and p_unit_base in ('unidade', 'dz') then
    if p_unit_uso = 'unidade' and p_unit_base = 'dz' then return 1.0 / 12.0; end if;
    if p_unit_uso = 'dz' and p_unit_base = 'unidade' then return 12; end if;
    return 1;
  end if;

  return null;
end;
$$;

create or replace function public.beca_create_order(
  p_cliente text,
  p_produto_final_id text,
  p_quantidade numeric,
  p_prazo date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant_id uuid := public.beca_get_current_tenant_id();
  _role text := public.beca_get_current_role();
  _produto public.beca_products%rowtype;
  _order_id text;
  _now timestamptz := now();
begin
  if _tenant_id is null then
    raise exception 'Tenant nao encontrado para o usuario atual.';
  end if;

  if _role not in ('admin', 'operacao') then
    raise exception 'Permissao negada para criar pedido.';
  end if;

  if coalesce(trim(p_cliente), '') = '' then
    raise exception 'Cliente e obrigatorio.';
  end if;

  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Quantidade deve ser maior que zero.';
  end if;

  select *
    into _produto
  from public.beca_products p
  where p.tenant_id = _tenant_id
    and p.id = p_produto_final_id
  limit 1;

  if not found then
    raise exception 'Produto final nao encontrado.';
  end if;

  if _produto.type <> 'produto_final' then
    raise exception 'Pedido so pode ser criado para produto final.';
  end if;

  if _produto.ativo is false then
    raise exception 'Produto final inativo nao pode receber pedido.';
  end if;

  _order_id := public.beca_make_id('ORD');

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
  values (
    _order_id,
    _tenant_id,
    trim(p_cliente),
    p_produto_final_id,
    p_quantidade,
    'pendente',
    _now,
    p_prazo,
    false,
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('at', _now, 'from', null, 'to', 'pendente', 'reason', 'order-created'))
  );

  insert into public.beca_audit_logs (id, tenant_id, action, entity, before_data, after_data, reason, at)
  values (
    public.beca_make_id('AUD'),
    _tenant_id,
    'order.created',
    'order',
    null,
    jsonb_build_object('id', _order_id, 'cliente', trim(p_cliente), 'produtoFinalId', p_produto_final_id, 'quantidade', p_quantidade),
    'create-order',
    _now
  );

  return public.beca_get_app_state();
end;
$$;

create or replace function public.beca_stock_move(
  p_product_id text,
  p_move_type text,
  p_qty numeric,
  p_reason text default null,
  p_lote_id text default null,
  p_validade date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant_id uuid := public.beca_get_current_tenant_id();
  _role text := public.beca_get_current_role();
  _product public.beca_products%rowtype;
  _type text := upper(coalesce(trim(p_move_type), ''));
  _raw_qty numeric := p_qty;
  _qty numeric := abs(coalesce(p_qty, 0));
  _reason text := nullif(trim(coalesce(p_reason, '')), '');
  _lote_id text := nullif(trim(coalesce(p_lote_id, '')), '');
  _validade date := coalesce(p_validade, date '2099-12-31');
  _remaining numeric;
  _take numeric;
  _now timestamptz := now();
  _lot record;
begin
  if _tenant_id is null then
    raise exception 'Tenant nao encontrado para o usuario atual.';
  end if;

  if _role not in ('admin', 'operacao') then
    raise exception 'Permissao negada para movimentar estoque.';
  end if;

  if _type not in ('ENTRADA', 'SAIDA', 'AJUSTE', 'PERDA', 'DEVOLUCAO') then
    raise exception 'Tipo de movimentacao invalido.';
  end if;

  if _raw_qty is null or _raw_qty = 0 then
    raise exception 'Quantidade invalida.';
  end if;

  if _type in ('AJUSTE', 'PERDA') and _reason is null then
    raise exception 'Motivo obrigatorio para ajuste e perda.';
  end if;

  select *
    into _product
  from public.beca_products p
  where p.tenant_id = _tenant_id
    and p.id = p_product_id
  for update;

  if not found then
    raise exception 'Produto nao encontrado.';
  end if;

  if _product.ativo is false then
    raise exception 'Produto inativo nao pode ser movimentado.';
  end if;

  if _type in ('ENTRADA', 'DEVOLUCAO') or (_type = 'AJUSTE' and _raw_qty > 0) then
    if _lote_id is null then
      _lote_id := public.beca_make_id('L');
    end if;

    insert into public.beca_product_lots (tenant_id, product_id, lote_id, qtd, validade)
    values (_tenant_id, p_product_id, _lote_id, _qty, _validade)
    on conflict (product_id, lote_id)
    do update set
      tenant_id = excluded.tenant_id,
      qtd = public.beca_product_lots.qtd + excluded.qtd,
      validade = coalesce(excluded.validade, public.beca_product_lots.validade);

    insert into public.beca_stock_moves (id, tenant_id, kind, ref_type, ref_id, product_id, lote_id, qty, unit, at)
    values (
      public.beca_make_id('MOV'),
      _tenant_id,
      case when _type = 'AJUSTE' then 'AJUSTE' else _type end,
      'manual-stock',
      p_product_id,
      p_product_id,
      _lote_id,
      _qty,
      _product.unit,
      _now
    );
  else
    _remaining := _qty;

    for _lot in
      select l.id, l.lote_id, l.qtd
      from public.beca_product_lots l
      where l.tenant_id = _tenant_id
        and l.product_id = p_product_id
        and l.qtd > 0
        and (_lote_id is null or l.lote_id = _lote_id)
      order by l.created_at asc
    loop
      exit when _remaining <= 0;
      _take := least(_lot.qtd, _remaining);

      update public.beca_product_lots
      set qtd = round(greatest(qtd - _take, 0)::numeric, 6)
      where id = _lot.id;

      insert into public.beca_stock_moves (id, tenant_id, kind, ref_type, ref_id, product_id, lote_id, qty, unit, at)
      values (
        public.beca_make_id('MOV'),
        _tenant_id,
        case when _type = 'AJUSTE' then 'AJUSTE' else _type end,
        'manual-stock',
        p_product_id,
        p_product_id,
        _lot.lote_id,
        _take,
        _product.unit,
        _now
      );

      _remaining := round((_remaining - _take)::numeric, 6);
    end loop;

    if _remaining > 0 then
      raise exception 'Estoque insuficiente para concluir a movimentacao.';
    end if;

    delete from public.beca_product_lots
    where tenant_id = _tenant_id
      and product_id = p_product_id
      and qtd <= 0;
  end if;

  insert into public.beca_audit_logs (id, tenant_id, action, entity, before_data, after_data, reason, at)
  values (
    public.beca_make_id('AUD'),
    _tenant_id,
    'stock.manual-move',
    'stock',
    null,
    jsonb_build_object('productId', p_product_id, 'type', _type, 'qty', _raw_qty, 'loteId', _lote_id),
    coalesce(_reason, 'manual-stock-move'),
    _now
  );

  return public.beca_get_app_state();
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

  if _new_status = 'cancelado' and _role <> 'admin' then
    raise exception 'Apenas admin pode cancelar pedidos.';
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

    insert into public.beca_product_lots (tenant_id, product_id, lote_id, qtd, validade)
    values (_tenant_id, _prod_final.id, _output_lote, _output_qty, date '2099-12-31');

    _move_id := public.beca_make_id('MOV');
    insert into public.beca_stock_moves (id, tenant_id, kind, ref_type, ref_id, product_id, lote_id, qty, unit, at)
    values (_move_id, _tenant_id, 'PRODUCAO_ENTRADA', 'order', _order.id, _prod_final.id, _output_lote, _output_qty, _prod_final.unit, _now);

    _move_refs := _move_refs || to_jsonb(_move_id);

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

grant execute on function public.beca_make_id(text) to authenticated;
grant execute on function public.beca_conversion_factor(text, text) to authenticated;
grant execute on function public.beca_create_order(text, text, numeric, date) to authenticated;
grant execute on function public.beca_stock_move(text, text, numeric, text, text, date) to authenticated;
grant execute on function public.beca_advance_order_status(text, text, text) to authenticated;

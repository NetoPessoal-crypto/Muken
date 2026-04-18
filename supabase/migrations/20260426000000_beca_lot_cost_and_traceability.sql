alter table public.beca_product_lots
  add column if not exists unit_cost numeric(18,6) not null default 0;

alter table public.beca_stock_moves
  add column if not exists unit_cost numeric(18,6),
  add column if not exists total_cost numeric(18,6);

update public.beca_product_lots l
set unit_cost = coalesce(l.unit_cost, p.custo_producao, 0)
from public.beca_products p
where p.id = l.product_id
  and p.tenant_id = l.tenant_id;

update public.beca_stock_moves s
set unit_cost = coalesce(
      s.unit_cost,
      (
        select l.unit_cost
        from public.beca_product_lots l
        where l.tenant_id = s.tenant_id
          and l.product_id = s.product_id
          and l.lote_id = s.lote_id
        order by l.created_at desc
        limit 1
      ),
      (
        select p.custo_producao
        from public.beca_products p
        where p.tenant_id = s.tenant_id
          and p.id = s.product_id
        limit 1
      ),
      0
    )
where s.unit_cost is null;

update public.beca_stock_moves s
set total_cost = round((coalesce(s.qty, 0) * coalesce(s.unit_cost, 0))::numeric, 6)
where s.total_cost is null;

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
                      'validade', to_char(l.validade, 'YYYY-MM-DD'),
                      'unitCost', l.unit_cost
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
                'unitCost', s.unit_cost,
                'totalCost', s.total_cost,
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
                'actorUserId', a.actor_user_id,
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
  _in_unit_cost numeric := 0;
  _line_total_cost numeric := 0;
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
    _in_unit_cost := coalesce(_product.custo_producao, 0);

    if _lote_id is null then
      _lote_id := public.beca_make_id('L');
    end if;

    insert into public.beca_product_lots (tenant_id, product_id, lote_id, qtd, validade, unit_cost)
    values (_tenant_id, p_product_id, _lote_id, _qty, _validade, _in_unit_cost)
    on conflict (product_id, lote_id)
    do update set
      tenant_id = excluded.tenant_id,
      qtd = public.beca_product_lots.qtd + excluded.qtd,
      validade = coalesce(excluded.validade, public.beca_product_lots.validade),
      unit_cost = case
        when (public.beca_product_lots.qtd + excluded.qtd) <= 0 then coalesce(public.beca_product_lots.unit_cost, excluded.unit_cost, 0)
        else round((
          (coalesce(public.beca_product_lots.qtd, 0) * coalesce(public.beca_product_lots.unit_cost, 0)) +
          (excluded.qtd * coalesce(excluded.unit_cost, 0))
        ) / (public.beca_product_lots.qtd + excluded.qtd), 6)
      end;

    _line_total_cost := round((_qty * _in_unit_cost)::numeric, 6);

    insert into public.beca_stock_moves (id, tenant_id, kind, ref_type, ref_id, product_id, lote_id, qty, unit, unit_cost, total_cost, at)
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
      _in_unit_cost,
      _line_total_cost,
      _now
    );
  else
    _remaining := _qty;

    for _lot in
      select l.id, l.lote_id, l.qtd, coalesce(l.unit_cost, _product.custo_producao, 0) as unit_cost
      from public.beca_product_lots l
      where l.tenant_id = _tenant_id
        and l.product_id = p_product_id
        and l.qtd > 0
        and (_lote_id is null or l.lote_id = _lote_id)
      order by coalesce(l.validade, date '9999-12-31') asc, l.created_at asc
    loop
      exit when _remaining <= 0;
      _take := least(_lot.qtd, _remaining);
      _line_total_cost := round((_take * _lot.unit_cost)::numeric, 6);

      update public.beca_product_lots
      set qtd = round(greatest(qtd - _take, 0)::numeric, 6)
      where id = _lot.id;

      insert into public.beca_stock_moves (id, tenant_id, kind, ref_type, ref_id, product_id, lote_id, qty, unit, unit_cost, total_cost, at)
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
        _lot.unit_cost,
        _line_total_cost,
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
  _role text := public.beca_get_current_role();
  _order public.beca_orders%rowtype;
  _reason text := coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'order-completed');
  _remaining numeric;
  _take numeric;
  _lot record;
  _product_unit text;
  _move_id text;
  _move_refs jsonb;
  _line_total_cost numeric;
begin
  if _tenant_id is null then
    raise exception 'Tenant nao encontrado para o usuario atual.';
  end if;

  if _role not in ('admin', 'operacao') then
    raise exception 'Permissao negada para concluir pedido.';
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
    raise exception 'Somente pedidos em logistica podem ser concluidos por este fluxo.';
  end if;

  if not jsonb_path_exists(coalesce(_order.history, '[]'::jsonb), '$[*] ? (@.reason == "dispatch:expedido")') then
    raise exception 'Pedido precisa ser expedido antes de concluir.';
  end if;

  _remaining := _order.quantidade;
  _move_refs := coalesce(_order.move_refs, '[]'::jsonb);

  select p.unit
    into _product_unit
  from public.beca_products p
  where p.tenant_id = _tenant_id
    and p.id = _order.produto_final_id
  limit 1;

  if _product_unit is null then
    raise exception 'Produto final do pedido nao encontrado.';
  end if;

  for _lot in
    select l.id, l.lote_id, l.qtd, coalesce(l.unit_cost, 0) as unit_cost
    from public.beca_product_lots l
    where l.tenant_id = _tenant_id
      and l.product_id = _order.produto_final_id
      and l.qtd > 0
    order by coalesce(l.validade, date '9999-12-31') asc, l.created_at asc
  loop
    exit when _remaining <= 0;
    _take := least(_lot.qtd, _remaining);
    _line_total_cost := round((_take * _lot.unit_cost)::numeric, 6);

    update public.beca_product_lots
    set qtd = round(greatest(qtd - _take, 0)::numeric, 6)
    where id = _lot.id;

    _move_id := public.beca_make_id('MOV');
    insert into public.beca_stock_moves (id, tenant_id, kind, ref_type, ref_id, product_id, lote_id, qty, unit, unit_cost, total_cost, at)
    values (
      _move_id,
      _tenant_id,
      'EXPEDICAO',
      'order',
      _order.id,
      _order.produto_final_id,
      _lot.lote_id,
      _take,
      _product_unit,
      _lot.unit_cost,
      _line_total_cost,
      now()
    );

    _move_refs := _move_refs || to_jsonb(_move_id);
    _remaining := round((_remaining - _take)::numeric, 6);
  end loop;

  if _remaining > 0 then
    raise exception 'Estoque insuficiente de produto final para expedicao/conclusao.';
  end if;

  delete from public.beca_product_lots
  where tenant_id = _tenant_id
    and product_id = _order.produto_final_id
    and qtd <= 0;

  update public.beca_orders
  set move_refs = _move_refs
  where tenant_id = _tenant_id
    and id = _order.id;

  return public.beca_advance_order_status(p_order_id, 'concluido', _reason);
end;
$$;

grant execute on function public.beca_stock_move(text, text, numeric, text, text, date) to authenticated;
grant execute on function public.beca_complete_order(text, text) to authenticated;

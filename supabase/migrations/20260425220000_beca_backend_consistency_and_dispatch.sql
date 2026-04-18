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

create or replace function public.beca_upsert_product(
  p_product jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant_id uuid := public.beca_get_current_tenant_id();
  _role text := public.beca_get_current_role();
  _id text := nullif(trim(coalesce(p_product->>'id', '')), '');
  _type text := nullif(trim(coalesce(p_product->>'type', '')), '');
  _name text := nullif(trim(coalesce(p_product->>'name', '')), '');
  _sku text := nullif(trim(coalesce(p_product->>'sku', '')), '');
  _unit text := nullif(trim(coalesce(p_product->>'unit', '')), '');
  _custo numeric := coalesce((p_product->>'custo_producao')::numeric, 0);
  _ativo boolean := coalesce((p_product->>'ativo')::boolean, true);
  _receita jsonb := p_product->'receita';
  _exists boolean;
  _other_id text;
  _now timestamptz := now();
  _audit_action text;
begin
  if _tenant_id is null then
    raise exception 'Tenant nao encontrado para o usuario atual.';
  end if;

  if _role not in ('admin', 'operacao') then
    raise exception 'Permissao negada para alterar produto.';
  end if;

  if _name is null or _sku is null or _unit is null then
    raise exception 'Nome, SKU e unidade sao obrigatorios.';
  end if;

  if _type not in ('ingrediente', 'embalagem', 'produto_final') then
    raise exception 'Tipo de produto invalido.';
  end if;

  if _id is null then
    _id := case when _type = 'produto_final' then public.beca_make_id('PROD') else public.beca_make_id('ING') end;
  end if;

  select p.id
    into _other_id
  from public.beca_products p
  where p.tenant_id = _tenant_id
    and p.sku = _sku
    and p.id <> _id
  limit 1;

  if _other_id is not null then
    raise exception 'SKU ja utilizado por outro produto.';
  end if;

  select exists(
    select 1 from public.beca_products p
    where p.tenant_id = _tenant_id
      and p.id = _id
  ) into _exists;

  insert into public.beca_products (id, tenant_id, type, name, sku, unit, custo_producao, ativo, receita)
  values (_id, _tenant_id, _type, _name, _sku, _unit, _custo, _ativo, _receita)
  on conflict (id) do update
  set tenant_id = excluded.tenant_id,
      type = excluded.type,
      name = excluded.name,
      sku = excluded.sku,
      unit = excluded.unit,
      custo_producao = excluded.custo_producao,
      ativo = excluded.ativo,
      receita = excluded.receita;

  if p_product ? 'lotes' then
    delete from public.beca_product_lots
    where tenant_id = _tenant_id
      and product_id = _id;

    insert into public.beca_product_lots (tenant_id, product_id, lote_id, qtd, validade)
    select
      _tenant_id,
      _id,
      coalesce(nullif(trim(l->>'loteId'), ''), public.beca_make_id('L')),
      coalesce((l->>'qtd')::numeric, 0),
      coalesce(nullif(l->>'validade', '')::date, date '2099-12-31')
    from jsonb_array_elements(coalesce(p_product->'lotes', '[]'::jsonb)) l;
  end if;

  _audit_action := case when _exists then 'product.updated' else 'product.created' end;

  insert into public.beca_audit_logs (id, tenant_id, action, entity, before_data, after_data, reason, at)
  values (
    public.beca_make_id('AUD'),
    _tenant_id,
    _audit_action,
    'product',
    null,
    jsonb_build_object('id', _id, 'name', _name, 'sku', _sku, 'type', _type),
    'upsert-product',
    _now
  );

  return public.beca_get_app_state();
end;
$$;

create or replace function public.beca_delete_or_inactivate_product(
  p_product_id text
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
  _has_stock_history boolean;
  _has_order_usage boolean;
  _used_in_recipe boolean;
  _now timestamptz := now();
begin
  if _tenant_id is null then
    raise exception 'Tenant nao encontrado para o usuario atual.';
  end if;

  if _role not in ('admin', 'operacao') then
    raise exception 'Permissao negada para remover/inativar produto.';
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

  select exists(
    select 1 from public.beca_stock_moves s
    where s.tenant_id = _tenant_id
      and s.product_id = p_product_id
  ) into _has_stock_history;

  select exists(
    select 1 from public.beca_orders o
    where o.tenant_id = _tenant_id
      and o.produto_final_id = p_product_id
  ) into _has_order_usage;

  select exists(
    select 1
    from public.beca_products p,
         jsonb_array_elements(coalesce(p.receita->'ingredientes', '[]'::jsonb)) ing
    where p.tenant_id = _tenant_id
      and ing->>'id' = p_product_id
  ) into _used_in_recipe;

  if _has_stock_history or _has_order_usage or _used_in_recipe then
    update public.beca_products
    set ativo = false
    where tenant_id = _tenant_id
      and id = p_product_id;

    insert into public.beca_audit_logs (id, tenant_id, action, entity, before_data, after_data, reason, at)
    values (
      public.beca_make_id('AUD'),
      _tenant_id,
      'product.inactivated',
      'product',
      jsonb_build_object('id', _product.id, 'ativo', _product.ativo),
      jsonb_build_object('id', _product.id, 'ativo', false),
      'has-history',
      _now
    );
  else
    delete from public.beca_products
    where tenant_id = _tenant_id
      and id = p_product_id;

    insert into public.beca_audit_logs (id, tenant_id, action, entity, before_data, after_data, reason, at)
    values (
      public.beca_make_id('AUD'),
      _tenant_id,
      'product.deleted',
      'product',
      jsonb_build_object('id', _product.id, 'name', _product.name),
      null,
      'no-history',
      _now
    );
  end if;

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
    select l.id, l.lote_id, l.qtd
    from public.beca_product_lots l
    where l.tenant_id = _tenant_id
      and l.product_id = _order.produto_final_id
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
    values (_move_id, _tenant_id, 'EXPEDICAO', 'order', _order.id, _order.produto_final_id, _lot.lote_id, _take, _product_unit, now());

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

grant execute on function public.beca_upsert_product(jsonb) to authenticated;
grant execute on function public.beca_delete_or_inactivate_product(text) to authenticated;
grant execute on function public.beca_complete_order(text, text) to authenticated;

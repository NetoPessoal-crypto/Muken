create table if not exists public.beca_lot_genealogy (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.beca_tenants(id) on delete cascade,
  parent_lot_uuid uuid not null references public.beca_product_lots(id) on delete cascade,
  child_lot_uuid uuid not null references public.beca_product_lots(id) on delete cascade,
  qty_used numeric(18,6) not null,
  unit text,
  order_id text references public.beca_orders(id) on delete set null,
  at timestamptz not null default now()
);

create index if not exists beca_lot_genealogy_tenant_idx on public.beca_lot_genealogy(tenant_id);
create index if not exists beca_lot_genealogy_parent_idx on public.beca_lot_genealogy(parent_lot_uuid);
create index if not exists beca_lot_genealogy_child_idx on public.beca_lot_genealogy(child_lot_uuid);

alter table public.beca_lot_genealogy enable row level security;

create policy beca_lot_genealogy_tenant_select on public.beca_lot_genealogy
for select to authenticated
using (tenant_id = public.beca_get_current_tenant_id());

create policy beca_lot_genealogy_tenant_write on public.beca_lot_genealogy
for all to authenticated
using (tenant_id = public.beca_get_current_tenant_id() and public.beca_can_write())
with check (tenant_id = public.beca_get_current_tenant_id() and public.beca_can_write());

-- Update get_app_state to include genealogy summary (optional, but good for auditing)
-- Actually let's just update the advance_order_status first.

create or replace function public.beca_get_lot_genealogy(
  p_lote_id text default null,
  p_product_id text default null,
  p_order_id text default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with ctx as (select public.beca_get_current_tenant_id() as tenant_id)
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id,
    'parent_lot_id', g.parent_lot_uuid,
    'child_lot_id', g.child_lot_uuid,
    'qty_used', g.qty_used,
    'unit', g.unit,
    'order_id', g.order_id,
    'at', g.at
  ) order by g.at), '[]'::jsonb)
  from public.beca_lot_genealogy g
  where g.tenant_id = (select tenant_id from ctx)
    and (p_lote_id is null or g.parent_lot_uuid::text = p_lote_id or g.child_lot_uuid::text = p_lote_id)
    and (p_product_id is null or exists (select 1 from public.beca_product_lots l where l.id = g.parent_lot_uuid and l.product_id = p_product_id))
    and (p_order_id is null or g.order_id = p_order_id);
$$;

grant execute on function public.beca_get_lot_genealogy(text, text, text) to authenticated;

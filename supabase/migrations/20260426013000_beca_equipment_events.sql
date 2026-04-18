create table if not exists public.beca_equipment_events (
  id text primary key,
  tenant_id uuid not null references public.beca_tenants(id) on delete cascade,
  equipment_id text not null references public.beca_equipments(id) on delete cascade,
  event_type text not null check (event_type in ('normal', 'parada', 'manutencao', 'quebra', 'retomada')),
  note text,
  metadata jsonb not null default '{}'::jsonb,
  actor_user_id uuid,
  at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists beca_equipment_events_tenant_idx on public.beca_equipment_events(tenant_id, at desc);
create index if not exists beca_equipment_events_equipment_idx on public.beca_equipment_events(equipment_id, at desc);

alter table public.beca_equipment_events enable row level security;

drop policy if exists beca_equipment_events_tenant_select on public.beca_equipment_events;
create policy beca_equipment_events_tenant_select on public.beca_equipment_events
for select to authenticated
using (tenant_id = public.beca_get_current_tenant_id());

drop policy if exists beca_equipment_events_tenant_write on public.beca_equipment_events;
create policy beca_equipment_events_tenant_write on public.beca_equipment_events
for all to authenticated
using (tenant_id = public.beca_get_current_tenant_id() and public.beca_can_write())
with check (tenant_id = public.beca_get_current_tenant_id() and public.beca_can_write());

create or replace function public.beca_log_equipment_event(
  p_equipment_id text,
  p_event_type text,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant_id uuid := public.beca_get_current_tenant_id();
  _role text := public.beca_get_current_role();
  _event_type text := lower(coalesce(trim(p_event_type), ''));
  _equipment public.beca_equipments%rowtype;
  _event_id text := public.beca_make_id('EVT');
  _now timestamptz := now();
  _next_status text;
begin
  if _tenant_id is null then
    raise exception 'Tenant nao encontrado para o usuario atual.';
  end if;

  if _role not in ('admin', 'operacao') then
    raise exception 'Permissao negada para registrar evento de equipamento.';
  end if;

  if _event_type not in ('normal', 'parada', 'manutencao', 'quebra', 'retomada') then
    raise exception 'Tipo de evento de equipamento invalido.';
  end if;

  select *
    into _equipment
  from public.beca_equipments e
  where e.tenant_id = _tenant_id
    and e.id = p_equipment_id
  for update;

  if not found then
    raise exception 'Equipamento nao encontrado.';
  end if;

  _next_status := case _event_type
    when 'normal' then 'Normal'
    when 'retomada' then 'Normal'
    when 'parada' then 'Parado'
    when 'manutencao' then 'Manutencao'
    when 'quebra' then 'Falha'
    else _equipment.status
  end;

  update public.beca_equipments
  set status = _next_status
  where tenant_id = _tenant_id
    and id = _equipment.id;

  insert into public.beca_equipment_events (
    id,
    tenant_id,
    equipment_id,
    event_type,
    note,
    metadata,
    actor_user_id,
    at,
    created_at
  ) values (
    _event_id,
    _tenant_id,
    _equipment.id,
    _event_type,
    nullif(trim(coalesce(p_note, '')), ''),
    coalesce(p_metadata, '{}'::jsonb),
    auth.uid(),
    _now,
    _now
  );

  insert into public.beca_audit_logs (id, tenant_id, action, entity, before_data, after_data, reason, at)
  values (
    public.beca_make_id('AUD'),
    _tenant_id,
    'equipment.event-logged',
    'equipment',
    jsonb_build_object('id', _equipment.id, 'status', _equipment.status),
    jsonb_build_object('id', _equipment.id, 'status', _next_status, 'eventType', _event_type, 'eventId', _event_id),
    coalesce(nullif(trim(coalesce(p_note, '')), ''), _event_type),
    _now
  );

  return jsonb_build_object(
    'id', _event_id,
    'equipmentId', _equipment.id,
    'eventType', _event_type,
    'status', _next_status,
    'note', nullif(trim(coalesce(p_note, '')), ''),
    'actorUserId', auth.uid(),
    'at', _now
  );
end;
$$;

create or replace function public.beca_list_equipment_events(
  p_equipment_id text default null,
  p_limit integer default 100
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with ctx as (
    select public.beca_get_current_tenant_id() as tenant_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'equipmentId', e.equipment_id,
        'eventType', e.event_type,
        'note', e.note,
        'metadata', e.metadata,
        'actorUserId', e.actor_user_id,
        'at', e.at
      )
      order by e.at desc
    ),
    '[]'::jsonb
  )
  from (
    select ev.*
    from public.beca_equipment_events ev
    where ev.tenant_id = (select tenant_id from ctx)
      and (p_equipment_id is null or ev.equipment_id = p_equipment_id)
    order by ev.at desc
    limit greatest(coalesce(p_limit, 100), 1)
  ) e;
$$;

grant execute on function public.beca_log_equipment_event(text, text, text, jsonb) to authenticated;
grant execute on function public.beca_list_equipment_events(text, integer) to authenticated;

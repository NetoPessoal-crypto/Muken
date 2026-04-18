create or replace function public.beca_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.beca_get_current_role() = 'admin', false);
$$;

create or replace function public.beca_list_memberships()
returns table (
  user_id uuid,
  email text,
  role text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from public.beca_memberships m
  join auth.users u on u.id = m.user_id
  where m.tenant_id = public.beca_get_current_tenant_id()
  order by m.created_at asc;
$$;

create or replace function public.beca_add_member_by_email(p_email text, p_role text default 'operacao')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.beca_get_current_tenant_id();
  v_user_id uuid;
  v_role text := coalesce(nullif(trim(p_role), ''), 'operacao');
begin
  if not public.beca_is_admin() then
    raise exception 'Apenas admin pode adicionar membros.';
  end if;

  if v_tenant_id is null then
    raise exception 'Tenant atual não encontrado.';
  end if;

  if v_role not in ('admin', 'operacao', 'leitura') then
    raise exception 'Role inválida.';
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    raise exception 'Usuário com esse e-mail não existe no Auth.';
  end if;

  insert into public.beca_memberships (tenant_id, user_id, role)
  values (v_tenant_id, v_user_id, v_role)
  on conflict (tenant_id, user_id)
  do update set role = excluded.role;

  return jsonb_build_object('tenant_id', v_tenant_id, 'user_id', v_user_id, 'role', v_role);
end;
$$;

create or replace function public.beca_set_member_role(p_user_id uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.beca_get_current_tenant_id();
  v_role text := coalesce(nullif(trim(p_role), ''), 'operacao');
begin
  if not public.beca_is_admin() then
    raise exception 'Apenas admin pode alterar role.';
  end if;

  if v_tenant_id is null then
    raise exception 'Tenant atual não encontrado.';
  end if;

  if v_role not in ('admin', 'operacao', 'leitura') then
    raise exception 'Role inválida.';
  end if;

  update public.beca_memberships
  set role = v_role
  where tenant_id = v_tenant_id and user_id = p_user_id;

  if not found then
    raise exception 'Membro não encontrado no tenant.';
  end if;

  return jsonb_build_object('tenant_id', v_tenant_id, 'user_id', p_user_id, 'role', v_role);
end;
$$;

create or replace function public.beca_remove_member(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.beca_get_current_tenant_id();
begin
  if not public.beca_is_admin() then
    raise exception 'Apenas admin pode remover membro.';
  end if;

  if auth.uid() = p_user_id then
    raise exception 'Admin não pode remover a si mesmo por esta função.';
  end if;

  delete from public.beca_memberships
  where tenant_id = v_tenant_id and user_id = p_user_id;

  if not found then
    raise exception 'Membro não encontrado no tenant.';
  end if;

  return jsonb_build_object('tenant_id', v_tenant_id, 'user_id', p_user_id, 'removed', true);
end;
$$;

grant execute on function public.beca_is_admin() to authenticated;
grant execute on function public.beca_list_memberships() to authenticated;
grant execute on function public.beca_add_member_by_email(text, text) to authenticated;
grant execute on function public.beca_set_member_role(uuid, text) to authenticated;
grant execute on function public.beca_remove_member(uuid) to authenticated;

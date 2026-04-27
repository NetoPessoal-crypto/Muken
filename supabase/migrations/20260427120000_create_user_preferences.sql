-- Create user_preferences table to store per-user UI preferences
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row level security: users may manage their own preferences
alter table public.user_preferences enable row level security;

drop policy if exists user_preferences_self on public.user_preferences;
create policy user_preferences_self on public.user_preferences
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.user_preferences to authenticated;

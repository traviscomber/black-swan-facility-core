create table if not exists public.orchard_dashboard_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  base_view text not null default 'operation' check (base_view in ('operation','planning')),
  widget_order jsonb not null default '["tasks","weather","revenue","notepad","notes","crops","milestones"]'::jsonb,
  hidden_widgets jsonb not null default '[]'::jsonb,
  notepad text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orchard_dashboard_profiles_widget_order_array check (jsonb_typeof(widget_order)='array'),
  constraint orchard_dashboard_profiles_hidden_widgets_array check (jsonb_typeof(hidden_widgets)='array'),
  constraint orchard_dashboard_profiles_name_length check (char_length(trim(name)) between 1 and 48),
  constraint orchard_dashboard_profiles_notepad_length check (char_length(notepad) <= 300)
);

create unique index if not exists orchard_dashboard_profiles_user_name_unique
  on public.orchard_dashboard_profiles(user_id, lower(name));

alter table public.orchard_dashboard_profiles enable row level security;

drop policy if exists orchard_dashboard_profiles_select_own on public.orchard_dashboard_profiles;
create policy orchard_dashboard_profiles_select_own on public.orchard_dashboard_profiles
for select using (auth.uid()=user_id);

drop policy if exists orchard_dashboard_profiles_insert_own on public.orchard_dashboard_profiles;
create policy orchard_dashboard_profiles_insert_own on public.orchard_dashboard_profiles
for insert with check (auth.uid()=user_id and public.can_access_orchard_global());

drop policy if exists orchard_dashboard_profiles_update_own on public.orchard_dashboard_profiles;
create policy orchard_dashboard_profiles_update_own on public.orchard_dashboard_profiles
for update using (auth.uid()=user_id) with check (auth.uid()=user_id and public.can_access_orchard_global());

drop policy if exists orchard_dashboard_profiles_delete_own on public.orchard_dashboard_profiles;
create policy orchard_dashboard_profiles_delete_own on public.orchard_dashboard_profiles
for delete using (auth.uid()=user_id);

grant select,insert,update,delete on public.orchard_dashboard_profiles to authenticated;

create or replace function public.touch_orchard_dashboard_profiles()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_orchard_dashboard_profiles on public.orchard_dashboard_profiles;
create trigger trg_touch_orchard_dashboard_profiles
before update on public.orchard_dashboard_profiles
for each row execute function public.touch_orchard_dashboard_profiles();

alter table public.orchard_dashboard_preferences
  add column if not exists active_profile_id uuid references public.orchard_dashboard_profiles(id) on delete set null;

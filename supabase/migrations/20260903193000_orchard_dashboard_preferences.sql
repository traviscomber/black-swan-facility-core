create table if not exists public.orchard_dashboard_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_view text not null default 'operation' check (active_view in ('operation','planning')),
  widget_order jsonb not null default '["tasks","weather","revenue","notepad","notes","crops","milestones"]'::jsonb,
  hidden_widgets jsonb not null default '[]'::jsonb,
  operation_widget_order jsonb not null default '["tasks","weather","revenue","notepad","notes","crops","milestones"]'::jsonb,
  planning_widget_order jsonb not null default '["revenue","crops","milestones","tasks","weather","notes","notepad"]'::jsonb,
  operation_hidden_widgets jsonb not null default '[]'::jsonb,
  planning_hidden_widgets jsonb not null default '[]'::jsonb,
  notepad text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orchard_dashboard_widget_order_array check (jsonb_typeof(widget_order) = 'array'),
  constraint orchard_dashboard_hidden_widgets_array check (jsonb_typeof(hidden_widgets) = 'array'),
  constraint orchard_dashboard_operation_widget_order_array check (jsonb_typeof(operation_widget_order) = 'array'),
  constraint orchard_dashboard_planning_widget_order_array check (jsonb_typeof(planning_widget_order) = 'array'),
  constraint orchard_dashboard_operation_hidden_widgets_array check (jsonb_typeof(operation_hidden_widgets) = 'array'),
  constraint orchard_dashboard_planning_hidden_widgets_array check (jsonb_typeof(planning_hidden_widgets) = 'array'),
  constraint orchard_dashboard_notepad_length check (char_length(notepad) <= 300)
);

alter table public.orchard_dashboard_preferences enable row level security;

drop policy if exists orchard_dashboard_preferences_select_own on public.orchard_dashboard_preferences;
create policy orchard_dashboard_preferences_select_own on public.orchard_dashboard_preferences
for select using (auth.uid() = user_id);

drop policy if exists orchard_dashboard_preferences_insert_own on public.orchard_dashboard_preferences;
create policy orchard_dashboard_preferences_insert_own on public.orchard_dashboard_preferences
for insert with check (auth.uid() = user_id);

drop policy if exists orchard_dashboard_preferences_update_own on public.orchard_dashboard_preferences;
create policy orchard_dashboard_preferences_update_own on public.orchard_dashboard_preferences
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.orchard_dashboard_preferences to authenticated;

create or replace function public.touch_orchard_dashboard_preferences()
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

drop trigger if exists trg_touch_orchard_dashboard_preferences on public.orchard_dashboard_preferences;
create trigger trg_touch_orchard_dashboard_preferences
before update on public.orchard_dashboard_preferences
for each row execute function public.touch_orchard_dashboard_preferences();

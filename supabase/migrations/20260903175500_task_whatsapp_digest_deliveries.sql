create table if not exists public.task_whatsapp_digest_deliveries (
  id uuid primary key default gen_random_uuid(),
  local_date date not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  phone text not null,
  task_ids uuid[] not null default '{}',
  task_count integer not null default 0 check (task_count >= 0),
  status text not null check (status in ('processing', 'sent', 'failed', 'skipped')),
  greenapi_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (local_date, employee_id)
);

create index if not exists task_whatsapp_digest_deliveries_created_at_idx
  on public.task_whatsapp_digest_deliveries (created_at desc);

alter table public.task_whatsapp_digest_deliveries enable row level security;

drop policy if exists task_whatsapp_digest_deliveries_admin_read on public.task_whatsapp_digest_deliveries;
create policy task_whatsapp_digest_deliveries_admin_read
  on public.task_whatsapp_digest_deliveries
  for select
  to authenticated
  using (public.current_app_role() = 'admin');

create or replace function public.touch_task_whatsapp_digest_delivery_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists task_whatsapp_digest_deliveries_touch_updated_at on public.task_whatsapp_digest_deliveries;
create trigger task_whatsapp_digest_deliveries_touch_updated_at
before update on public.task_whatsapp_digest_deliveries
for each row execute function public.touch_task_whatsapp_digest_delivery_updated_at();

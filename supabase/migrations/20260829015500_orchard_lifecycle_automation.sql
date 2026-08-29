alter table public.orchard_crop_successions
  drop constraint if exists orchard_crop_successions_status_check;

alter table public.orchard_crop_successions
  add constraint orchard_crop_successions_status_check
  check (status = any (array[
    'planned'::text,
    'nursery'::text,
    'hardening'::text,
    'transplanted'::text,
    'growing'::text,
    'harvest_ready'::text,
    'harvesting'::text,
    'completed'::text,
    'cancelled'::text
  ]));

alter table public.orchard_crop_successions
  add column if not exists lifecycle_updated_at timestamptz not null default now(),
  add column if not exists lifecycle_source text not null default 'manual';

create table if not exists public.orchard_succession_lifecycle_history (
  id uuid primary key default gen_random_uuid(),
  crop_succession_id uuid not null references public.orchard_crop_successions(id) on delete cascade,
  from_status text,
  to_status text not null,
  source text not null,
  reason text,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now(),
  check (to_status = any (array[
    'planned'::text,
    'nursery'::text,
    'hardening'::text,
    'transplanted'::text,
    'growing'::text,
    'harvest_ready'::text,
    'harvesting'::text,
    'completed'::text,
    'cancelled'::text
  ]))
);

create index if not exists idx_orchard_lifecycle_history_succession
  on public.orchard_succession_lifecycle_history(crop_succession_id, changed_at desc);

alter table public.orchard_succession_lifecycle_history enable row level security;

drop policy if exists orchard_succession_lifecycle_history_select on public.orchard_succession_lifecycle_history;
create policy orchard_succession_lifecycle_history_select
  on public.orchard_succession_lifecycle_history
  for select
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') in ('admin', 'approver')
  );

revoke insert, update, delete on public.orchard_succession_lifecycle_history from authenticated, anon;
grant select on public.orchard_succession_lifecycle_history to authenticated;

create or replace function public.orchard_compute_succession_lifecycle(p_succession_id uuid)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_status text;
  planned_first_harvest date;
  has_nursery boolean;
  has_hardening boolean;
  has_transplant boolean;
  has_crop boolean;
  has_mature_crop boolean;
  has_active_crop boolean;
  has_harvest boolean;
  all_crops_harvested boolean;
begin
  select status, planned_first_harvest_date
  into current_status, planned_first_harvest
  from public.orchard_crop_successions
  where id = p_succession_id;

  if current_status is null then
    return null;
  end if;

  if current_status = 'cancelled' then
    return 'cancelled';
  end if;

  select
    exists(select 1 from public.orchard_nursery_batches n where n.crop_succession_id = p_succession_id and n.status not in ('cancelled','failed')),
    exists(select 1 from public.orchard_nursery_batches n where n.crop_succession_id = p_succession_id and (n.status = 'hardening' or n.hardening_started_date is not null)),
    exists(select 1 from public.orchard_nursery_batches n where n.crop_succession_id = p_succession_id and (coalesce(n.transplanted_count,0) > 0 or n.status in ('transplanted','completed')))
  into has_nursery, has_hardening, has_transplant;

  select
    exists(select 1 from public.orchard_crops c where c.crop_succession_id = p_succession_id),
    exists(select 1 from public.orchard_crops c where c.crop_succession_id = p_succession_id and c.status = 'mature'),
    exists(select 1 from public.orchard_crops c where c.crop_succession_id = p_succession_id and c.status in ('seed','seedling','growing','mature','harvesting','replanting')),
    case
      when exists(select 1 from public.orchard_crops c where c.crop_succession_id = p_succession_id)
      then not exists(select 1 from public.orchard_crops c where c.crop_succession_id = p_succession_id and c.status <> 'harvested')
      else false
    end
  into has_crop, has_mature_crop, has_active_crop, all_crops_harvested;

  select exists(
    select 1 from public.orchard_harvest_records h
    where h.crop_succession_id = p_succession_id
  ) into has_harvest;

  if has_harvest and all_crops_harvested then
    return 'completed';
  end if;

  if has_harvest then
    return 'harvesting';
  end if;

  if has_mature_crop or (has_active_crop and planned_first_harvest is not null and planned_first_harvest <= current_date) then
    return 'harvest_ready';
  end if;

  if has_crop then
    return 'growing';
  end if;

  if has_transplant then
    return 'transplanted';
  end if;

  if has_hardening then
    return 'hardening';
  end if;

  if has_nursery then
    return 'nursery';
  end if;

  return 'planned';
end;
$$;

create or replace function public.orchard_sync_succession_lifecycle(
  p_succession_id uuid,
  p_source text,
  p_reason text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  old_status text;
  new_status text;
begin
  if p_succession_id is null then
    return null;
  end if;

  select status into old_status
  from public.orchard_crop_successions
  where id = p_succession_id
  for update;

  if old_status is null then
    return null;
  end if;

  new_status := public.orchard_compute_succession_lifecycle(p_succession_id);

  if new_status is distinct from old_status then
    update public.orchard_crop_successions
    set status = new_status,
        lifecycle_updated_at = now(),
        lifecycle_source = coalesce(nullif(trim(p_source), ''), 'automation'),
        updated_at = now()
    where id = p_succession_id;

    insert into public.orchard_succession_lifecycle_history(
      crop_succession_id, from_status, to_status, source, reason, changed_by
    ) values (
      p_succession_id,
      old_status,
      new_status,
      coalesce(nullif(trim(p_source), ''), 'automation'),
      nullif(trim(p_reason), ''),
      auth.uid()
    );
  end if;

  return new_status;
end;
$$;

revoke all on function public.orchard_sync_succession_lifecycle(uuid, text, text) from public, anon;
grant execute on function public.orchard_sync_succession_lifecycle(uuid, text, text) to authenticated;

create or replace function public.orchard_lifecycle_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  succession_id uuid;
begin
  succession_id := case when tg_op = 'DELETE' then old.crop_succession_id else new.crop_succession_id end;
  perform public.orchard_sync_succession_lifecycle(
    succession_id,
    lower(tg_table_name),
    lower(tg_op)
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists orchard_nursery_lifecycle_sync on public.orchard_nursery_batches;
create trigger orchard_nursery_lifecycle_sync
after insert or update or delete on public.orchard_nursery_batches
for each row execute function public.orchard_lifecycle_trigger();

drop trigger if exists orchard_crop_lifecycle_sync on public.orchard_crops;
create trigger orchard_crop_lifecycle_sync
after insert or update or delete on public.orchard_crops
for each row execute function public.orchard_lifecycle_trigger();

drop trigger if exists orchard_harvest_lifecycle_sync on public.orchard_harvest_records;
create trigger orchard_harvest_lifecycle_sync
after insert or update or delete on public.orchard_harvest_records
for each row execute function public.orchard_lifecycle_trigger();

create or replace view public.orchard_succession_lifecycle
with (security_invoker = true)
as
select
  s.id as crop_succession_id,
  s.crop_cycle_id,
  s.sequence_no,
  s.status as persisted_status,
  public.orchard_compute_succession_lifecycle(s.id) as effective_status,
  s.lifecycle_source,
  s.lifecycle_updated_at,
  s.planned_sow_date,
  s.planned_transplant_date,
  s.planned_first_harvest_date,
  s.planned_last_harvest_date,
  coalesce((select sum(n.seeds_sown) from public.orchard_nursery_batches n where n.crop_succession_id = s.id),0) as seeds_sown,
  coalesce((select sum(n.transplanted_count) from public.orchard_nursery_batches n where n.crop_succession_id = s.id),0) as transplanted_count,
  (select min(c.planting_date) from public.orchard_crops c where c.crop_succession_id = s.id) as first_planting_date,
  (select min(h.harvest_date) from public.orchard_harvest_records h where h.crop_succession_id = s.id) as first_harvest_date,
  (select count(*) from public.orchard_harvest_records h where h.crop_succession_id = s.id) as harvest_passes
from public.orchard_crop_successions s;

grant select on public.orchard_succession_lifecycle to authenticated;

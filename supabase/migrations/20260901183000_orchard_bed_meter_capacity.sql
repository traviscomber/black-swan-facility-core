-- Heirloom parity: represent planting demand and bed occupancy in bed meters.
-- This migration is intentionally capacity-based. The authenticated Heirloom UI
-- did not expose an explicit longitudinal start/end offset within a bed.

begin;

alter table public.orchard_crop_successions
  add column if not exists planned_bed_m numeric(10,2);

alter table public.orchard_bed_allocations
  add column if not exists allocated_length_m numeric(10,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orchard_crop_successions'::regclass
      and conname = 'orchard_crop_successions_planned_bed_m_positive'
  ) then
    alter table public.orchard_crop_successions
      add constraint orchard_crop_successions_planned_bed_m_positive
      check (planned_bed_m is null or planned_bed_m > 0);
  end if;
end $$;

-- Existing allocations need a real physical bed length before a safe backfill.
do $$
begin
  if exists (
    select 1
    from public.orchard_bed_allocations a
    join public.orchard_beds b on b.id = a.bed_id
    where a.allocated_length_m is null
      and (b.length_m is null or b.length_m <= 0)
  ) then
    raise exception 'Cannot infer bed meters for existing allocation with missing/invalid bed length';
  end if;
end $$;

-- Backward-compatible inference for any legacy allocations. Area is converted to
-- bed meters only when the canonical bed width is present; otherwise the legacy
-- allocation is treated as the full physical bed it historically blocked.
update public.orchard_bed_allocations a
set allocated_length_m = least(
  b.length_m,
  case
    when a.allocated_area_sqm is not null and a.allocated_area_sqm > 0
      and b.width_m is not null and b.width_m > 0
      then a.allocated_area_sqm / b.width_m
    else b.length_m
  end
)
from public.orchard_beds b
where b.id = a.bed_id
  and a.allocated_length_m is null;

alter table public.orchard_bed_allocations
  alter column allocated_length_m set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orchard_bed_allocations'::regclass
      and conname = 'orchard_bed_allocations_length_positive'
  ) then
    alter table public.orchard_bed_allocations
      add constraint orchard_bed_allocations_length_positive
      check (allocated_length_m > 0);
  end if;
end $$;

-- Whole-bed exclusion is incompatible with partial bed-meter occupancy.
alter table public.orchard_bed_allocations
  drop constraint if exists orchard_bed_allocations_no_overlap;

create index if not exists orchard_bed_allocations_bed_dates_idx
  on public.orchard_bed_allocations
  using gist (bed_id, daterange(planned_start_date, planned_end_date, '[]'));

create or replace function public.orchard_enforce_bed_meter_capacity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_bed_length numeric;
  v_bed_width numeric;
  v_over_date date;
  v_over_used numeric;
begin
  if new.planned_start_date is null or new.planned_end_date is null then
    raise exception 'Allocation dates are required';
  end if;
  if new.planned_end_date < new.planned_start_date then
    raise exception 'End date must be on or after start date';
  end if;

  -- Serialize capacity checks per physical bed so concurrent inserts cannot both
  -- pass against the same remaining meters.
  select b.length_m, b.width_m
    into v_bed_length, v_bed_width
  from public.orchard_beds b
  where b.id = new.bed_id
    and b.status = 'active'
  for update;

  if not found then
    raise exception 'Allocation requires an authorized active physical bed';
  end if;
  if v_bed_length is null or v_bed_length <= 0 then
    raise exception 'Bed length must be positive before bed-meter allocation';
  end if;

  if new.allocated_length_m is null then
    if new.allocated_area_sqm is not null and new.allocated_area_sqm > 0
      and v_bed_width is not null and v_bed_width > 0 then
      new.allocated_length_m := new.allocated_area_sqm / v_bed_width;
    else
      new.allocated_length_m := v_bed_length;
    end if;
  end if;

  if new.allocated_length_m <= 0 then
    raise exception 'Allocated bed meters must be positive';
  end if;
  if new.allocated_length_m > v_bed_length then
    raise exception 'A single bed allocation cannot exceed physical bed length (% m)', v_bed_length;
  end if;

  if new.allocated_area_sqm is null
    and v_bed_width is not null and v_bed_width > 0 then
    new.allocated_area_sqm := new.allocated_length_m * v_bed_width;
  end if;

  -- Crop Map dates are date-granular. Validate actual concurrent occupancy for
  -- every date in the new range rather than summing allocations that never
  -- overlap each other.
  select d::date,
         coalesce(sum(a.allocated_length_m), 0) + new.allocated_length_m
    into v_over_date, v_over_used
  from generate_series(
    new.planned_start_date::timestamp,
    new.planned_end_date::timestamp,
    interval '1 day'
  ) as d
  left join public.orchard_bed_allocations a
    on a.bed_id = new.bed_id
   and a.id is distinct from new.id
   and d::date between a.planned_start_date and a.planned_end_date
  group by d
  having coalesce(sum(a.allocated_length_m), 0) + new.allocated_length_m > v_bed_length + 0.0001
  order by d
  limit 1;

  if v_over_date is not null then
    raise exception 'Bed-meter capacity exceeded on %: requested concurrent use % m exceeds physical length % m',
      v_over_date, v_over_used, v_bed_length;
  end if;

  return new;
end;
$$;

drop trigger if exists orchard_bed_meter_capacity_guard on public.orchard_bed_allocations;
create trigger orchard_bed_meter_capacity_guard
before insert or update of bed_id, planned_start_date, planned_end_date, allocated_area_sqm, allocated_length_m
on public.orchard_bed_allocations
for each row execute function public.orchard_enforce_bed_meter_capacity();

-- Manual Crop Map primitive: place a bed-meter amount on one bed. Large
-- plantings can be represented by multiple allocation rows across beds.
create or replace function public.orchard_allocate_bed_meters(
  p_succession_id uuid,
  p_bed_id uuid,
  p_start_date date,
  p_end_date date,
  p_bed_m numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_width numeric;
  v_allocation_id uuid;
  v_area numeric;
begin
  if not public.can_access_orchard_succession(p_succession_id) then
    raise exception 'Not authorized for succession';
  end if;
  if not public.can_access_orchard_bed(p_bed_id) then
    raise exception 'Not authorized for bed';
  end if;
  if p_bed_m is null or p_bed_m <= 0 then
    raise exception 'A positive bed-meter amount is required';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'A valid allocation date range is required';
  end if;

  select width_m into v_width
  from public.orchard_beds
  where id = p_bed_id and status = 'active';
  if not found then raise exception 'Active bed not found'; end if;

  v_area := case when v_width is not null and v_width > 0 then p_bed_m * v_width else null end;

  insert into public.orchard_bed_allocations (
    bed_id,
    crop_succession_id,
    planned_start_date,
    planned_end_date,
    allocated_area_sqm,
    allocated_length_m,
    notes
  ) values (
    p_bed_id,
    p_succession_id,
    p_start_date,
    p_end_date,
    v_area,
    p_bed_m,
    p_notes
  )
  returning id into v_allocation_id;

  return jsonb_build_object(
    'allocation_id', v_allocation_id,
    'bed_id', p_bed_id,
    'crop_succession_id', p_succession_id,
    'allocated_bed_m', p_bed_m,
    'allocated_area_sqm', v_area,
    'planned_start_date', p_start_date,
    'planned_end_date', p_end_date
  );
end;
$$;

revoke all on function public.orchard_allocate_bed_meters(uuid, uuid, date, date, numeric, text) from public;
grant execute on function public.orchard_allocate_bed_meters(uuid, uuid, date, date, numeric, text) to authenticated, service_role;

comment on column public.orchard_crop_successions.planned_bed_m is
  'Explicit planned bed-meter demand when known. Nullable: never infer it without canonical evidence.';
comment on column public.orchard_bed_allocations.allocated_length_m is
  'Bed meters occupied on this physical bed during the allocation date range.';
comment on function public.orchard_enforce_bed_meter_capacity() is
  'Serializes and enforces cumulative per-bed bed-meter capacity for date-overlapping allocations.';

commit;

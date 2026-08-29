alter table public.orchard_crop_library
  add column if not exists provenance_type text not null default 'manual',
  add column if not exists observed_count integer not null default 0,
  add column if not exists last_observed_at timestamptz;

do $$ begin
  alter table public.orchard_crop_library add constraint orchard_crop_library_provenance_check check (provenance_type in ('manual','observed','reference'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.orchard_crop_library add constraint orchard_crop_library_observed_count_check check (observed_count >= 0);
exception when duplicate_object then null; end $$;

alter table public.orchard_cultivar_library
  add column if not exists provenance_type text not null default 'manual',
  add column if not exists observed_count integer not null default 0,
  add column if not exists last_observed_at timestamptz;

do $$ begin
  alter table public.orchard_cultivar_library add constraint orchard_cultivar_library_provenance_check check (provenance_type in ('manual','observed','reference'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.orchard_cultivar_library add constraint orchard_cultivar_library_observed_count_check check (observed_count >= 0);
exception when duplicate_object then null; end $$;

alter table public.orchard_crop_successions
  add column if not exists crop_library_id uuid references public.orchard_crop_library(id) on delete set null,
  add column if not exists cultivar_library_id uuid references public.orchard_cultivar_library(id) on delete set null,
  add column if not exists knowledge_applied_at timestamptz,
  add column if not exists knowledge_source_snapshot jsonb;

insert into public.orchard_crop_library(crop_name, category, provenance_type, observed_count, last_observed_at)
select c.crop_name, max(c.crop_type)::text, 'observed', count(*)::int, max(c.created_at)::timestamptz
from public.orchard_crops c
where c.crop_name is not null and btrim(c.crop_name) <> ''
  and not exists (select 1 from public.orchard_crop_library l where lower(l.crop_name)=lower(c.crop_name))
group by c.crop_name;

insert into public.orchard_cultivar_library(crop_library_id, variety, days_to_maturity, plant_spacing_cm, provenance_type, observed_count, last_observed_at)
select l.id, c.variety,
       round(avg(nullif(c.days_to_harvest,0)))::int,
       round(avg(nullif(c.spacing_cm,0)),1),
       'observed', count(*)::int, max(c.created_at)::timestamptz
from public.orchard_crops c
join public.orchard_crop_library l on lower(l.crop_name)=lower(c.crop_name)
where c.variety is not null and btrim(c.variety) <> ''
  and not exists (select 1 from public.orchard_cultivar_library v where v.crop_library_id=l.id and lower(v.variety)=lower(c.variety))
group by l.id, c.variety;

create or replace function public.orchard_apply_library_defaults_to_succession(
  p_succession_id uuid,
  p_crop_library_id uuid,
  p_cultivar_library_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_crop public.orchard_crop_library%rowtype;
  v_cultivar public.orchard_cultivar_library%rowtype;
  v_cycle public.orchard_crop_cycles%rowtype;
  v_succession public.orchard_crop_successions%rowtype;
begin
  if not public.can_access_orchard_succession(p_succession_id) then raise exception 'Not authorized for succession'; end if;
  if not public.can_access_orchard_global() then raise exception 'Not authorized for crop library'; end if;
  select s.* into v_succession from public.orchard_crop_successions s where s.id=p_succession_id;
  if not found then raise exception 'Succession not found'; end if;
  select c.* into v_cycle from public.orchard_crop_cycles c where c.id=v_succession.crop_cycle_id;
  select l.* into v_crop from public.orchard_crop_library l where l.id=p_crop_library_id and l.is_active;
  if not found then raise exception 'Crop library profile not found'; end if;
  if lower(v_cycle.crop_name) <> lower(v_crop.crop_name) then raise exception 'Crop library profile does not match succession crop'; end if;
  if p_cultivar_library_id is not null then
    select v.* into v_cultivar from public.orchard_cultivar_library v where v.id=p_cultivar_library_id and v.crop_library_id=p_crop_library_id and v.is_active;
    if not found then raise exception 'Cultivar profile not found for crop'; end if;
    if v_cycle.variety is not null and lower(v_cycle.variety) <> lower(v_cultivar.variety) then raise exception 'Cultivar profile does not match succession variety'; end if;
  end if;
  update public.orchard_crop_successions s set
    days_to_maturity = coalesce(v_cultivar.days_to_maturity, v_crop.days_to_maturity, s.days_to_maturity),
    plant_spacing_cm = coalesce(v_cultivar.plant_spacing_cm, v_crop.plant_spacing_cm, s.plant_spacing_cm),
    row_spacing_cm = coalesce(v_cultivar.row_spacing_cm, v_crop.row_spacing_cm, s.row_spacing_cm),
    germination_rate_pct = coalesce(v_cultivar.germination_rate_pct, v_crop.germination_rate_pct, s.germination_rate_pct),
    seeds_per_plant = coalesce(v_cultivar.seeds_per_plant, v_crop.seeds_per_plant, s.seeds_per_plant),
    crop_library_id = p_crop_library_id,
    cultivar_library_id = p_cultivar_library_id,
    knowledge_applied_at = now(),
    knowledge_source_snapshot = jsonb_build_object(
      'crop_profile_id', p_crop_library_id,
      'cultivar_profile_id', p_cultivar_library_id,
      'crop_provenance', v_crop.provenance_type,
      'crop_source_name', v_crop.source_name,
      'crop_source_url', v_crop.source_url,
      'cultivar_provenance', case when p_cultivar_library_id is null then null else v_cultivar.provenance_type end,
      'cultivar_source_name', case when p_cultivar_library_id is null then null else v_cultivar.source_name end,
      'cultivar_source_url', case when p_cultivar_library_id is null then null else v_cultivar.source_url end,
      'applied_at', now()
    ),
    updated_at = now()
  where s.id=p_succession_id;
  return jsonb_build_object('succession_id',p_succession_id,'crop_library_id',p_crop_library_id,'cultivar_library_id',p_cultivar_library_id,'applied_at',now());
end;
$$;
revoke all on function public.orchard_apply_library_defaults_to_succession(uuid,uuid,uuid) from public, anon;
grant execute on function public.orchard_apply_library_defaults_to_succession(uuid,uuid,uuid) to authenticated, service_role;

alter table public.orchard_beds add column if not exists planning_order integer;
do $$ begin
  alter table public.orchard_beds add constraint orchard_beds_planning_order_check check (planning_order is null or planning_order > 0);
exception when duplicate_object then null; end $$;
with ranked as (
  select id, row_number() over(partition by plot_id order by coalesce(code,name),name,id)::int as rn from public.orchard_beds
)
update public.orchard_beds b set planning_order=r.rn from ranked r where r.id=b.id and b.planning_order is null;
create unique index if not exists orchard_beds_plot_planning_order_unique on public.orchard_beds(plot_id,planning_order) where planning_order is not null;
create or replace function public.orchard_assign_bed_planning_order() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.planning_order is null then select coalesce(max(b.planning_order),0)+1 into new.planning_order from public.orchard_beds b where b.plot_id=new.plot_id; end if;
  return new;
end;
$$;
drop trigger if exists orchard_beds_assign_planning_order on public.orchard_beds;
create trigger orchard_beds_assign_planning_order before insert on public.orchard_beds for each row execute function public.orchard_assign_bed_planning_order();

create or replace function public.orchard_auto_place_succession(
  p_succession_id uuid,
  p_plot_id uuid,
  p_start_date date,
  p_end_date date,
  p_required_area_sqm numeric default null
) returns jsonb
language plpgsql
set search_path=public,pg_temp
as $$
declare
  v_required numeric; v_target_crop text; v_target_family text; v_bed record;
  v_run uuid[] := array[]::uuid[]; v_best uuid[] := array[]::uuid[];
  v_run_area numeric := 0; v_best_area numeric := 0;
  v_run_penalty integer := 0; v_best_penalty integer := 2147483647; v_best_count integer := 2147483647;
  v_created uuid[] := array[]::uuid[]; v_created_id uuid; v_remaining numeric; v_allocate numeric;
begin
  if not public.can_access_orchard_succession(p_succession_id) then raise exception 'Not authorized for succession'; end if;
  if not public.can_access_orchard_plot(p_plot_id) then raise exception 'Not authorized for plot'; end if;
  if p_end_date < p_start_date then raise exception 'End date must be on or after start date'; end if;
  select coalesce(p_required_area_sqm,s.planned_area_sqm,0), c.crop_name, l.crop_family into v_required,v_target_crop,v_target_family
  from public.orchard_crop_successions s join public.orchard_crop_cycles c on c.id=s.crop_cycle_id
  left join public.orchard_crop_library l on lower(l.crop_name)=lower(c.crop_name) where s.id=p_succession_id;
  if v_required <= 0 then raise exception 'A positive required area is needed'; end if;
  for v_bed in
    select b.id, coalesce(b.area_sqm,coalesce(b.length_m,0)*coalesce(b.width_m,0))::numeric as bed_area, b.planning_order,
      not exists (select 1 from public.orchard_bed_allocations a where a.bed_id=b.id and daterange(a.planned_start_date,a.planned_end_date,'[]') && daterange(p_start_date,p_end_date,'[]')) as is_free,
      case when prev.crop_name is null then 0 when v_target_family is not null and prev.crop_family is not null and lower(prev.crop_family)=lower(v_target_family) then 1 when lower(prev.crop_name)=lower(v_target_crop) then 1 else 0 end as rotation_penalty
    from public.orchard_beds b
    left join lateral (
      select pc.crop_name,pl.crop_family from public.orchard_bed_allocations pa
      join public.orchard_crop_successions ps on ps.id=pa.crop_succession_id
      join public.orchard_crop_cycles pc on pc.id=ps.crop_cycle_id
      left join public.orchard_crop_library pl on lower(pl.crop_name)=lower(pc.crop_name)
      where pa.bed_id=b.id and pa.planned_end_date<p_start_date order by pa.planned_end_date desc,pa.created_at desc limit 1
    ) prev on true
    where b.plot_id=p_plot_id and b.status='active'
    order by b.planning_order,coalesce(b.code,b.name),b.id for update of b
  loop
    if not v_bed.is_free or v_bed.bed_area<=0 then v_run:=array[]::uuid[];v_run_area:=0;v_run_penalty:=0;continue;end if;
    v_run:=array_append(v_run,v_bed.id);v_run_area:=v_run_area+v_bed.bed_area;v_run_penalty:=v_run_penalty+v_bed.rotation_penalty;
    if v_run_area>=v_required then
      if v_run_penalty<v_best_penalty or (v_run_penalty=v_best_penalty and cardinality(v_run)<v_best_count) then v_best:=v_run;v_best_area:=v_run_area;v_best_penalty:=v_run_penalty;v_best_count:=cardinality(v_run);end if;
      v_run:=array[]::uuid[];v_run_area:=0;v_run_penalty:=0;
    end if;
  end loop;
  if cardinality(v_best) is null or cardinality(v_best)=0 then raise exception 'Insufficient contiguous conflict-free bed area in selected plot'; end if;
  v_remaining:=v_required;
  for v_bed in select b.id,coalesce(b.area_sqm,coalesce(b.length_m,0)*coalesce(b.width_m,0))::numeric as bed_area from public.orchard_beds b where b.id=any(v_best) order by b.planning_order loop
    v_allocate:=least(v_bed.bed_area,v_remaining);
    insert into public.orchard_bed_allocations(bed_id,crop_succession_id,planned_start_date,planned_end_date,allocated_area_sqm,notes)
    values(v_bed.id,p_succession_id,p_start_date,p_end_date,v_allocate,'Auto-placed in contiguous planning order') returning id into v_created_id;
    v_created:=array_append(v_created,v_created_id);v_remaining:=v_remaining-v_allocate;exit when v_remaining<=0;
  end loop;
  return jsonb_build_object('allocation_ids',to_jsonb(v_created),'allocated_area_sqm',v_required,'contiguous_beds',cardinality(v_best),'rotation_penalty',v_best_penalty,'available_run_area_sqm',v_best_area);
end;
$$;
revoke all on function public.orchard_auto_place_succession(uuid,uuid,date,date,numeric) from public, anon;
grant execute on function public.orchard_auto_place_succession(uuid,uuid,date,date,numeric) to authenticated, service_role;

create table if not exists public.orchard_sales_commitments (
  id uuid primary key default gen_random_uuid(),
  sales_channel_id uuid not null references public.orchard_sales_channels(id) on delete restrict,
  crop_succession_id uuid references public.orchard_crop_successions(id) on delete set null,
  crop_name text not null,
  variety text,
  delivery_start date not null,
  delivery_end date not null,
  quantity numeric not null check(quantity>0),
  unit text not null,
  price_per_unit numeric check(price_per_unit is null or price_per_unit>=0),
  currency text not null default 'CLP',
  status text not null default 'forecast' check(status in ('forecast','committed','fulfilled','cancelled')),
  customer_reference text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orchard_sales_commitments_date_order check(delivery_end>=delivery_start)
);
create index if not exists orchard_sales_commitments_channel_date_idx on public.orchard_sales_commitments(sales_channel_id,delivery_start,delivery_end);
create index if not exists orchard_sales_commitments_succession_idx on public.orchard_sales_commitments(crop_succession_id);
alter table public.orchard_sales_commitments enable row level security;
drop policy if exists orchard_sales_commitments_scoped on public.orchard_sales_commitments;
create policy orchard_sales_commitments_scoped on public.orchard_sales_commitments for all to authenticated
  using (public.can_access_orchard_global() and (crop_succession_id is null or public.can_access_orchard_succession(crop_succession_id)))
  with check (public.can_access_orchard_global() and (crop_succession_id is null or public.can_access_orchard_succession(crop_succession_id)));

alter table public.orchard_chart_definitions
  add column if not exists chart_type text not null default 'bar',
  add column if not exists date_from date,
  add column if not exists date_to date,
  add column if not exists limit_rows integer not null default 20,
  add column if not exists show_values boolean not null default true;
do $$ begin alter table public.orchard_chart_definitions add constraint orchard_chart_definitions_chart_type_check check(chart_type in ('bar','line')); exception when duplicate_object then null; end $$;
do $$ begin alter table public.orchard_chart_definitions add constraint orchard_chart_definitions_date_order check(date_from is null or date_to is null or date_to>=date_from); exception when duplicate_object then null; end $$;
do $$ begin alter table public.orchard_chart_definitions add constraint orchard_chart_definitions_limit_rows_check check(limit_rows between 5 and 50); exception when duplicate_object then null; end $$;
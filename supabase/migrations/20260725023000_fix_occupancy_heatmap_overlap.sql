-- Keep occupied and blocked bed counts mutually exclusive.
-- Reservation occupancy takes precedence when inconsistent source records overlap.

create or replace function public.get_occupancy_heatmap(
  p_start_date date,
  p_end_date date,
  p_location_id uuid default null
)
returns table(
  day date,
  location_id uuid,
  location_name text,
  total_beds integer,
  occupied_beds integer,
  blocked_beds integer,
  available_beds integer,
  occupancy_pct numeric,
  revenue numeric,
  avg_rate numeric
)
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_max_days integer := 90;
begin
  if p_start_date is null or p_end_date is null then
    raise exception 'Start and end dates are required';
  end if;

  if p_end_date <= p_start_date then
    raise exception 'End date must be after start date';
  end if;

  if (p_end_date - p_start_date) > v_max_days then
    raise exception 'Date range exceeds maximum of % days', v_max_days;
  end if;

  return query
  with date_series as (
    select d::date as day
    from pg_catalog.generate_series(p_start_date, p_end_date - 1, interval '1 day') d
  ),
  bed_universe as (
    select
      b.id as bed_id,
      b.room_id,
      r.location_id,
      l.name as location_name,
      coalesce(r.rate_per_night, 0) as rate_per_night
    from public.beds b
    join public.rooms r on r.id = b.room_id
    join public.locations l on l.id = r.location_id
    where b.is_available = true
      and (p_location_id is null or r.location_id = p_location_id)
  ),
  bed_day_state as (
    select
      ds.day,
      bu.bed_id,
      bu.location_id,
      bu.location_name,
      exists (
        select 1
        from public.reservations res
        where res.bed_id = bu.bed_id
          and res.status not in ('cancelled', 'void', 'no_show')
          and ds.day >= res.check_in
          and ds.day < res.check_out
      ) as is_occupied,
      exists (
        select 1
        from public.room_blocks rb
        where rb.room_id = bu.room_id
          and rb.status = 'active'
          and ds.day >= rb.start_date
          and ds.day < rb.end_date
      ) as is_blocked,
      coalesce((
        select pg_catalog.sum(
          coalesce(res.total_amount, bu.rate_per_night)
          / greatest(res.check_out - res.check_in, 1)
        )
        from public.reservations res
        where res.bed_id = bu.bed_id
          and res.status not in ('cancelled', 'void', 'no_show')
          and ds.day >= res.check_in
          and ds.day < res.check_out
      ), 0) as daily_revenue
    from date_series ds
    cross join bed_universe bu
  ),
  daily as (
    select
      s.day,
      s.location_id,
      pg_catalog.max(s.location_name) as location_name,
      pg_catalog.count(*)::integer as total_beds,
      pg_catalog.count(*) filter (where s.is_occupied)::integer as occupied_beds,
      pg_catalog.count(*) filter (where not s.is_occupied and s.is_blocked)::integer as blocked_beds,
      pg_catalog.sum(s.daily_revenue) as revenue
    from bed_day_state s
    group by s.day, s.location_id
  )
  select
    d.day,
    d.location_id,
    d.location_name,
    d.total_beds,
    d.occupied_beds,
    d.blocked_beds,
    greatest(d.total_beds - d.occupied_beds - d.blocked_beds, 0)::integer as available_beds,
    case
      when d.total_beds > 0 then pg_catalog.round((d.occupied_beds::numeric / d.total_beds) * 100, 1)
      else 0
    end as occupancy_pct,
    pg_catalog.round(d.revenue, 0) as revenue,
    case
      when d.occupied_beds > 0 then pg_catalog.round(d.revenue / d.occupied_beds, 0)
      else 0
    end as avg_rate
  from daily d
  order by d.day, d.location_name;
end;
$function$;

-- Synthetic regression checks for the precedence rule.
do $test$
declare
  v_invalid integer;
begin
  with scenarios(total_beds, occupied_beds, raw_blocked_beds) as (
    values
      (1, 1, 1), -- overlapping reservation and block
      (4, 2, 1), -- ordinary mixed inventory
      (3, 0, 3)  -- fully blocked inventory
  ), normalized as (
    select
      total_beds,
      occupied_beds,
      least(raw_blocked_beds, greatest(total_beds - occupied_beds, 0)) as blocked_beds
    from scenarios
  )
  select pg_catalog.count(*) into v_invalid
  from normalized
  where occupied_beds + blocked_beds > total_beds
     or total_beds - occupied_beds - blocked_beds < 0;

  if v_invalid > 0 then
    raise exception 'Occupancy heatmap overlap regression check failed';
  end if;
end;
$test$;

-- Validate the function against current production records without changing data.
do $validate$
declare
  v_invalid integer;
begin
  select pg_catalog.count(*) into v_invalid
  from public.get_occupancy_heatmap(current_date, current_date + 30, null)
  where occupied_beds < 0
     or blocked_beds < 0
     or available_beds < 0
     or occupied_beds + blocked_beds + available_beds <> total_beds
     or occupancy_pct < 0
     or occupancy_pct > 100;

  if v_invalid > 0 then
    raise exception 'Occupancy heatmap invariant validation failed for current data';
  end if;
end;
$validate$;
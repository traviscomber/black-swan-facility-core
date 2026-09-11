create or replace function public.get_booking_inventory_events(
  p_start_date date,
  p_end_date date,
  p_location_id uuid default null::uuid
)
returns table(
  event_id uuid,
  event_type text,
  bed_id uuid,
  room_id uuid,
  location_id uuid,
  starts_on date,
  ends_on date,
  status text,
  label text,
  guest_name text,
  block_type text,
  source text,
  total_amount numeric
)
language sql
stable
set search_path to 'public'
as $function$
  with inventory as (
    select b.id as bed_id, b.room_id, r.location_id
    from public.beds b
    join public.rooms r on r.id = b.room_id
    where coalesce(b.is_available, true)
      and (p_location_id is null or r.location_id = p_location_id)
  ),
  reservation_events as (
    select
      res.id as event_id,
      'reservation'::text as event_type,
      anchor.bed_id,
      anchor.room_id,
      anchor.location_id,
      res.check_in as starts_on,
      res.check_out as ends_on,
      coalesce(res.status, 'pending') as status,
      res.guest_name as label,
      res.guest_name,
      null::text as block_type,
      res.source,
      res.total_amount
    from public.reservations res
    join lateral (
      select i.bed_id, i.room_id, i.location_id
      from inventory i
      where (res.bed_id is not null and i.bed_id = res.bed_id)
         or (res.bed_id is null and res.room_id is not null and i.room_id = res.room_id)
         or (
           res.bed_id is null
           and res.room_id is null
           and res.booking_type = 'LOCATION'
           and i.location_id = res.location_id
         )
      order by
        case
          when res.bed_id is not null and i.bed_id = res.bed_id then 0
          when res.room_id is not null and i.room_id = res.room_id then 1
          else 2
        end,
        i.bed_id
      limit 1
    ) anchor on true
    where coalesce(res.status, '') not in ('cancelled', 'canceled')
      and res.check_in < p_end_date
      and res.check_out > p_start_date
      and res.check_out > res.check_in
  ),
  block_events as (
    select
      rb.id as event_id,
      'block'::text as event_type,
      i.bed_id,
      i.room_id,
      i.location_id,
      rb.start_date as starts_on,
      rb.end_date as ends_on,
      rb.status,
      rb.reason as label,
      null::text as guest_name,
      rb.block_type,
      null::text as source,
      null::numeric as total_amount
    from inventory i
    join public.room_blocks rb on rb.room_id = i.room_id
    where rb.status = 'active'
      and rb.start_date < p_end_date
      and rb.end_date > p_start_date
  )
  select * from reservation_events
  union all
  select * from block_events
  order by room_id, bed_id, starts_on, event_type;
$function$;

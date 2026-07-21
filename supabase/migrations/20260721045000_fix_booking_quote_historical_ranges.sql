-- Keep booking quote availability resilient to invalid historical date ranges.

begin;

create or replace function public.calculate_booking_quote(
  p_check_in date,
  p_check_out date,
  p_guests integer default 1,
  p_room_id uuid default null,
  p_extras jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_nights integer;
  v_settings public.booking_settings%rowtype;
  v_extras jsonb;
  v_options jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    raise exception 'check_out must be after check_in';
  end if;

  if coalesce(p_guests, 0) < 1 then
    raise exception 'guests must be at least 1';
  end if;

  if jsonb_typeof(coalesce(p_extras, '[]'::jsonb)) <> 'array' then
    raise exception 'extras must be a JSON array';
  end if;

  v_nights := p_check_out - p_check_in;

  select * into v_settings
  from public.booking_settings
  where id = 'default';

  if not found then
    raise exception 'booking settings are not configured';
  end if;

  with requested as (
    select
      (item->>'extra_id')::uuid as extra_id,
      greatest(coalesce((item->>'quantity')::numeric, 1), 0) as requested_quantity
    from jsonb_array_elements(coalesce(p_extras, '[]'::jsonb)) item
    where item ? 'extra_id'
  ), priced as (
    select
      e.id,
      e.name,
      e.unit,
      e.price,
      e.tax_rate,
      case e.unit
        when 'night' then r.requested_quantity * v_nights
        when 'person' then r.requested_quantity * p_guests
        when 'person_night' then r.requested_quantity * p_guests * v_nights
        else r.requested_quantity
      end as quantity
    from requested r
    join public.booking_extras e on e.id = r.extra_id
    where e.is_active
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'extra_id', id,
    'name', name,
    'unit', unit,
    'quantity', quantity,
    'unit_price', price,
    'tax_rate', tax_rate,
    'subtotal', round(quantity * price, 2),
    'tax_amount', round(quantity * price * tax_rate / 100, 2),
    'total', round(quantity * price * (1 + tax_rate / 100), 2)
  ) order by name), '[]'::jsonb)
  into v_extras
  from priced;

  with candidate_rooms as (
    select r.*
    from public.rooms r
    where (p_room_id is null or r.id = p_room_id)
      and coalesce(r.rate_per_night, 0) >= 0
      and coalesce(r.max_guests, r.capacity, 1) >= p_guests
      and lower(coalesce(r.status, 'clean')) not in ('out_of_service', 'out-of-service', 'maintenance', 'blocked')
      and not exists (
        select 1
        from public.reservations res
        where coalesce(res.room_id, (select b.room_id from public.beds b where b.id = res.bed_id)) = r.id
          and lower(coalesce(res.status, 'confirmed')) not in ('cancelled', 'canceled', 'checked_out', 'checked-out', 'void', 'voided')
          and res.check_out > res.check_in
          and res.check_in < p_check_out
          and res.check_out > p_check_in
      )
      and not exists (
        select 1
        from public.room_blocks rb
        where rb.room_id = r.id
          and lower(coalesce(rb.status, 'active')) = 'active'
          and rb.end_date > rb.start_date
          and rb.start_date < p_check_out
          and rb.end_date > p_check_in
      )
  ), nightly as (
    select
      r.id as room_id,
      d::date as stay_date,
      coalesce(rule.rate_multiplier, 1)::numeric as multiplier,
      coalesce(rule.min_stay, 1)::integer as min_stay,
      rule.season_name
    from candidate_rooms r
    cross join lateral generate_series(p_check_in, p_check_out - 1, interval '1 day') d
    left join lateral (
      select pr.rate_multiplier, pr.min_stay, pr.season_name
      from public.pricing_rules pr
      where (pr.room_id = r.id or pr.room_id is null)
        and d::date >= pr.start_date
        and d::date < pr.end_date
      order by (pr.room_id = r.id) desc, pr.start_date desc, pr.created_at desc, pr.id
      limit 1
    ) rule on true
  ), room_totals as (
    select
      r.id,
      r.room_number,
      r.room_type,
      r.location,
      r.location_id,
      r.capacity,
      r.max_guests,
      r.rate_per_night::numeric as base_rate,
      max(n.min_stay) as required_min_stay,
      jsonb_agg(jsonb_build_object(
        'date', n.stay_date,
        'season', n.season_name,
        'multiplier', n.multiplier,
        'rate', round(r.rate_per_night * n.multiplier, 2)
      ) order by n.stay_date) as nightly_rates,
      round(sum(r.rate_per_night * n.multiplier), 2) as lodging_subtotal
    from candidate_rooms r
    join nightly n on n.room_id = r.id
    group by
      r.id,
      r.room_number,
      r.room_type,
      r.location,
      r.location_id,
      r.capacity,
      r.max_guests,
      r.rate_per_night
  ), valid_rooms as (
    select *
    from room_totals
    where required_min_stay <= v_nights
  ), extra_totals as (
    select
      coalesce(sum((item->>'subtotal')::numeric), 0) as subtotal,
      coalesce(sum((item->>'tax_amount')::numeric), 0) as tax
    from jsonb_array_elements(v_extras) item
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'room_id', vr.id,
    'room_number', vr.room_number,
    'room_type', vr.room_type,
    'location', vr.location,
    'location_id', vr.location_id,
    'capacity', coalesce(vr.max_guests, vr.capacity),
    'nights', v_nights,
    'base_rate', vr.base_rate,
    'required_min_stay', vr.required_min_stay,
    'nightly_rates', vr.nightly_rates,
    'lodging_subtotal', vr.lodging_subtotal,
    'lodging_tax_rate', v_settings.lodging_tax_rate,
    'lodging_tax', round(vr.lodging_subtotal * v_settings.lodging_tax_rate / 100, 2),
    'extras', v_extras,
    'extras_subtotal', et.subtotal,
    'extras_tax', et.tax,
    'service_fee', v_settings.service_fee,
    'total', round(
      vr.lodging_subtotal
      + (vr.lodging_subtotal * v_settings.lodging_tax_rate / 100)
      + et.subtotal
      + et.tax
      + v_settings.service_fee,
      2
    )
  ) order by vr.lodging_subtotal, vr.room_number), '[]'::jsonb)
  into v_options
  from valid_rooms vr
  cross join extra_totals et;

  return jsonb_build_object(
    'check_in', p_check_in,
    'check_out', p_check_out,
    'nights', v_nights,
    'guests', p_guests,
    'currency', v_settings.currency,
    'options', v_options
  );
end;
$$;

revoke all on function public.calculate_booking_quote(date, date, integer, uuid, jsonb) from public;
revoke execute on function public.calculate_booking_quote(date, date, integer, uuid, jsonb) from anon;
grant execute on function public.calculate_booking_quote(date, date, integer, uuid, jsonb) to authenticated;
grant execute on function public.calculate_booking_quote(date, date, integer, uuid, jsonb) to service_role;

commit;

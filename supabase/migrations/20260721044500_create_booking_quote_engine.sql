-- Centralized availability and pricing engine for authenticated booking quotes.

begin;

create table if not exists public.booking_settings (
  id text primary key default 'default',
  currency text not null default 'CLP',
  lodging_tax_rate numeric(6,3) not null default 0
    check (lodging_tax_rate >= 0 and lodging_tax_rate <= 100),
  service_fee numeric(12,2) not null default 0
    check (service_fee >= 0),
  updated_at timestamptz not null default now()
);

insert into public.booking_settings (id, currency, lodging_tax_rate, service_fee)
values ('default', 'CLP', 0, 0)
on conflict (id) do nothing;

alter table public.booking_settings enable row level security;

drop policy if exists booking_settings_authenticated_all on public.booking_settings;
create policy booking_settings_authenticated_all
on public.booking_settings
for all
to authenticated
using (true)
with check (true);

revoke all on table public.booking_settings from anon;
grant select, insert, update, delete on table public.booking_settings to authenticated;

alter table public.pricing_rules
  drop constraint if exists pricing_rules_valid_dates,
  drop constraint if exists pricing_rules_positive_multiplier,
  drop constraint if exists pricing_rules_positive_min_stay;

alter table public.pricing_rules
  add constraint pricing_rules_valid_dates check (end_date > start_date),
  add constraint pricing_rules_positive_multiplier check (coalesce(rate_multiplier, 1) > 0),
  add constraint pricing_rules_positive_min_stay check (coalesce(min_stay, 1) >= 1);

create index if not exists pricing_rules_quote_lookup_idx
  on public.pricing_rules (room_id, start_date, end_date);

create index if not exists reservations_quote_availability_idx
  on public.reservations (room_id, check_in, check_out, status);

create index if not exists room_blocks_quote_availability_idx
  on public.room_blocks (room_id, start_date, end_date, status);

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
          and daterange(res.check_in, res.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
      )
      and not exists (
        select 1
        from public.room_blocks rb
        where rb.room_id = r.id
          and lower(coalesce(rb.status, 'active')) = 'active'
          and daterange(rb.start_date, rb.end_date, '[)') && daterange(p_check_in, p_check_out, '[)')
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
    group by r.id
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

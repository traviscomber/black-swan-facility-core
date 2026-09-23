begin;

alter table public.booking_settings
  add column if not exists pricing_policy jsonb not null default '{
    "weekend":{"enabled":false,"days":[6,7],"multiplier":1},
    "occupancy":{"enabled":false,"threshold_pct":80,"multiplier":1},
    "short_stay":{"enabled":false,"max_nights":2,"multiplier":1},
    "long_stay":{"enabled":false,"min_nights":7,"multiplier":1},
    "children":{"enabled":false,"bands":[
      {"min_age":0,"max_age":3,"price_per_night":0},
      {"min_age":4,"max_age":10,"price_per_night":0}
    ]}
  }'::jsonb,
  add column if not exists reservation_widget jsonb not null default '{}'::jsonb;

update public.booking_settings s
set reservation_widget = coalesce((
  select bir.payload
  from public.booking_import_records bir
  where bir.source_system='bedbooking'
    and bir.entity_type='reservation_system_snapshot'
  order by bir.observed_at desc
  limit 1
), s.reservation_widget)
where s.id='default'
  and s.reservation_widget='{}'::jsonb;

alter table public.booking_extras
  add column if not exists is_mandatory boolean not null default false,
  add column if not exists room_scope text not null default 'all_rooms',
  add column if not exists calculation_mode text not null default 'once';

update public.booking_extras
set calculation_mode = case unit
  when 'night' then 'per_night'
  when 'person' then 'per_person'
  when 'person_night' then 'per_person_night'
  else 'once'
end
where calculation_mode='once';

alter table public.booking_extras
  drop constraint if exists booking_extras_room_scope_check,
  add constraint booking_extras_room_scope_check
    check (room_scope in ('all_rooms','selected_rooms'));

alter table public.booking_extras
  drop constraint if exists booking_extras_calculation_mode_check,
  add constraint booking_extras_calculation_mode_check
    check (calculation_mode in ('once','per_night','per_person','per_person_night'));

CREATE OR REPLACE FUNCTION public.calculate_booking_quote_v2(p_check_in date, p_check_out date, p_adults integer DEFAULT 1, p_children_0_3 integer DEFAULT 0, p_children_4_10 integer DEFAULT 0, p_room_id uuid DEFAULT NULL::uuid, p_extras jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_nights integer;
  v_total_guests integer;
  v_settings public.booking_settings%rowtype;
  v_policy jsonb;
  v_extras jsonb;
  v_options jsonb;
  v_short_multiplier numeric := 1;
  v_long_multiplier numeric := 1;
  v_child_0_3 numeric := 0;
  v_child_4_10 numeric := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    raise exception 'check_out must be after check_in';
  end if;

  if coalesce(p_adults,0) < 1
     or coalesce(p_children_0_3,0) < 0
     or coalesce(p_children_4_10,0) < 0 then
    raise exception 'guest counts are invalid';
  end if;

  if jsonb_typeof(coalesce(p_extras,'[]'::jsonb)) <> 'array' then
    raise exception 'extras must be a JSON array';
  end if;

  v_nights := p_check_out - p_check_in;
  v_total_guests := p_adults + p_children_0_3 + p_children_4_10;

  select * into v_settings
  from public.booking_settings
  where id='default';

  if not found then
    raise exception 'booking settings are not configured';
  end if;

  v_policy := coalesce(v_settings.pricing_policy,'{}'::jsonb);

  if coalesce((v_policy#>>'{short_stay,enabled}')::boolean,false)
     and v_nights <= coalesce((v_policy#>>'{short_stay,max_nights}')::integer,0) then
    v_short_multiplier := greatest(coalesce((v_policy#>>'{short_stay,multiplier}')::numeric,1),0);
  end if;

  if coalesce((v_policy#>>'{long_stay,enabled}')::boolean,false)
     and v_nights >= coalesce((v_policy#>>'{long_stay,min_nights}')::integer,999999) then
    v_long_multiplier := greatest(coalesce((v_policy#>>'{long_stay,multiplier}')::numeric,1),0);
  end if;

  if coalesce((v_policy#>>'{children,enabled}')::boolean,false) then
    v_child_0_3 := greatest(coalesce((v_policy#>>'{children,bands,0,price_per_night}')::numeric,0),0);
    v_child_4_10 := greatest(coalesce((v_policy#>>'{children,bands,1,price_per_night}')::numeric,0),0);
  end if;

  with requested as (
    select
      (item->>'extra_id')::uuid as extra_id,
      greatest(coalesce((item->>'quantity')::numeric,1),0) as requested_quantity
    from jsonb_array_elements(coalesce(p_extras,'[]'::jsonb)) item
    where item ? 'extra_id'
  ),
  selected_extras as (
    select e.*, coalesce(r.requested_quantity,1) as requested_quantity
    from public.booking_extras e
    left join requested r on r.extra_id=e.id
    where e.is_active
      and (e.is_mandatory or r.extra_id is not null)
  ),
  priced_extras as (
    select
      e.id,e.name,e.unit,e.price,e.tax_rate,
      case coalesce(e.calculation_mode,'once')
        when 'per_night' then e.requested_quantity * v_nights
        when 'per_person' then e.requested_quantity * v_total_guests
        when 'per_person_night' then e.requested_quantity * v_total_guests * v_nights
        else e.requested_quantity
      end as quantity
    from selected_extras e
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'extra_id',id,
    'name',name,
    'unit',unit,
    'quantity',quantity,
    'unit_price',price,
    'tax_rate',tax_rate,
    'subtotal',round(quantity*price,2),
    'tax_amount',round(quantity*price*tax_rate/100,2),
    'total',round(quantity*price*(1+tax_rate/100),2)
  ) order by name),'[]'::jsonb)
  into v_extras
  from priced_extras;

  with candidate_rooms as (
    select r.*
    from public.rooms r
    where (p_room_id is null or r.id=p_room_id)
      and coalesce(r.rate_per_night,0) >= 0
      and coalesce(r.max_guests,r.capacity,1) >= v_total_guests
      and lower(coalesce(r.status,'clean')) not in ('out_of_service','out-of-service','maintenance','blocked')
      and not exists (
        select 1
        from public.reservations res
        left join public.beds b on b.id=res.bed_id
        where coalesce(res.room_id,b.room_id)=r.id
          and lower(coalesce(res.status,'confirmed')) not in ('cancelled','canceled','checked_out','checked-out','void','voided')
          and daterange(res.check_in,res.check_out,'[)') && daterange(p_check_in,p_check_out,'[)')
      )
      and not exists (
        select 1
        from public.room_blocks rb
        where rb.room_id=r.id
          and lower(coalesce(rb.status,'active'))='active'
          and daterange(rb.start_date,rb.end_date,'[)') && daterange(p_check_in,p_check_out,'[)')
      )
  ),
  inventory as (
    select count(*)::numeric as total_rooms
    from public.rooms r
    where lower(coalesce(r.status,'clean')) not in ('out_of_service','out-of-service','maintenance','blocked')
  ),
  days as (
    select d::date as stay_date
    from generate_series(p_check_in,p_check_out-1,interval '1 day') d
  ),
  occupancy as (
    select
      d.stay_date,
      case when i.total_rooms > 0 then
        100 * (
          select count(distinct coalesce(res.room_id,b.room_id))::numeric
          from public.reservations res
          left join public.beds b on b.id=res.bed_id
          where lower(coalesce(res.status,'confirmed')) not in ('cancelled','canceled','checked_out','checked-out','void','voided')
            and d.stay_date >= res.check_in
            and d.stay_date < res.check_out
        ) / i.total_rooms
      else 0 end as occupancy_pct
    from days d
    cross join inventory i
  ),
  nightly as (
    select
      r.id as room_id,
      d.stay_date,
      coalesce(rule.rate_multiplier,1)::numeric as season_multiplier,
      coalesce(rule.min_stay,1)::integer as min_stay,
      rule.season_name,
      case
        when coalesce((v_policy#>>'{weekend,enabled}')::boolean,false)
          and extract(isodow from d.stay_date)::int = any (
            array(select jsonb_array_elements_text(coalesce(v_policy#>'{weekend,days}','[6,7]'::jsonb))::int)
          )
        then greatest(coalesce((v_policy#>>'{weekend,multiplier}')::numeric,1),0)
        else 1
      end as weekend_multiplier,
      case
        when coalesce((v_policy#>>'{occupancy,enabled}')::boolean,false)
          and o.occupancy_pct >= coalesce((v_policy#>>'{occupancy,threshold_pct}')::numeric,100)
        then greatest(coalesce((v_policy#>>'{occupancy,multiplier}')::numeric,1),0)
        else 1
      end as occupancy_multiplier
    from candidate_rooms r
    cross join days d
    join occupancy o on o.stay_date=d.stay_date
    left join lateral (
      select pr.rate_multiplier,pr.min_stay,pr.season_name
      from public.pricing_rules pr
      where (pr.room_id=r.id or pr.room_id is null)
        and d.stay_date >= pr.start_date
        and d.stay_date < pr.end_date
      order by (pr.room_id=r.id) desc,pr.start_date desc,pr.created_at desc,pr.id
      limit 1
    ) rule on true
  ),
  room_totals as (
    select
      r.id,r.room_number,r.room_type,r.location,r.location_id,r.capacity,r.max_guests,
      r.rate_per_night::numeric as base_rate,
      max(n.min_stay) as required_min_stay,
      jsonb_agg(jsonb_build_object(
        'date',n.stay_date,
        'season',n.season_name,
        'season_multiplier',n.season_multiplier,
        'weekend_multiplier',n.weekend_multiplier,
        'occupancy_multiplier',n.occupancy_multiplier,
        'rate',round(r.rate_per_night*n.season_multiplier*n.weekend_multiplier*n.occupancy_multiplier*v_short_multiplier*v_long_multiplier,2)
      ) order by n.stay_date) as nightly_rates,
      round(sum(r.rate_per_night*n.season_multiplier*n.weekend_multiplier*n.occupancy_multiplier*v_short_multiplier*v_long_multiplier),2) as lodging_subtotal
    from candidate_rooms r
    join nightly n on n.room_id=r.id
    group by r.id,r.room_number,r.room_type,r.location,r.location_id,r.capacity,r.max_guests,r.rate_per_night
  ),
  valid_rooms as (
    select * from room_totals where required_min_stay <= v_nights
  ),
  extra_totals as (
    select
      coalesce(sum((item->>'subtotal')::numeric),0) as subtotal,
      coalesce(sum((item->>'tax_amount')::numeric),0) as tax
    from jsonb_array_elements(v_extras) item
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'room_id',vr.id,
    'room_number',vr.room_number,
    'room_type',vr.room_type,
    'location',vr.location,
    'location_id',vr.location_id,
    'capacity',coalesce(vr.max_guests,vr.capacity),
    'nights',v_nights,
    'base_rate',vr.base_rate,
    'required_min_stay',vr.required_min_stay,
    'nightly_rates',vr.nightly_rates,
    'lodging_subtotal',vr.lodging_subtotal,
    'child_supplement',round(v_nights*(p_children_0_3*v_child_0_3+p_children_4_10*v_child_4_10),2),
    'lodging_tax_rate',v_settings.lodging_tax_rate,
    'lodging_tax',round((vr.lodging_subtotal + v_nights*(p_children_0_3*v_child_0_3+p_children_4_10*v_child_4_10))*v_settings.lodging_tax_rate/100,2),
    'extras',v_extras,
    'extras_subtotal',et.subtotal,
    'extras_tax',et.tax,
    'service_fee',v_settings.service_fee,
    'total',round(
      vr.lodging_subtotal
      + v_nights*(p_children_0_3*v_child_0_3+p_children_4_10*v_child_4_10)
      + ((vr.lodging_subtotal + v_nights*(p_children_0_3*v_child_0_3+p_children_4_10*v_child_4_10))*v_settings.lodging_tax_rate/100)
      + et.subtotal + et.tax + v_settings.service_fee
    ,2)
  ) order by vr.lodging_subtotal,vr.room_number),'[]'::jsonb)
  into v_options
  from valid_rooms vr
  cross join extra_totals et;

  return jsonb_build_object(
    'check_in',p_check_in,
    'check_out',p_check_out,
    'nights',v_nights,
    'adults',p_adults,
    'children_0_3',p_children_0_3,
    'children_4_10',p_children_4_10,
    'guests',v_total_guests,
    'currency',v_settings.currency,
    'options',v_options
  );
end;
$function$
;

revoke all on function public.calculate_booking_quote_v2(date,date,integer,integer,integer,uuid,jsonb) from public;
revoke execute on function public.calculate_booking_quote_v2(date,date,integer,integer,integer,uuid,jsonb) from anon;
grant execute on function public.calculate_booking_quote_v2(date,date,integer,integer,integer,uuid,jsonb) to authenticated;
grant execute on function public.calculate_booking_quote_v2(date,date,integer,integer,integer,uuid,jsonb) to service_role;

commit;

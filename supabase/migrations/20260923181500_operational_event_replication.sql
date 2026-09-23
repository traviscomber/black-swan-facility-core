begin;

alter table public.operational_events
  add column if not exists source_event_id uuid
  references public.operational_events(id) on delete set null;

create index if not exists operational_events_source_event_id_idx
  on public.operational_events(source_event_id);

drop policy if exists operational_events_insert_authorized on public.operational_events;
create policy operational_events_insert_authorized
on public.operational_events
for insert
to authenticated
with check (
  can_app_action('finance.adjust')
  or can_app_action('procurement.operate')
);

drop policy if exists operational_event_budget_items_insert_authorized on public.operational_event_budget_items;
create policy operational_event_budget_items_insert_authorized
on public.operational_event_budget_items
for insert
to authenticated
with check (
  can_app_action('finance.adjust')
  or can_app_action('procurement.operate')
);

drop policy if exists operational_event_participants_insert_authorized on public.operational_event_participants;
create policy operational_event_participants_insert_authorized
on public.operational_event_participants
for insert
to authenticated
with check (
  can_app_action('guest.sensitive_data')
  and (
    location_id is null
    or can_access_operational_scope('booking', location_id)
  )
);

create or replace function public.replicate_operational_event(
  p_source_event_id uuid,
  p_name text,
  p_start_date date,
  p_include_participants boolean default false,
  p_include_budget boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_source public.operational_events%rowtype;
  v_new_id uuid;
  v_new_code text;
  v_slug text;
  v_delta integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (can_app_action('finance.adjust') or can_app_action('procurement.operate')) then
    raise exception 'Not authorized to replicate events';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'Event name is required';
  end if;

  if p_start_date is null then
    raise exception 'Start date is required';
  end if;

  select *
  into v_source
  from public.operational_events
  where id = p_source_event_id;

  if not found then
    raise exception 'Source event not found or not accessible';
  end if;

  if p_include_participants and not can_app_action('guest.sensitive_data') then
    raise exception 'Not authorized to replicate participant data';
  end if;

  v_delta := p_start_date - v_source.start_date;
  v_slug := upper(trim(both '-' from regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g')));
  if v_slug = '' then
    v_slug := 'EVENT';
  end if;

  v_new_code := 'BSFC-EVENT-' || to_char(p_start_date, 'YYYY-MM-DD') || '-' || left(v_slug, 48);

  if exists(select 1 from public.operational_events where event_code = v_new_code) then
    v_new_code := v_new_code || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);
  end if;

  insert into public.operational_events(
    event_code,name,start_date,end_date,location_name,status,participant_count,person_days,
    estimated_total_clp,actual_total_clp,source_filename,source_sha256,source_version,
    source_status,notes,source_event_id
  )
  values(
    v_new_code,btrim(p_name),p_start_date,v_source.end_date + v_delta,v_source.location_name,
    'planning',
    case when p_include_participants then v_source.participant_count else 0 end,
    case when p_include_participants then v_source.person_days else 0 end,
    case when p_include_budget then v_source.estimated_total_clp else 0 end,
    null,null,null,'replicated','replicated_baseline',
    concat(
      'Replicated from ', v_source.name, ' (', v_source.event_code, '). ',
      'Estimated quantities and unit prices are baseline values; actuals reset. ',
      coalesce(v_source.notes, '')
    ),
    v_source.id
  )
  returning id into v_new_id;

  if p_include_participants then
    insert into public.operational_event_participants(
      event_id,participant_name,accommodation_name,room_name,location_id,room_id,
      arrival_date,arrival_time,arrival_transport,departure_date,departure_time,
      departure_transport,planned_stay_days,estimated_person_total_clp,
      confirmation_status,notes,source_reference
    )
    select
      v_new_id,p.participant_name,p.accommodation_name,p.room_name,p.location_id,p.room_id,
      p.arrival_date + v_delta,p.arrival_time,p.arrival_transport,
      p.departure_date + v_delta,p.departure_time,p.departure_transport,
      p.planned_stay_days,p.estimated_person_total_clp,'pending_confirmation',
      concat('Replicated baseline — reconfirm attendance and lodging. ', coalesce(p.notes, '')),
      'replicated:' || p.id::text
    from public.operational_event_participants p
    where p.event_id = v_source.id;
  end if;

  if p_include_budget then
    insert into public.operational_event_budget_items(
      event_id,category,item_name,unit,quantity,estimated_unit_price_clp,
      estimated_subtotal_clp,actual_subtotal_clp,cost_confidence,procurement_status,
      supplier_id,responsible_user_id,source_sheet,source_row
    )
    select
      v_new_id,b.category,b.item_name,b.unit,b.quantity,b.estimated_unit_price_clp,
      b.estimated_subtotal_clp,null,'baseline','pending',
      b.supplier_id,b.responsible_user_id,b.source_sheet,b.source_row
    from public.operational_event_budget_items b
    where b.event_id = v_source.id;
  end if;

  return jsonb_build_object(
    'id', v_new_id,
    'event_code', v_new_code,
    'source_event_id', v_source.id,
    'participants_copied', p_include_participants,
    'budget_copied', p_include_budget
  );
end;
$$;

revoke all on function public.replicate_operational_event(uuid,text,date,boolean,boolean) from public;
revoke execute on function public.replicate_operational_event(uuid,text,date,boolean,boolean) from anon;
grant execute on function public.replicate_operational_event(uuid,text,date,boolean,boolean) to authenticated;
grant execute on function public.replicate_operational_event(uuid,text,date,boolean,boolean) to service_role;

update public.operational_event_budget_items b
set responsible_user_id = e.id,
    updated_at = now()
from public.employees e
where b.event_id = (
  select id from public.operational_events
  where event_code='BSFC-EVENT-2026-09-LA-SWAN-FONDA'
)
  and b.item_name='Cocina — Carlos Bustamante'
  and e.name='Carlos Bustamante';

commit;

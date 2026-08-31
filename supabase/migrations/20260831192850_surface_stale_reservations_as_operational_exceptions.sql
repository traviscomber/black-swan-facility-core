create or replace view public.reservation_operational_exceptions
with (security_invoker = true)
as
select
  r.id as reservation_id,
  'housekeeping'::text as domain,
  h.id as source_id,
  coalesce(h.task_type, 'Housekeeping'::text) as title,
  h.status,
  coalesce(h.priority, 'medium'::text) as priority,
  coalesce(h.due_at, h.scheduled_for, h.service_date::timestamp with time zone) as due_at,
  case
    when h.status <> all (array['completed'::text, 'cancelled'::text])
      and coalesce(h.due_at, h.scheduled_for, h.service_date::timestamp with time zone) < now()
      then 'overdue'::text
    when h.status <> all (array['completed'::text, 'cancelled'::text]) then 'open'::text
    else 'resolved'::text
  end as exception_state,
  case
    when h.task_type = any (array['pre_arrival_preparation'::text, 'pre_arrival_inspection'::text]) then true
    else false
  end as blocks_check_in,
  false as blocks_check_out,
  h.room_id,
  null::text as detail
from public.reservations r
join public.housekeeping_tasks h on h.reservation_id = r.id
where h.status <> all (array['completed'::text, 'cancelled'::text])

union all

select
  r.id as reservation_id,
  'hospitality'::text as domain,
  hr.id as source_id,
  coalesce(hr.request_type, 'Hospitality'::text) as title,
  hr.status,
  coalesce(hr.priority, 'medium'::text) as priority,
  hr.due_at,
  case
    when hr.status <> all (array['completed'::text, 'closed'::text, 'cancelled'::text])
      and hr.due_at < now() then 'overdue'::text
    else 'open'::text
  end as exception_state,
  false as blocks_check_in,
  false as blocks_check_out,
  hr.room_id,
  hr.description as detail
from public.reservations r
join public.hospitality_requests hr on hr.reservation_id = r.id
where hr.status <> all (array['completed'::text, 'closed'::text, 'cancelled'::text])

union all

select
  r.id as reservation_id,
  'maintenance'::text as domain,
  mt.id as source_id,
  coalesce(mt.title, 'Mantenimiento'::text) as title,
  mt.status,
  case when mt.blocks_room then 'critical'::text else 'medium'::text end as priority,
  mt.scheduled_start as due_at,
  case
    when mt.status <> all (array['completed'::text, 'cancelled'::text])
      and mt.scheduled_end is not null
      and mt.scheduled_end < now() then 'overdue'::text
    else 'open'::text
  end as exception_state,
  coalesce(mt.blocks_room, false) as blocks_check_in,
  false as blocks_check_out,
  mt.room_id,
  mt.description as detail
from public.reservations r
join public.maintenance_tasks mt
  on mt.reservation_id = r.id
  or (mt.room_id = r.room_id and mt.blocks_room = true)
where mt.status <> all (array['completed'::text, 'cancelled'::text])

union all

select
  r.id as reservation_id,
  'issue'::text as domain,
  i.id as source_id,
  coalesce(i.title, 'Incidencia'::text) as title,
  i.status,
  coalesce(i.priority, 'medium'::text) as priority,
  null::timestamp with time zone as due_at,
  'open'::text as exception_state,
  case
    when coalesce(i.priority, 'medium'::text) = any (array['high'::text, 'critical'::text, 'urgent'::text]) then true
    else false
  end as blocks_check_in,
  false as blocks_check_out,
  r.room_id,
  i.description as detail
from public.reservations r
join public.issues i
  on i.related_item_type = 'reservation'::text
 and i.related_item_id = r.id
where i.status <> all (array['resolved'::text, 'closed'::text, 'cancelled'::text])

union all

select
  r.id as reservation_id,
  'reservation'::text as domain,
  r.id as source_id,
  'Reserva vencida sin cierre operativo'::text as title,
  r.status,
  case
    when r.status = any (array['checked_in'::text, 'checked-in'::text, 'waiting_for_room'::text]) then 'critical'::text
    when r.status = any (array['confirmed'::text, 'ready_for_checkin'::text]) then 'high'::text
    else 'medium'::text
  end as priority,
  (r.check_out::timestamp at time zone 'America/Santiago') as due_at,
  'overdue'::text as exception_state,
  false as blocks_check_in,
  true as blocks_check_out,
  r.room_id,
  concat('check-out ', r.check_out::text, ' · estado ', r.status) as detail
from public.reservations r
where r.check_out < (now() at time zone 'America/Santiago')::date
  and r.status = any (array[
    'pending'::text,
    'confirmed'::text,
    'waiting_for_room'::text,
    'ready_for_checkin'::text,
    'checked_in'::text,
    'checked-in'::text
  ]);

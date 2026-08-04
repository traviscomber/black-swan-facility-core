alter table public.rooms
  add column if not exists operational_status text not null default 'ready';

alter table public.reservations
  add column if not exists arrival_status text not null default 'not_arrived',
  add column if not exists arrived_at timestamptz,
  add column if not exists queued_at timestamptz,
  add column if not exists room_ready_notified_at timestamptz;

alter table public.rooms drop constraint if exists rooms_operational_status_check;
alter table public.rooms add constraint rooms_operational_status_check
  check (operational_status in ('ready','dirty','cleaning','clean_pending_inspection','inspected','occupied','out_of_service','out_of_inventory'));

alter table public.reservations drop constraint if exists reservations_arrival_status_check;
alter table public.reservations add constraint reservations_arrival_status_check
  check (arrival_status in ('not_arrived','waiting_for_room','ready_for_checkin','checked_in','departed','no_show'));

update public.rooms
set operational_status = case when status = 'occupied' then 'occupied' else 'ready' end
where operational_status = 'ready';

create or replace function public.check_in_or_queue(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation public.reservations%rowtype;
  v_room public.rooms%rowtype;
  v_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'procurement_role', '');
begin
  if auth.role() <> 'service_role' and v_role not in ('admin','approver') then
    raise exception 'No autorizado para registrar llegadas';
  end if;

  select * into v_reservation from public.reservations where id = p_reservation_id for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if v_reservation.room_id is null then raise exception 'La reserva no tiene habitación asignada'; end if;

  select * into v_room from public.rooms where id = v_reservation.room_id for update;
  if not found then raise exception 'Habitación no encontrada'; end if;

  if v_room.operational_status in ('ready','inspected') then
    update public.reservations
      set status = 'checked_in', arrival_status = 'checked_in', arrived_at = coalesce(arrived_at, now()), queued_at = null
      where id = p_reservation_id;
    update public.rooms
      set status = 'occupied', operational_status = 'occupied'
      where id = v_room.id;
    return jsonb_build_object('result','checked_in','room_status','occupied');
  end if;

  update public.reservations
    set arrival_status = 'waiting_for_room', arrived_at = coalesce(arrived_at, now()), queued_at = coalesce(queued_at, now())
    where id = p_reservation_id;
  return jsonb_build_object('result','waiting_for_room','room_status',v_room.operational_status);
end;
$$;

revoke all on function public.check_in_or_queue(uuid) from public, anon;
grant execute on function public.check_in_or_queue(uuid) to authenticated, service_role;

create or replace function public.set_room_operational_status(p_room_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'procurement_role', '');
  v_waiting integer;
begin
  if auth.role() <> 'service_role' and v_role not in ('admin','approver') then
    raise exception 'No autorizado para actualizar habitación';
  end if;
  if p_status not in ('ready','dirty','cleaning','clean_pending_inspection','inspected','occupied','out_of_service','out_of_inventory') then
    raise exception 'Estado operativo inválido';
  end if;

  update public.rooms set operational_status = p_status where id = p_room_id;
  if not found then raise exception 'Habitación no encontrada'; end if;

  if p_status in ('ready','inspected') then
    update public.reservations
      set arrival_status = 'ready_for_checkin', room_ready_notified_at = coalesce(room_ready_notified_at, now())
      where room_id = p_room_id and arrival_status = 'waiting_for_room';
    get diagnostics v_waiting = row_count;
  else
    v_waiting := 0;
  end if;

  return jsonb_build_object('room_id',p_room_id,'operational_status',p_status,'waiting_reservations_ready',v_waiting);
end;
$$;

revoke all on function public.set_room_operational_status(uuid,text) from public, anon;
grant execute on function public.set_room_operational_status(uuid,text) to authenticated, service_role;

create or replace function public.sync_room_status_from_housekeeping()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.room_id is null then return new; end if;
  if new.status = 'in_progress' and old.status is distinct from new.status then
    update public.rooms set operational_status = 'cleaning' where id = new.room_id and operational_status not in ('out_of_service','out_of_inventory');
  elsif new.status = 'completed' and old.status is distinct from new.status then
    if new.task_type = 'inspection' then
      update public.rooms set operational_status = 'ready' where id = new.room_id and operational_status not in ('out_of_service','out_of_inventory');
      update public.reservations set arrival_status = 'ready_for_checkin', room_ready_notified_at = coalesce(room_ready_notified_at, now()) where room_id = new.room_id and arrival_status = 'waiting_for_room';
    elsif new.task_type in ('turnover','cleaning','deep_cleaning','room_preparation') then
      update public.rooms set operational_status = 'clean_pending_inspection' where id = new.room_id and operational_status not in ('out_of_service','out_of_inventory');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists housekeeping_sync_room_operational_status on public.housekeeping_tasks;
create trigger housekeeping_sync_room_operational_status
after update of status on public.housekeeping_tasks
for each row execute function public.sync_room_status_from_housekeeping();

create or replace function public.mark_room_dirty_on_checkout()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status in ('checked_out','checked-out') and old.status is distinct from new.status and new.room_id is not null then
    update public.rooms set status = 'available', operational_status = 'dirty' where id = new.room_id;
    update public.reservations set arrival_status = 'departed' where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_mark_room_dirty_on_checkout on public.reservations;
create trigger reservations_mark_room_dirty_on_checkout
after update of status on public.reservations
for each row execute function public.mark_room_dirty_on_checkout();

drop trigger if exists on_reservation_checkout_create_cleaning on public.reservations;

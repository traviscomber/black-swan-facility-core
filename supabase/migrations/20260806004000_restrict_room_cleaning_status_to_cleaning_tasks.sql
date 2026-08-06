create or replace function public.sync_room_status_from_housekeeping()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.room_id is null then return new; end if;

  if new.status = 'in_progress'
     and old.status is distinct from new.status
     and new.task_type in ('turnover','cleaning','deep_cleaning','room_preparation','pre_arrival_preparation','post_checkout_cleaning') then
    update public.rooms
       set operational_status = 'cleaning'
     where id = new.room_id
       and operational_status not in ('out_of_service','out_of_inventory');

  elsif new.status = 'completed' and old.status is distinct from new.status then
    if new.task_type in ('inspection','pre_arrival_inspection','room_release') then
      update public.rooms
         set operational_status = 'ready'
       where id = new.room_id
         and operational_status not in ('out_of_service','out_of_inventory');

      update public.reservations
         set arrival_status = 'ready_for_checkin',
             room_ready_notified_at = coalesce(room_ready_notified_at, now())
       where room_id = new.room_id
         and arrival_status = 'waiting_for_room';

    elsif new.task_type in ('turnover','cleaning','deep_cleaning','room_preparation','pre_arrival_preparation','post_checkout_cleaning') then
      update public.rooms
         set operational_status = 'clean_pending_inspection'
       where id = new.room_id
         and operational_status not in ('out_of_service','out_of_inventory');
    end if;
  end if;

  return new;
end;
$function$;

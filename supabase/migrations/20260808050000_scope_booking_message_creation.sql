-- Keep communication history scoped to the reservation and prevent signed-in
-- users from fabricating inbound/delivery events. Delivery state transitions are
-- owned by update_booking_message_status.

create or replace function public.record_booking_message(
  p_reservation_id uuid,
  p_channel text,
  p_direction text,
  p_recipient text,
  p_subject text,
  p_text text,
  p_template_key text default null,
  p_status text default 'draft'
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
  v_role text;
  v_location_id uuid;
  v_service_role boolean := coalesce(auth.role(), '') = 'service_role';
begin
  if auth.uid() is null and not v_service_role then
    raise exception 'Authentication required';
  end if;

  v_role := coalesce(auth.jwt()->'app_metadata'->>'procurement_role', 'operator');
  if not v_service_role and v_role not in ('admin','approver','operator') then
    raise exception 'Insufficient permissions';
  end if;
  if p_channel not in ('whatsapp','email','sms','internal') then
    raise exception 'Invalid channel';
  end if;
  if p_direction not in ('outbound','inbound','internal') then
    raise exception 'Invalid direction';
  end if;
  if p_status not in ('draft','queued','sent','delivered','failed','received','cancelled') then
    raise exception 'Invalid message status';
  end if;

  if not v_service_role then
    if p_direction = 'inbound' then
      raise exception 'Inbound messages can only be recorded by the messaging service';
    end if;
    if p_status not in ('draft','queued') then
      raise exception 'Delivery state must be updated through the controlled messaging workflow';
    end if;
  end if;

  if p_reservation_id is not null then
    select location_id into v_location_id
    from public.reservations
    where id = p_reservation_id;
    if not found then
      raise exception 'Reservation not found';
    end if;
    if not v_service_role and not public.can_access_operational_scope('booking', v_location_id) then
      raise exception 'Reservation outside operational scope';
    end if;
  end if;

  insert into public.messages(
    phone,direction,text,reservation_id,channel,status,recipient,subject,template_key,created_by
  ) values (
    coalesce(p_recipient,'internal'),p_direction,p_text,p_reservation_id,p_channel,p_status,
    p_recipient,p_subject,p_template_key,auth.uid()
  ) returning id into v_id;

  if p_reservation_id is not null then
    insert into public.booking_events(
      reservation_id,event_type,title,description,source,related_entity_type,related_entity_id,created_by,metadata
    ) values (
      p_reservation_id,'message_'||p_status,'Mensaje '||p_status,p_text,'messaging','message',v_id,
      auth.uid(),jsonb_build_object('channel',p_channel,'recipient',p_recipient,'template_key',p_template_key)
    );
  end if;

  return v_id;
end;
$function$;
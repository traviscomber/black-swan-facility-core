-- Automatically create Education follow-up work and consent-aware post-event communications.

create or replace function public.handle_event_portal_closeout()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_collection_id uuid;
  v_registration record;
begin
  if new.status <> 'closed' or old.status = 'closed' then return new; end if;

  select id into v_collection_id from public.education_collections where event_id=new.event_id limit 1;
  if v_collection_id is not null then
    insert into public.event_education_followup_tasks(event_id,education_collection_id,task_type,title,due_at)
    values
      (new.event_id,v_collection_id,'collect_source_material','Collect event source material',now()+interval '1 day'),
      (new.event_id,v_collection_id,'prepare_transcript','Prepare event transcript',now()+interval '3 days'),
      (new.event_id,v_collection_id,'prepare_summary','Prepare educational summary',now()+interval '5 days'),
      (new.event_id,v_collection_id,'editorial_review','Editorial review',now()+interval '7 days'),
      (new.event_id,v_collection_id,'publication_review','Foundation publication review',now()+interval '10 days')
    on conflict(event_id,task_type) do nothing;
  end if;

  for v_registration in
    select id,email,phone,full_name,followup_status
    from public.event_portal_registrations
    where portal_id=new.id
      and consent_marketing=true
      and registration_status in ('completed','checked_in')
  loop
    if not exists (
      select 1 from public.event_notification_outbox n
      where n.registration_id=v_registration.id
        and n.notification_type='post_event_followup'
        and n.status <> 'cancelled'
    ) then
      insert into public.event_notification_outbox(
        event_id,portal_id,registration_id,notification_type,recipient_email,recipient_phone,payload,available_at
      ) values (
        new.event_id,new.id,v_registration.id,'post_event_followup',v_registration.email,v_registration.phone,
        jsonb_build_object('full_name',v_registration.full_name,'followup_status',v_registration.followup_status),
        now()+interval '12 hours'
      );
    end if;
  end loop;

  return new;
end;
$function$;

drop trigger if exists event_portal_closeout_trigger on public.event_guest_portals;
create trigger event_portal_closeout_trigger
after update of status on public.event_guest_portals
for each row execute function public.handle_event_portal_closeout();

comment on function public.handle_event_portal_closeout() is 'Idempotently creates Education follow-up work and consent-aware post-event notification intents when an event portal closes.';

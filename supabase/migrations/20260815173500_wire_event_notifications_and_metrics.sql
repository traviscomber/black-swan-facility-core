-- Wire lifecycle notifications and correct/enrich the canonical Events read model.

create or replace function public.enqueue_event_portal_invite_notification()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id from public.event_guest_portals where id=new.portal_id;
  if new.invitee_email is not null then
    insert into public.event_notification_outbox(event_id,portal_id,invite_id,notification_type,recipient_email,payload)
    values(v_event_id,new.portal_id,new.id,'invite_issued',new.invitee_email,
      jsonb_build_object('invitee_name',new.invitee_name,'expires_at',new.expires_at));
  end if;
  return new;
end;
$function$;

drop trigger if exists event_portal_invite_notification_trigger on public.event_portal_invites;
create trigger event_portal_invite_notification_trigger
after insert on public.event_portal_invites
for each row execute function public.enqueue_event_portal_invite_notification();

create or replace function public.enqueue_event_registration_notification()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_event_id uuid;
  v_type text;
begin
  select event_id into v_event_id from public.event_guest_portals where id=new.portal_id;

  if tg_op='INSERT' then
    v_type := case when new.registration_status='waitlist' then 'waitlist_added' else 'registration_confirmed' end;
  elsif old.registration_status='waitlist' and new.registration_status='confirmed' then
    v_type := 'waitlist_promoted';
  elsif new.registration_status='cancelled' and old.registration_status is distinct from 'cancelled' then
    v_type := 'registration_cancelled';
  else
    return new;
  end if;

  insert into public.event_notification_outbox(event_id,portal_id,registration_id,notification_type,recipient_email,recipient_phone,payload)
  values(v_event_id,new.portal_id,new.id,v_type,new.email,new.phone,
    jsonb_build_object('full_name',new.full_name,'registration_status',new.registration_status));
  return new;
end;
$function$;

drop trigger if exists event_registration_notification_trigger on public.event_portal_registrations;
create trigger event_registration_notification_trigger
after insert or update of registration_status on public.event_portal_registrations
for each row execute function public.enqueue_event_registration_notification();

create or replace function public.get_events_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_result jsonb;
begin
  if not public.can_view_corporacion_workspace() then raise exception 'EVENTS_WORKSPACE_FORBIDDEN'; end if;

  select jsonb_build_object(
    'events', coalesce(jsonb_agg(to_jsonb(x) order by x.event_date desc nulls last), '[]'::jsonb),
    'summary', jsonb_build_object(
      'events', count(*),
      'without_member_link', count(*) filter (where x.member_count = 0),
      'with_education_collection', count(*) filter (where x.education_collection_id is not null),
      'with_guest_portal', count(*) filter (where x.portal_id is not null),
      'registrations', coalesce(sum(x.registration_count),0),
      'attendees', coalesce(sum(x.attendee_count),0),
      'waitlisted', coalesce(sum(x.waitlist_count),0),
      'member_prospects', coalesce(sum(x.member_prospect_count),0),
      'donor_prospects', coalesce(sum(x.donor_prospect_count),0),
      'partner_prospects', coalesce(sum(x.partner_prospect_count),0)
    )
  ) into v_result
  from (
    select
      e.id,
      e.event_code,
      e.name,
      e.start_date as event_date,
      e.end_date,
      e.location_name,
      e.status,
      e.participant_count,
      e.estimated_total_clp,
      e.actual_total_clp,
      (select count(*) from public.event_member_roles emr where emr.event_id=e.id) as member_count,
      coalesce((select jsonb_agg(jsonb_build_object('member_id',m.id,'member_name',m.full_name,'role',emr.role,'is_primary',emr.is_primary))
        from public.event_member_roles emr join public.members m on m.id=emr.member_id where emr.event_id=e.id),'[]'::jsonb) as members,
      (select ec.id from public.education_collections ec where ec.event_id=e.id limit 1) as education_collection_id,
      (select count(*) from public.event_service_provider_engagements esp where esp.event_id=e.id and esp.status <> 'cancelled') as provider_engagements,
      p.id as portal_id,
      p.slug as portal_slug,
      p.status as portal_status,
      p.capacity as portal_capacity,
      coalesce((select count(*) from public.event_portal_invites i where i.portal_id=p.id),0) as invite_count,
      coalesce((select count(*) from public.event_portal_registrations r where r.portal_id=p.id and r.registration_status <> 'cancelled'),0) as registration_count,
      coalesce((select count(*) from public.event_portal_registrations r where r.portal_id=p.id and r.registration_status in ('checked_in','completed')),0) as attendee_count,
      coalesce((select count(*) from public.event_portal_registrations r where r.portal_id=p.id and r.registration_status='waitlist'),0) as waitlist_count,
      coalesce((select count(*) from public.event_portal_registrations r where r.portal_id=p.id and r.followup_status='prospective_member'),0) as member_prospect_count,
      coalesce((select count(*) from public.event_portal_registrations r where r.portal_id=p.id and r.followup_status='donor_prospect'),0) as donor_prospect_count,
      coalesce((select count(*) from public.event_portal_registrations r where r.portal_id=p.id and r.followup_status='partner_prospect'),0) as partner_prospect_count,
      coalesce((select count(*) from public.event_education_followup_tasks t where t.event_id=e.id and t.status in ('open','in_progress')),0) as education_tasks_open
    from public.operational_events e
    left join public.event_guest_portals p on p.event_id=e.id
  ) x;

  return coalesce(v_result,jsonb_build_object('events','[]'::jsonb,'summary','{}'::jsonb));
end;
$function$;

revoke all on function public.get_events_workspace() from public;
grant execute on function public.get_events_workspace() to authenticated;

create or replace function public.get_foundation_front_door_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_result jsonb;
begin
  if not public.can_view_corporacion_workspace() then raise exception 'FOUNDATION_FRONT_DOOR_FORBIDDEN'; end if;

  select jsonb_build_object(
    'publications', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select fp.id,fp.education_material_id,em.title as source_title,em.material_type,fp.channel,fp.status,
        fp.public_title,fp.public_summary,fp.campaign_reference,fp.published_url,fp.published_at,fp.created_at
      from public.foundation_publications fp join public.education_materials em on em.id=fp.education_material_id
    ) x),'[]'::jsonb),
    'event_funnel', coalesce((select jsonb_agg(to_jsonb(f) order by f.start_date desc nulls last) from (
      select e.id as event_id,e.name,e.start_date,p.id as portal_id,p.slug,
        count(r.id) filter (where r.registration_status <> 'cancelled') as registrations,
        count(r.id) filter (where r.registration_status in ('checked_in','completed')) as attendees,
        count(r.id) filter (where r.followup_status='prospective_member') as member_prospects,
        count(r.id) filter (where r.followup_status='donor_prospect') as donor_prospects,
        count(r.id) filter (where r.followup_status='partner_prospect') as partner_prospects,
        count(r.id) filter (where r.followup_status='contacted') as contacted
      from public.operational_events e
      join public.event_guest_portals p on p.event_id=e.id
      left join public.event_portal_registrations r on r.portal_id=p.id
      group by e.id,e.name,e.start_date,p.id,p.slug
    ) f),'[]'::jsonb),
    'summary', jsonb_build_object(
      'draft_publications',(select count(*) from public.foundation_publications where status='draft'),
      'published_publications',(select count(*) from public.foundation_publications where status='published'),
      'event_registrations',(select count(*) from public.event_portal_registrations where registration_status <> 'cancelled'),
      'event_attendees',(select count(*) from public.event_portal_registrations where registration_status in ('checked_in','completed')),
      'member_prospects',(select count(*) from public.event_portal_registrations where followup_status='prospective_member'),
      'donor_prospects',(select count(*) from public.event_portal_registrations where followup_status='donor_prospect'),
      'partner_prospects',(select count(*) from public.event_portal_registrations where followup_status='partner_prospect')
    )
  ) into v_result;
  return v_result;
end;
$function$;

revoke all on function public.get_foundation_front_door_workspace() from public;
grant execute on function public.get_foundation_front_door_workspace() to authenticated;

-- Integrate invite-only event guest portals into People, Events, and Foundation
-- workspaces. This keeps the six operational domains connected rather than
-- introducing a separate event microsite data silo.

create or replace function public.get_people_graph_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare v_result jsonb;
begin
  if not public.can_view_corporacion_workspace() then raise exception 'PEOPLE_GRAPH_FORBIDDEN'; end if;

  select jsonb_build_object(
    'members', coalesce(jsonb_agg(to_jsonb(x) order by x.full_name), '[]'::jsonb),
    'summary', jsonb_build_object(
      'active_members', count(*) filter (where x.status='active'),
      'members_on_ground', count(*) filter (where x.on_ground),
      'open_guest_invitations', coalesce(sum(x.open_guest_invitations),0),
      'event_portal_registrations', coalesce(sum(x.event_portal_registrations),0)
    )
  ) into v_result
  from (
    select m.id,m.member_number,m.full_name,m.status,m.joined_at,
      public.is_member_on_ground(m.id,now()) as on_ground,
      (select count(*) from public.guest_invitations gi where gi.inviting_member_id=m.id and gi.status in ('invited','confirmed','checked_in')) as open_guest_invitations,
      (select count(*) from public.event_member_roles emr where emr.member_id=m.id) as event_relationships,
      (select count(*) from public.event_portal_registrations epr where epr.inviting_member_id=m.id and epr.registration_status<>'cancelled') as event_portal_registrations,
      coalesce((select jsonb_agg(jsonb_build_object(
        'invitation_id',gi.id,'guest_id',gi.guest_id,'guest_name',g.name,'status',gi.status,
        'valid_from',gi.valid_from,'valid_until',gi.valid_until,'event_id',gi.event_id,
        'can_enter_now',public.can_guest_enter(gi.id,now())
      ) order by gi.valid_from desc)
      from public.guest_invitations gi join public.guests g on g.id=gi.guest_id
      where gi.inviting_member_id=m.id),'[]'::jsonb) as guests
    from public.members m join public.legal_entities le on le.id=m.legal_entity_id
    where le.code='BS_CORPORACION'
  ) x;

  return coalesce(v_result,jsonb_build_object('members','[]'::jsonb,'summary','{}'::jsonb));
end;
$function$;

create or replace function public.get_events_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare v_result jsonb;
begin
  if not public.can_view_corporacion_workspace() then raise exception 'EVENTS_WORKSPACE_FORBIDDEN'; end if;

  select jsonb_build_object(
    'events',coalesce(jsonb_agg(to_jsonb(x) order by x.event_date desc nulls last),'[]'::jsonb),
    'portals',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'event_id',p.event_id,'slug',p.slug,'status',p.status,'access_mode',p.access_mode,
      'commercial_model',p.commercial_model,'ticket_price',p.ticket_price,'currency',p.currency,
      'capacity',p.capacity,'registration_count',(select count(*) from public.event_portal_registrations r where r.portal_id=p.id and r.registration_status<>'cancelled')
    ) order by p.updated_at desc) from public.event_guest_portals p),'[]'::jsonb),
    'registrations',coalesce((select jsonb_agg(jsonb_build_object(
      'id',r.id,'portal_id',r.portal_id,'event_id',p.event_id,'full_name',r.full_name,'email',r.email,
      'status',r.registration_status,'payment_status',r.payment_status,'inviting_member_id',r.inviting_member_id,
      'registered_at',r.registered_at
    ) order by r.registered_at desc) from public.event_portal_registrations r join public.event_guest_portals p on p.id=r.portal_id),'[]'::jsonb),
    'summary',jsonb_build_object(
      'events',count(*),
      'without_member_link',count(*) filter (where x.member_count=0),
      'with_education_collection',count(*) filter (where x.education_collection_id is not null),
      'published_guest_portals',(select count(*) from public.event_guest_portals where status='published'),
      'guest_registrations',(select count(*) from public.event_portal_registrations where registration_status<>'cancelled')
    )
  ) into v_result
  from (
    select e.id,e.name as title,coalesce(e.start_date,e.created_at::date) as event_date,e.start_date,e.end_date,e.location_name,e.status,
      (select count(*) from public.event_member_roles emr where emr.event_id=e.id) as member_count,
      coalesce((select jsonb_agg(jsonb_build_object('member_id',m.id,'member_name',m.full_name,'role',emr.role,'is_primary',emr.is_primary))
        from public.event_member_roles emr join public.members m on m.id=emr.member_id where emr.event_id=e.id),'[]'::jsonb) as members,
      (select ec.id from public.education_collections ec where ec.event_id=e.id limit 1) as education_collection_id,
      (select count(*) from public.event_service_provider_engagements esp where esp.event_id=e.id and esp.status<>'cancelled') as provider_engagements,
      (select p.id from public.event_guest_portals p where p.event_id=e.id limit 1) as guest_portal_id
    from public.operational_events e
  ) x;

  return coalesce(v_result,jsonb_build_object('events','[]'::jsonb,'portals','[]'::jsonb,'registrations','[]'::jsonb,'summary','{}'::jsonb));
end;
$function$;

create or replace function public.get_foundation_front_door_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare v_result jsonb;
begin
  if not public.can_view_corporacion_workspace() then raise exception 'FOUNDATION_FRONT_DOOR_FORBIDDEN'; end if;

  select jsonb_build_object(
    'publications',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select fp.id,fp.education_material_id,em.title as source_title,em.material_type,fp.channel,fp.status,
        fp.public_title,fp.public_summary,fp.campaign_reference,fp.published_url,fp.published_at,fp.created_at
      from public.foundation_publications fp join public.education_materials em on em.id=fp.education_material_id
    ) x),'[]'::jsonb),
    'event_pages',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'event_id',p.event_id,'event_name',e.name,'slug',p.slug,'status',p.status,
      'access_mode',p.access_mode,'commercial_model',p.commercial_model,
      'registrations',(select count(*) from public.event_portal_registrations r where r.portal_id=p.id and r.registration_status<>'cancelled')
    ) order by p.updated_at desc) from public.event_guest_portals p join public.operational_events e on e.id=p.event_id),'[]'::jsonb),
    'summary',jsonb_build_object(
      'draft',(select count(*) from public.foundation_publications where status='draft'),
      'review',(select count(*) from public.foundation_publications where status='review'),
      'approved',(select count(*) from public.foundation_publications where status='approved'),
      'published',(select count(*) from public.foundation_publications where status='published'),
      'published_event_pages',(select count(*) from public.event_guest_portals where status='published')
    )
  ) into v_result;

  return coalesce(v_result,jsonb_build_object('publications','[]'::jsonb,'event_pages','[]'::jsonb,'summary','{}'::jsonb));
end;
$function$;

-- BlackSwan Access Hardening: shape People Graph data server-side.
-- Ordinary Members receive a directory-safe view of other Members. Private
-- presence/guest activity is returned only for the caller's own Member row or
-- to People operators/admins.

create or replace function public.get_people_graph_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_member_id uuid;
  v_route_access jsonb;
  v_people_levels jsonb := '[]'::jsonb;
  v_can_operate boolean := false;
  v_result jsonb;
begin
  if not public.can_view_corporacion_workspace() then
    raise exception 'PEOPLE_GRAPH_FORBIDDEN';
  end if;

  v_member_id := public.current_discovery_member_id();
  v_route_access := public.get_current_route_access();
  v_people_levels := case
    when jsonb_typeof(v_route_access -> 'capabilities' -> 'people') = 'array'
      then v_route_access -> 'capabilities' -> 'people'
    else '[]'::jsonb
  end;
  v_can_operate := v_people_levels ?| array['operate','approve','admin'];

  select jsonb_build_object(
    'members', coalesce(jsonb_agg(jsonb_strip_nulls(to_jsonb(x)) order by x.full_name), '[]'::jsonb),
    'summary', case
      when v_can_operate then jsonb_build_object(
        'active_members', count(*) filter (where x.status = 'active'),
        'members_on_ground', count(*) filter (where x.on_ground is true),
        'open_guest_invitations', coalesce(sum(x.open_guest_invitations),0)
      )
      else jsonb_build_object(
        'active_members', count(*) filter (where x.status = 'active')
      )
    end
  ) into v_result
  from (
    select
      m.id,
      m.member_number,
      m.full_name,
      m.status,
      case when v_can_operate or m.id = v_member_id then m.joined_at else null end as joined_at,
      case when v_can_operate or m.id = v_member_id then public.is_member_on_ground(m.id, now()) else null end as on_ground,
      case when v_can_operate or m.id = v_member_id then (
        select count(*)
        from public.guest_invitations gi
        where gi.inviting_member_id = m.id
          and gi.status in ('invited','confirmed','checked_in')
      ) else null end as open_guest_invitations,
      case when v_can_operate or m.id = v_member_id then (
        select count(*) from public.event_member_roles emr where emr.member_id = m.id
      ) else null end as event_relationships,
      case when v_can_operate or m.id = v_member_id then coalesce((
        select jsonb_agg(jsonb_build_object(
          'invitation_id', gi.id,
          'guest_id', gi.guest_id,
          'guest_name', g.name,
          'status', gi.status,
          'valid_from', gi.valid_from,
          'valid_until', gi.valid_until,
          'event_id', gi.event_id,
          'can_enter_now', public.can_guest_enter(gi.id, now())
        ) order by gi.valid_from desc)
        from public.guest_invitations gi
        join public.guests g on g.id = gi.guest_id
        where gi.inviting_member_id = m.id
      ), '[]'::jsonb) else null end as guests
    from public.members m
    join public.legal_entities le on le.id = m.legal_entity_id
    where le.code = 'BS_CORPORACION'
  ) x;

  return coalesce(v_result, jsonb_build_object(
    'members', '[]'::jsonb,
    'summary', jsonb_build_object('active_members', 0)
  ));
end;
$function$;

revoke all on function public.get_people_graph_workspace() from public;
grant execute on function public.get_people_graph_workspace() to authenticated;
grant execute on function public.get_people_graph_workspace() to service_role;

comment on function public.get_people_graph_workspace() is
  'People Graph read model with server-side privacy shaping: directory-safe cross-member rows; self/operator private presence and guest detail only.';

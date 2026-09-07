create or replace function public.approve_orchard_seed_requests_bulk(p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor uuid := auth.uid();
  v_self_requests integer := 0;
  v_eligible integer := 0;
  v_approved integer := 0;
  v_note text := coalesce(
    nullif(trim(p_notes), ''),
    'Bulk approval for sourcing: Orchard 2026/27 seed procurement. Supplier, price and purchase order remain subject to sourcing and final approval.'
  );
  v_request record;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_procurement_approver() then
    raise exception 'Procurement approver role required';
  end if;

  select count(*)
    into v_self_requests
  from public.procurement_requests
  where source_type = 'orchard_seed_plan'
    and status in ('submitted', 'under_review')
    and requested_by = v_actor;

  if v_self_requests > 0 then
    raise exception 'Self-approval is not allowed for Orchard seed requests. A different procurement approver must approve this batch.';
  end if;

  select count(*)
    into v_eligible
  from public.procurement_requests
  where source_type = 'orchard_seed_plan'
    and status in ('submitted', 'under_review');

  if v_eligible = 0 then
    return jsonb_build_object('approved', 0, 'eligible', 0);
  end if;

  for v_request in
    select id
    from public.procurement_requests
    where source_type = 'orchard_seed_plan'
      and status in ('submitted', 'under_review')
    order by created_at, id
  loop
    perform public.decide_procurement_request(v_request.id, 'approved', v_note);
    v_approved := v_approved + 1;
  end loop;

  return jsonb_build_object('approved', v_approved, 'eligible', v_eligible);
end;
$function$;

grant execute on function public.approve_orchard_seed_requests_bulk(text) to authenticated;

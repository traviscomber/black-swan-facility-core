-- Replace brittle email allowlists with the canonical procurement permission model
-- and record supplier approval decisions in the procurement audit log.

create or replace function public.set_supplier_approval(
  supplier_id uuid,
  next_status text
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor uuid := auth.uid();
  v_previous_status text;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if not public.can_app_action('procurement.manage') then
    raise exception 'Procurement management permission required';
  end if;

  if next_status not in ('approved', 'rejected', 'pending') then
    raise exception 'Invalid supplier approval status';
  end if;

  select approval_status
    into v_previous_status
  from public.suppliers
  where id = supplier_id
  for update;

  if not found then
    raise exception 'Supplier not found';
  end if;

  update public.suppliers
  set approval_status = next_status,
      is_active = (next_status = 'approved'),
      approved_at = case when next_status = 'approved' then now() else null end,
      approved_by = case when next_status = 'approved' then v_actor else null end,
      updated_at = now()
  where id = supplier_id;

  insert into public.procurement_audit_log(
    entity_type,
    entity_id,
    action,
    actor_type,
    actor_id,
    metadata
  ) values (
    'supplier',
    supplier_id,
    'supplier_approval_changed',
    'user',
    v_actor,
    jsonb_build_object(
      'previous_status', v_previous_status,
      'next_status', next_status
    )
  );
end;
$function$;

revoke all on function public.set_supplier_approval(uuid,text) from public, anon;
grant execute on function public.set_supplier_approval(uuid,text) to authenticated, service_role;

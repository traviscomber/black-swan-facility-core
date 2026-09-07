create or replace function public.get_task_review_requirement(p_estimated_cost_clp numeric default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_limit bigint;
  v_has_approver boolean := false;
  v_global_limit constant bigint := 200000;
  v_effective_limit bigint;
begin
  if v_uid is null then
    raise exception 'Autenticación requerida';
  end if;

  if p_estimated_cost_clp is null or p_estimated_cost_clp <= 0 then
    return jsonb_build_object('required', false, 'reason', null);
  end if;

  select true, role, approval_limit_clp
    into v_has_approver, v_role, v_limit
  from public.procurement_approvers
  where user_id = v_uid and is_active = true
  limit 1;

  -- Everyone may proceed without review up to the global operational threshold.
  -- Individual limits can only make that threshold stricter, never higher.
  if coalesce(v_has_approver, false) then
    v_effective_limit := least(coalesce(v_limit, v_global_limit), v_global_limit);
  else
    v_effective_limit := v_global_limit;
  end if;

  if p_estimated_cost_clp > v_effective_limit then
    return jsonb_build_object(
      'required', true,
      'reason', 'Monto sobre el máximo sin revisión de $200.000 CLP.'
    );
  end if;

  return jsonb_build_object('required', false, 'reason', null);
end;
$$;

grant execute on function public.get_task_review_requirement(numeric) to authenticated;

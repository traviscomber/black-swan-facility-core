alter table public.tasks add column if not exists estimated_cost_clp numeric;
alter table public.tasks drop constraint if exists tasks_estimated_cost_clp_check;
alter table public.tasks add constraint tasks_estimated_cost_clp_check check (estimated_cost_clp is null or estimated_cost_clp >= 0);

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

  if coalesce(v_has_approver, false) = false then
    return jsonb_build_object(
      'required', true,
      'reason', 'Monto requiere revisión: no tienes rango de aprobación de compras.'
    );
  end if;

  if v_role = 'admin' then
    return jsonb_build_object('required', false, 'reason', null);
  end if;

  if v_limit is null or p_estimated_cost_clp > v_limit then
    return jsonb_build_object(
      'required', true,
      'reason', case
        when v_limit is null then 'Monto requiere revisión: tu rango de aprobación no está definido.'
        else 'Monto sobre tu rango autorizado de $' || to_char(v_limit, 'FM999G999G999G990') || ' CLP.'
      end
    );
  end if;

  return jsonb_build_object('required', false, 'reason', null);
end;
$$;

grant execute on function public.get_task_review_requirement(numeric) to authenticated;

create or replace function public.finalize_task_review(
  p_task_id uuid,
  p_estimated_cost_clp numeric default null,
  p_manual_review boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_requirement jsonb;
  v_required boolean;
  v_reason text;
  v_request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Autenticación requerida';
  end if;

  if not public.can_access_operational_task(p_task_id) then
    raise exception 'Sin acceso a la tarea';
  end if;

  if p_estimated_cost_clp is not null and p_estimated_cost_clp < 0 then
    raise exception 'Costo estimado inválido';
  end if;

  update public.tasks
  set estimated_cost_clp = p_estimated_cost_clp,
      updated_at = now()
  where id = p_task_id;

  v_requirement := public.get_task_review_requirement(p_estimated_cost_clp);
  v_required := coalesce((v_requirement ->> 'required')::boolean, false);
  v_reason := nullif(v_requirement ->> 'reason', '');

  if v_required or p_manual_review then
    v_request_id := public.request_task_escalation(
      p_task_id,
      case when v_required then 'escalate' else 'unsure' end,
      case when v_required then v_reason else null end
    );
  end if;

  return jsonb_build_object(
    'required', v_required or p_manual_review,
    'forced', v_required,
    'reason', v_reason,
    'request_id', v_request_id
  );
end;
$$;

grant execute on function public.finalize_task_review(uuid,numeric,boolean) to authenticated;
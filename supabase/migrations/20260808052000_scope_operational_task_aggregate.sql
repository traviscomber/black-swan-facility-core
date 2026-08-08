-- Scope the operational-task aggregate at the database boundary so direct table
-- writes and SECURITY DEFINER RPCs share the same authorization contract.

create or replace function public.can_access_operational_task_scope(
  p_operational_area text,
  p_location_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_has_scopes boolean;
  v_department text := coalesce(nullif(trim(p_operational_area), ''), 'tasks');
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return true;
  end if;
  if auth.uid() is null then
    return false;
  end if;
  if v_role = 'admin' then
    return true;
  end if;
  if v_role <> 'approver' then
    return false;
  end if;

  select exists(
    select 1
    from public.user_operational_scopes s
    where s.user_id = auth.uid() and s.is_active
  ) into v_has_scopes;

  if not v_has_scopes then
    return true;
  end if;

  -- A scoped approver may not use a NULL location as a wildcard.
  if p_location_id is null then
    return false;
  end if;

  return public.can_access_operational_scope(v_department, p_location_id);
end;
$function$;

create or replace function public.can_access_operational_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists(
    select 1
    from public.tasks t
    where t.id = p_task_id
      and public.can_access_operational_task_scope(t.operational_area, t.location_id)
  );
$function$;

create or replace function public.guard_operational_task_scope_write()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and not public.can_access_operational_task_scope(old.operational_area, old.location_id) then
    raise exception 'Task outside operational scope';
  end if;

  if not public.can_access_operational_task_scope(new.operational_area, new.location_id) then
    raise exception 'Task outside operational scope';
  end if;

  return new;
end;
$function$;

create or replace function public.guard_operational_task_child_scope_write()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old_task_id uuid;
  v_new_task_id uuid;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return coalesce(new, old);
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    v_old_task_id := old.task_id;
    if not public.can_access_operational_task(v_old_task_id) then
      raise exception 'Task child record outside operational scope';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    v_new_task_id := new.task_id;
    if not public.can_access_operational_task(v_new_task_id) then
      raise exception 'Task child record outside operational scope';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

drop trigger if exists tasks_guard_operational_scope on public.tasks;
create trigger tasks_guard_operational_scope
before insert or update on public.tasks
for each row execute function public.guard_operational_task_scope_write();

do $$
declare
  v_table text;
begin
  foreach v_table in array array['task_assignments','task_comments','task_evidence'] loop
    execute format('drop trigger if exists %I on public.%I', v_table || '_guard_operational_scope', v_table);
    execute format(
      'create trigger %I before insert or update or delete on public.%I for each row execute function public.guard_operational_task_child_scope_write()',
      v_table || '_guard_operational_scope',
      v_table
    );
  end loop;
end $$;

-- Replace broad role-only RLS with task-scope inheritance.
drop policy if exists tasks_internal_select on public.tasks;
create policy tasks_internal_select on public.tasks
for select to authenticated
using (public.can_access_operational_task_scope(operational_area, location_id));

drop policy if exists tasks_internal_insert on public.tasks;
create policy tasks_internal_insert on public.tasks
for insert to authenticated
with check (public.can_access_operational_task_scope(operational_area, location_id));

drop policy if exists tasks_internal_update on public.tasks;
create policy tasks_internal_update on public.tasks
for update to authenticated
using (public.can_access_operational_task_scope(operational_area, location_id))
with check (public.can_access_operational_task_scope(operational_area, location_id));

drop policy if exists task_assignments_select_authenticated on public.task_assignments;
create policy task_assignments_select_scoped on public.task_assignments
for select to authenticated
using (public.can_access_operational_task(task_id));

drop policy if exists task_assignments_insert_authenticated on public.task_assignments;
create policy task_assignments_insert_scoped on public.task_assignments
for insert to authenticated
with check (public.can_access_operational_task(task_id));

drop policy if exists task_assignments_update_authenticated on public.task_assignments;
create policy task_assignments_update_scoped on public.task_assignments
for update to authenticated
using (public.can_access_operational_task(task_id))
with check (public.can_access_operational_task(task_id));

drop policy if exists task_comments_select_authenticated on public.task_comments;
create policy task_comments_select_scoped on public.task_comments
for select to authenticated
using (public.can_access_operational_task(task_id));

drop policy if exists task_comments_insert_authenticated on public.task_comments;
create policy task_comments_insert_scoped on public.task_comments
for insert to authenticated
with check (
  created_by = auth.uid()
  and public.can_access_operational_task(task_id)
);

drop policy if exists task_evidence_select_internal on public.task_evidence;
create policy task_evidence_select_scoped on public.task_evidence
for select to authenticated
using (public.can_access_operational_task(task_id));

drop policy if exists task_evidence_insert_internal on public.task_evidence;
create policy task_evidence_insert_scoped on public.task_evidence
for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and public.can_access_operational_task(task_id)
);

drop policy if exists task_evidence_update_internal on public.task_evidence;
create policy task_evidence_update_scoped on public.task_evidence
for update to authenticated
using (public.can_access_operational_task(task_id))
with check (public.can_access_operational_task(task_id));

revoke execute on function public.can_access_operational_task_scope(text, uuid) from anon;
revoke execute on function public.can_access_operational_task(uuid) from anon;
revoke execute on function public.guard_operational_task_scope_write() from anon, authenticated;
revoke execute on function public.guard_operational_task_child_scope_write() from anon, authenticated;
grant execute on function public.guard_operational_task_scope_write() to service_role;
grant execute on function public.guard_operational_task_child_scope_write() to service_role;

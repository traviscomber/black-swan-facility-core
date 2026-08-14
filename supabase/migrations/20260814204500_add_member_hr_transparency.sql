-- Black Swan OS: curated read-only HR transparency.
-- Active Corporacion members may view non-sensitive HR directory/reporting data
-- for Black Swan Infra and Black Swan Corporacion only.
-- This does not grant access to payroll, compensation, contracts, tax IDs,
-- private addresses, banking data, personal documents, phone, or email.

create or replace function public.can_view_hr_transparency(p_legal_entity_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_code text;
begin
  if auth.uid() is null or p_legal_entity_id is null then
    return false;
  end if;

  if public.can_access_legal_entity(p_legal_entity_id, 'view') then
    return true;
  end if;

  select code into v_code
  from public.legal_entities
  where id = p_legal_entity_id and is_active;

  if v_code not in ('BS_INFRA','BS_CORPORACION') then
    return false;
  end if;

  return exists (
    select 1
    from public.member_auth_links mal
    join public.members m on m.id = mal.member_id
    join public.legal_entities le on le.id = m.legal_entity_id
    where mal.user_id = auth.uid()
      and mal.status = 'active'
      and mal.ended_at is null
      and m.status = 'active'
      and le.code = 'BS_CORPORACION'
  );
end;
$function$;

create or replace function public.list_hr_transparency_entities()
returns jsonb
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', le.id,
    'code', le.code,
    'display_name', le.display_name
  ) order by le.display_name), '[]'::jsonb)
  from public.legal_entities le
  where le.is_active
    and public.can_view_hr_transparency(le.id);
$function$;

create or replace function public.get_entity_hr_transparency(p_legal_entity_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_code text;
  v_name text;
  v_people jsonb;
  v_departments jsonb;
  v_headcount integer;
begin
  if not public.can_view_hr_transparency(p_legal_entity_id) then
    raise exception 'HR_TRANSPARENCY_FORBIDDEN';
  end if;

  select code, display_name into v_code, v_name
  from public.legal_entities
  where id = p_legal_entity_id and is_active;

  if v_code is null then raise exception 'LEGAL_ENTITY_NOT_FOUND'; end if;

  select count(*) into v_headcount
  from public.employee_employments ee
  where ee.legal_entity_id = p_legal_entity_id
    and ee.is_active
    and (ee.end_date is null or ee.end_date >= current_date);

  select coalesce(jsonb_agg(jsonb_build_object(
    'employee_id', e.id,
    'name', e.name,
    'photo_url', e.photo_url,
    'job_title', coalesce(ee.job_title, e.role),
    'department_id', d.id,
    'department_code', d.code,
    'department_name', d.name,
    'employment_type', ee.employment_type,
    'is_primary', ee.is_primary,
    'is_active', ee.is_active
  ) order by d.name nulls last, e.name), '[]'::jsonb)
  into v_people
  from public.employee_employments ee
  join public.employees e on e.id = ee.employee_id
  left join public.entity_departments d on d.id = ee.department_id and d.legal_entity_id = ee.legal_entity_id
  where ee.legal_entity_id = p_legal_entity_id
    and ee.is_active
    and e.is_active
    and (ee.end_date is null or ee.end_date >= current_date);

  select coalesce(jsonb_agg(jsonb_build_object(
    'department_id', d.id,
    'code', d.code,
    'name', d.name,
    'headcount', (
      select count(*)
      from public.employee_employments ee
      join public.employees e on e.id = ee.employee_id
      where ee.department_id = d.id
        and ee.legal_entity_id = p_legal_entity_id
        and ee.is_active
        and e.is_active
        and (ee.end_date is null or ee.end_date >= current_date)
    )
  ) order by d.name), '[]'::jsonb)
  into v_departments
  from public.entity_departments d
  where d.legal_entity_id = p_legal_entity_id and d.is_active;

  return jsonb_build_object(
    'legal_entity_id', p_legal_entity_id,
    'legal_entity_code', v_code,
    'legal_entity_name', v_name,
    'headcount', v_headcount,
    'departments', v_departments,
    'people', v_people,
    'privacy', jsonb_build_object(
      'email', false,
      'phone', false,
      'compensation', false,
      'payroll', false,
      'tax_identifiers', false,
      'banking', false,
      'contracts', false,
      'private_documents', false
    ),
    'generated_at', now()
  );
end;
$function$;

revoke all on function public.can_view_hr_transparency(uuid) from public;
revoke all on function public.list_hr_transparency_entities() from public;
revoke all on function public.get_entity_hr_transparency(uuid) from public;
grant execute on function public.can_view_hr_transparency(uuid) to authenticated;
grant execute on function public.list_hr_transparency_entities() to authenticated;
grant execute on function public.get_entity_hr_transparency(uuid) to authenticated;

comment on function public.get_entity_hr_transparency(uuid) is
  'Curated HR transparency only. Returns directory/department/headcount data and intentionally excludes private HR, payroll, compensation and direct contact fields.';

-- Match Raimundo's canonical employee role label while preserving existing finance approvers.

create or replace function public.can_finance_approve()
returns boolean
language sql
stable
security definer
set search_path='public','pg_temp'
as $function$
  select case
    when public.current_app_role() in ('admin','service_role') then true
    when auth.uid() is null then false
    else exists (
      select 1
      from public.employees e
      where e.is_active
        and lower(coalesce(e.email,''))=lower(coalesce(auth.jwt()->>'email',''))
        and (
          lower(coalesce(e.role,'')) like 'administrador del campo%'
          or e.role in ('CEO','Jefe de proyectos')
        )
    )
    or exists (
      select 1
      from public.user_access_profiles uap
      where uap.user_id=auth.uid()
        and uap.is_active
        and uap.role_key='finance_approver'
    )
  end;
$function$;

revoke all on function public.can_finance_approve() from public, anon;
grant execute on function public.can_finance_approve() to authenticated;

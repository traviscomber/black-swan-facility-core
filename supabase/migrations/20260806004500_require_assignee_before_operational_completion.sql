begin;

create or replace function public.track_housekeeping_execution_times()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status in ('in_progress', 'completed')
     and old.status is distinct from new.status
     and new.assigned_to is null then
    raise exception using
      errcode = 'P0001',
      message = 'Asigna un encargado antes de iniciar o completar esta tarea de Housekeeping.';
  end if;

  if new.status = 'in_progress' and old.status is distinct from 'in_progress' then
    new.started_at := coalesce(new.started_at, now());
  end if;

  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  end if;

  return new;
end;
$$;

create or replace function public.require_hospitality_assignee_before_execution()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status in ('in_progress', 'completed', 'resolved')
     and old.status is distinct from new.status
     and new.assigned_to is null then
    raise exception using
      errcode = 'P0001',
      message = 'Asigna un encargado antes de poner en curso o completar esta solicitud de Hospitality.';
  end if;

  if new.status = 'in_progress' and old.status is distinct from 'in_progress' then
    new.started_at := coalesce(new.started_at, now());
  end if;

  if new.status in ('completed', 'resolved') and old.status is distinct from new.status then
    new.completed_at := coalesce(new.completed_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists hospitality_require_assignee_before_execution on public.hospitality_requests;
create trigger hospitality_require_assignee_before_execution
before update of status on public.hospitality_requests
for each row execute function public.require_hospitality_assignee_before_execution();

commit;

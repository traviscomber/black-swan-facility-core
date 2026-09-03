-- Production scheduler for daily employee task digests.
-- Required Vault secret names are provisioned out-of-band:
-- black_swan_greenapi_api_url, black_swan_greenapi_id_instance,
-- black_swan_greenapi_token_instance, black_swan_greenapi_cron_secret.

alter table public.task_whatsapp_digest_deliveries
  add column if not exists request_id bigint;

create or replace function public.normalize_chile_whatsapp_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare v_digits text;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_digits := regexp_replace(v_digits, '^0+', '');
  if v_digits ~ '^569[0-9]{8}$' then return v_digits; end if;
  if v_digits ~ '^9[0-9]{8}$' then return '56' || v_digits; end if;
  return null;
end;
$$;

revoke all on function public.normalize_chile_whatsapp_phone(text) from public, anon;
grant execute on function public.normalize_chile_whatsapp_phone(text) to authenticated, service_role;

create or replace function public.dispatch_daily_task_whatsapp_digests(
  p_force boolean default false,
  p_employee_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault, net, pg_temp
as $$
declare
  v_now_local timestamp := timezone('America/Santiago', now());
  v_local_date date := timezone('America/Santiago', now())::date;
  v_api_url text;
  v_instance text;
  v_token text;
  v_request_id bigint;
  v_message text;
  v_task_lines text;
  v_phone text;
  v_task_ids uuid[];
  v_task_count integer;
  v_queued integer := 0;
  v_skipped integer := 0;
  r record;
begin
  if not p_force and (extract(hour from v_now_local)::int <> 7 or extract(minute from v_now_local)::int <> 30) then
    return jsonb_build_object('status','outside_window','local_time',to_char(v_now_local,'YYYY-MM-DD HH24:MI'));
  end if;

  select decrypted_secret into v_api_url from vault.decrypted_secrets where name='black_swan_greenapi_api_url' limit 1;
  select decrypted_secret into v_instance from vault.decrypted_secrets where name='black_swan_greenapi_id_instance' limit 1;
  select decrypted_secret into v_token from vault.decrypted_secrets where name='black_swan_greenapi_token_instance' limit 1;
  if nullif(v_api_url,'') is null or nullif(v_instance,'') is null or nullif(v_token,'') is null then
    raise exception 'GreenAPI secrets are not configured';
  end if;

  for r in
    select e.id as employee_id, e.name, e.phone
    from public.employees e
    join public.employee_task_profiles etp on etp.employee_id=e.id and etp.can_receive_tasks=true
    where e.is_active=true
      and (p_employee_id is null or e.id=p_employee_id)
      and public.normalize_chile_whatsapp_phone(e.phone) is not null
      and exists (
        select 1 from public.task_assignments ta
        join public.tasks t on t.id=ta.task_id
        where ta.employee_id=e.id and t.status in ('nueva','en_progreso')
      )
    order by e.name
  loop
    if exists (
      select 1 from public.task_whatsapp_digest_deliveries d
      where d.local_date=v_local_date and d.employee_id=r.employee_id and d.status in ('processing','sent')
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    select
      array_agg(q.id order by q.sort_due,q.sort_priority,q.created_at),
      count(*)::int,
      string_agg(
        case when q.rn <= 12 then
          q.rn::text || '. ' ||
          case q.status when 'en_progreso' then '[EN CURSO] ' else '' end || q.title ||
          case when q.due_date is not null then ' · ' || to_char(q.due_date,'DD-MM') else '' end ||
          case when nullif(q.location_name,'') is not null then ' · ' || q.location_name else '' end ||
          case when q.estimated_minutes is not null then ' · ' || q.estimated_minutes::text || ' min' else '' end
        else null end,
        E'\n' order by q.rn
      ) filter (where q.rn <= 12)
    into v_task_ids,v_task_count,v_task_lines
    from (
      select t.*,
        row_number() over (order by coalesce(t.due_date,'9999-12-31'::date),case t.priority when 'urgente' then 1 when 'alta' then 2 when 'media' then 3 else 4 end,t.created_at) rn,
        coalesce(t.due_date,'9999-12-31'::date) sort_due,
        case t.priority when 'urgente' then 1 when 'alta' then 2 when 'media' then 3 else 4 end sort_priority
      from public.task_assignments ta
      join public.tasks t on t.id=ta.task_id
      where ta.employee_id=r.employee_id and t.status in ('nueva','en_progreso')
    ) q;

    if coalesce(v_task_count,0)=0 then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_phone := public.normalize_chile_whatsapp_phone(r.phone);
    v_message := 'Black Swan · Tus tareas · ' || to_char(v_local_date,'DD-MM-YYYY') || E'\n\n' ||
      'Buenos días ' || split_part(r.name,' ',1) || '.' || E'\n' ||
      'Tienes ' || v_task_count::text || case when v_task_count=1 then ' tarea abierta:' else ' tareas abiertas:' end || E'\n\n' ||
      coalesce(v_task_lines,'') ||
      case when v_task_count > 12 then E'\n… +' || (v_task_count-12)::text || ' tareas más' else '' end ||
      E'\n\nAbrir Mis tareas: https://blackswn.app/es/my-tasks';

    v_request_id := net.http_post(
      url := rtrim(v_api_url,'/') || '/waInstance' || v_instance || '/sendMessage/' || v_token,
      body := jsonb_build_object('chatId',v_phone || '@c.us','message',v_message),
      params := '{}'::jsonb,
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 15000
    );

    insert into public.task_whatsapp_digest_deliveries(
      local_date,employee_id,phone,task_ids,task_count,status,request_id,greenapi_message_id,error_message,sent_at
    ) values (
      v_local_date,r.employee_id,v_phone,v_task_ids,v_task_count,'processing',v_request_id,null,null,null
    )
    on conflict (local_date,employee_id) do update set
      phone=excluded.phone,task_ids=excluded.task_ids,task_count=excluded.task_count,status='processing',
      request_id=excluded.request_id,greenapi_message_id=null,error_message=null,sent_at=null,updated_at=now();

    v_queued := v_queued + 1;
  end loop;

  return jsonb_build_object('status','processing','local_date',v_local_date,'queued',v_queued,'skipped',v_skipped);
end;
$$;

revoke all on function public.dispatch_daily_task_whatsapp_digests(boolean,uuid) from public, anon, authenticated;
grant execute on function public.dispatch_daily_task_whatsapp_digests(boolean,uuid) to service_role;

create or replace function public.reconcile_task_whatsapp_digest_deliveries()
returns jsonb
language plpgsql
security definer
set search_path = public, net, pg_temp
as $$
declare v_sent integer := 0; v_failed integer := 0;
begin
  update public.task_whatsapp_digest_deliveries d
  set status='sent',
      greenapi_message_id=case when r.content is not null and r.content ~ '^\s*\{' then (r.content::jsonb)->>'idMessage' else null end,
      error_message=null,
      sent_at=coalesce(d.sent_at,now()),
      updated_at=now()
  from net._http_response r
  where d.status='processing' and d.request_id=r.id
    and r.status_code between 200 and 299 and coalesce(r.timed_out,false)=false;
  get diagnostics v_sent = row_count;

  update public.task_whatsapp_digest_deliveries d
  set status='failed',
      error_message=left(coalesce(r.error_msg,r.content,'GreenAPI request failed'),1000),
      updated_at=now()
  from net._http_response r
  where d.status='processing' and d.request_id=r.id
    and (coalesce(r.timed_out,false)=true or r.status_code < 200 or r.status_code >= 300);
  get diagnostics v_failed = row_count;

  return jsonb_build_object('sent',v_sent,'failed',v_failed);
end;
$$;

revoke all on function public.reconcile_task_whatsapp_digest_deliveries() from public, anon, authenticated;
grant execute on function public.reconcile_task_whatsapp_digest_deliveries() to service_role;

do $$
declare j record;
begin
  for j in select jobid from cron.job where jobname in (
    'black_swan_greenapi_digest_summer',
    'black_swan_greenapi_digest_winter',
    'black_swan_greenapi_digest_reconcile'
  ) loop
    perform cron.unschedule(j.jobid);
  end loop;
end $$;

select cron.schedule('black_swan_greenapi_digest_summer','30 10 * * *',$$select public.dispatch_daily_task_whatsapp_digests(false,null);$$);
select cron.schedule('black_swan_greenapi_digest_winter','30 11 * * *',$$select public.dispatch_daily_task_whatsapp_digests(false,null);$$);
select cron.schedule('black_swan_greenapi_digest_reconcile','*/5 * * * *',$$select public.reconcile_task_whatsapp_digest_deliveries();$$);

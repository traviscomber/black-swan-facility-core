-- Black Swan event lifecycle refinements: notification outbox, attendance/conversion metrics,
-- and automatic Education follow-up tasks. Payment processing remains intentionally excluded.

create table if not exists public.event_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.operational_events(id) on delete cascade,
  portal_id uuid references public.event_guest_portals(id) on delete cascade,
  registration_id uuid references public.event_portal_registrations(id) on delete cascade,
  invite_id uuid references public.event_portal_invites(id) on delete cascade,
  notification_type text not null,
  recipient_email text,
  recipient_phone text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_notification_type_check check (notification_type in ('invite_issued','registration_confirmed','waitlist_added','waitlist_promoted','registration_cancelled','event_reminder','post_event_followup')),
  constraint event_notification_status_check check (status in ('pending','processing','sent','failed','cancelled'))
);

create index if not exists event_notification_outbox_pending_idx
  on public.event_notification_outbox(status, available_at)
  where status in ('pending','failed');

create table if not exists public.event_education_followup_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.operational_events(id) on delete cascade,
  education_collection_id uuid not null references public.education_collections(id) on delete cascade,
  task_type text not null,
  title text not null,
  status text not null default 'open',
  due_at timestamptz,
  assigned_user_id uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(event_id, task_type),
  constraint event_education_followup_task_type_check check (task_type in ('collect_source_material','prepare_transcript','prepare_summary','editorial_review','publication_review')),
  constraint event_education_followup_status_check check (status in ('open','in_progress','completed','cancelled'))
);

alter table public.event_notification_outbox enable row level security;
alter table public.event_education_followup_tasks enable row level security;

create policy event_notification_outbox_admin_view
  on public.event_notification_outbox for select to authenticated
  using (public.current_app_role() = 'admin');

create policy event_education_followup_tasks_corporacion_view
  on public.event_education_followup_tasks for select to authenticated
  using (public.can_view_corporacion_workspace());

create or replace function public.queue_event_notification(
  p_event_id uuid,
  p_notification_type text,
  p_recipient_email text default null,
  p_recipient_phone text default null,
  p_payload jsonb default '{}'::jsonb,
  p_portal_id uuid default null,
  p_registration_id uuid default null,
  p_invite_id uuid default null,
  p_available_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_id uuid;
begin
  if auth.uid() is null or public.current_app_role() not in ('admin','approver') then
    raise exception 'Insufficient permissions';
  end if;
  insert into public.event_notification_outbox(
    event_id,portal_id,registration_id,invite_id,notification_type,recipient_email,recipient_phone,payload,available_at
  ) values (
    p_event_id,p_portal_id,p_registration_id,p_invite_id,p_notification_type,
    nullif(lower(trim(coalesce(p_recipient_email,''))),''),nullif(trim(coalesce(p_recipient_phone,'')),''),coalesce(p_payload,'{}'::jsonb),coalesce(p_available_at,now())
  ) returning id into v_id;
  return v_id;
end;
$function$;

revoke all on function public.queue_event_notification(uuid,text,text,text,jsonb,uuid,uuid,uuid,timestamptz) from public;
grant execute on function public.queue_event_notification(uuid,text,text,text,jsonb,uuid,uuid,uuid,timestamptz) to authenticated;

create or replace function public.get_event_funnel_metrics(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_portal_id uuid;
  v_invites integer := 0;
  v_registrations integer := 0;
  v_confirmed integer := 0;
  v_waitlist integer := 0;
  v_checked_in integer := 0;
  v_completed integer := 0;
  v_repeat_guests integer := 0;
  v_member_prospects integer := 0;
  v_donor_prospects integer := 0;
  v_partner_prospects integer := 0;
begin
  if not public.can_view_corporacion_workspace() then raise exception 'EVENT_METRICS_FORBIDDEN'; end if;
  select id into v_portal_id from public.event_guest_portals where event_id=p_event_id limit 1;
  if v_portal_id is null then return jsonb_build_object('event_id',p_event_id,'has_portal',false); end if;

  select count(*) into v_invites from public.event_portal_invites where portal_id=v_portal_id;
  select count(*),
         count(*) filter (where registration_status='confirmed'),
         count(*) filter (where registration_status='waitlist'),
         count(*) filter (where registration_status='checked_in'),
         count(*) filter (where registration_status='completed'),
         count(*) filter (where followup_status='prospective_member'),
         count(*) filter (where followup_status='donor_prospect'),
         count(*) filter (where followup_status='partner_prospect')
    into v_registrations,v_confirmed,v_waitlist,v_checked_in,v_completed,v_member_prospects,v_donor_prospects,v_partner_prospects
  from public.event_portal_registrations where portal_id=v_portal_id;

  select count(distinct r.guest_id) into v_repeat_guests
  from public.event_portal_registrations r
  where r.portal_id=v_portal_id
    and r.guest_id is not null
    and exists (
      select 1 from public.event_portal_registrations r2
      where r2.guest_id=r.guest_id and r2.portal_id<>v_portal_id and r2.registration_status in ('confirmed','checked_in','completed')
    );

  return jsonb_build_object(
    'event_id',p_event_id,'portal_id',v_portal_id,'has_portal',true,
    'invites',v_invites,'registrations',v_registrations,'confirmed',v_confirmed,'waitlist',v_waitlist,
    'checked_in',v_checked_in,'completed',v_completed,'repeat_guests',v_repeat_guests,
    'member_prospects',v_member_prospects,'donor_prospects',v_donor_prospects,'partner_prospects',v_partner_prospects,
    'registration_rate',case when v_invites>0 then round(v_registrations::numeric/v_invites,4) else null end,
    'attendance_rate',case when (v_confirmed+v_checked_in+v_completed)>0 then round((v_checked_in+v_completed)::numeric/(v_confirmed+v_checked_in+v_completed),4) else null end
  );
end;
$function$;

revoke all on function public.get_event_funnel_metrics(uuid) from public;
grant execute on function public.get_event_funnel_metrics(uuid) to authenticated;

create or replace function public.seed_event_education_followup_tasks(p_portal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_event_id uuid;
  v_collection_id uuid;
  v_count integer := 0;
begin
  if auth.uid() is null or public.current_app_role() not in ('admin','approver') then raise exception 'Insufficient permissions'; end if;
  select event_id into v_event_id from public.event_guest_portals where id=p_portal_id;
  if v_event_id is null then raise exception 'Portal not found'; end if;
  select id into v_collection_id from public.education_collections where event_id=v_event_id;
  if v_collection_id is null then raise exception 'Education collection not found'; end if;

  insert into public.event_education_followup_tasks(event_id,education_collection_id,task_type,title,due_at)
  values
    (v_event_id,v_collection_id,'collect_source_material','Collect event source material',now()+interval '1 day'),
    (v_event_id,v_collection_id,'prepare_transcript','Prepare event transcript',now()+interval '3 days'),
    (v_event_id,v_collection_id,'prepare_summary','Prepare educational summary',now()+interval '5 days'),
    (v_event_id,v_collection_id,'editorial_review','Editorial review',now()+interval '7 days'),
    (v_event_id,v_collection_id,'publication_review','Foundation publication review',now()+interval '10 days')
  on conflict(event_id,task_type) do nothing;
  get diagnostics v_count = row_count;
  return jsonb_build_object('event_id',v_event_id,'education_collection_id',v_collection_id,'tasks_created',v_count);
end;
$function$;

revoke all on function public.seed_event_education_followup_tasks(uuid) from public;
grant execute on function public.seed_event_education_followup_tasks(uuid) to authenticated;

comment on table public.event_notification_outbox is 'Provider-neutral notification queue for event lifecycle messages. Delivery provider is intentionally decoupled.';
comment on table public.event_education_followup_tasks is 'Automatic post-event Education tasks generated when an event closes.';

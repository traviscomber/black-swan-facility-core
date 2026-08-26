create table if not exists public.inventory_asset_audit_sessions (
  id uuid primary key default gen_random_uuid(),
  audit_code text not null unique,
  warehouse_location_id uuid not null references public.warehouse_locations(id) on delete restrict,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','approved','rejected','closed','cancelled')),
  notes text,
  review_notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz
);

create table if not exists public.inventory_asset_audit_lines (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.inventory_asset_audit_sessions(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete restrict,
  asset_code_snapshot text not null,
  asset_name_snapshot text not null,
  is_expected boolean not null,
  expected_location_id uuid references public.warehouse_locations(id) on delete set null,
  observed_location_id uuid references public.warehouse_locations(id) on delete set null,
  scan_status text not null default 'pending' check (scan_status in ('pending','present','missing','unexpected')),
  condition text check (condition is null or condition in ('good','observations','damaged')),
  notes text,
  scanned_by uuid references auth.users(id) on delete set null,
  scanned_at timestamptz,
  created_at timestamptz not null default now(),
  unique(session_id, asset_id)
);

create unique index if not exists inventory_asset_audit_one_open_per_location_uidx
  on public.inventory_asset_audit_sessions(warehouse_location_id)
  where status in ('in_progress','submitted','approved');
create index if not exists idx_inventory_asset_audit_sessions_location on public.inventory_asset_audit_sessions(warehouse_location_id);
create index if not exists idx_inventory_asset_audit_sessions_created_by on public.inventory_asset_audit_sessions(created_by);
create index if not exists idx_inventory_asset_audit_sessions_submitted_by on public.inventory_asset_audit_sessions(submitted_by) where submitted_by is not null;
create index if not exists idx_inventory_asset_audit_sessions_reviewed_by on public.inventory_asset_audit_sessions(reviewed_by) where reviewed_by is not null;
create index if not exists idx_inventory_asset_audit_sessions_closed_by on public.inventory_asset_audit_sessions(closed_by) where closed_by is not null;
create index if not exists idx_inventory_asset_audit_sessions_status on public.inventory_asset_audit_sessions(status, created_at desc);
create index if not exists idx_inventory_asset_audit_lines_session on public.inventory_asset_audit_lines(session_id);
create index if not exists idx_inventory_asset_audit_lines_asset on public.inventory_asset_audit_lines(asset_id);
create index if not exists idx_inventory_asset_audit_lines_expected_location on public.inventory_asset_audit_lines(expected_location_id) where expected_location_id is not null;
create index if not exists idx_inventory_asset_audit_lines_observed_location on public.inventory_asset_audit_lines(observed_location_id) where observed_location_id is not null;
create index if not exists idx_inventory_asset_audit_lines_scanned_by on public.inventory_asset_audit_lines(scanned_by) where scanned_by is not null;

alter table public.inventory_asset_audit_sessions enable row level security;
alter table public.inventory_asset_audit_lines enable row level security;
revoke all on table public.inventory_asset_audit_sessions from anon, authenticated;
revoke all on table public.inventory_asset_audit_lines from anon, authenticated;
grant select on table public.inventory_asset_audit_sessions to authenticated;
grant select on table public.inventory_asset_audit_lines to authenticated;

create policy inventory_asset_audit_sessions_select_scoped
on public.inventory_asset_audit_sessions for select to authenticated
using (
  public.can_app_action('inventory.process')
  and exists (
    select 1 from public.warehouse_locations wl
    join public.warehouses w on w.id = wl.warehouse_id
    where wl.id = inventory_asset_audit_sessions.warehouse_location_id
      and public.can_access_operational_scope('inventory', w.location_id)
  )
);

create policy inventory_asset_audit_lines_select_scoped
on public.inventory_asset_audit_lines for select to authenticated
using (
  public.can_app_action('inventory.process')
  and exists (
    select 1 from public.inventory_asset_audit_sessions s
    join public.warehouse_locations wl on wl.id = s.warehouse_location_id
    join public.warehouses w on w.id = wl.warehouse_id
    where s.id = inventory_asset_audit_lines.session_id
      and public.can_access_operational_scope('inventory', w.location_id)
  )
);

create or replace function public.create_inventory_asset_audit_session(p_warehouse_location_id uuid, p_notes text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_scope_location uuid;
  v_session_id uuid;
  v_code text;
  v_expected_count integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;

  select w.location_id into v_scope_location
  from public.warehouse_locations wl join public.warehouses w on w.id = wl.warehouse_id
  where wl.id = p_warehouse_location_id and wl.is_active = true and w.is_active = true;
  if not found then raise exception 'Active warehouse location not found'; end if;
  if not public.can_access_operational_scope('inventory', v_scope_location) then raise exception 'Inventory scope required for audit location'; end if;

  if exists (select 1 from public.inventory_asset_audit_sessions s where s.warehouse_location_id = p_warehouse_location_id and s.status in ('in_progress','submitted','approved')) then
    raise exception 'Audit location already has an open asset audit';
  end if;

  v_code := 'IAA-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.inventory_asset_audit_sessions(audit_code, warehouse_location_id, status, notes, created_by)
  values (v_code, p_warehouse_location_id, 'in_progress', nullif(trim(coalesce(p_notes,'')), ''), v_user)
  returning id into v_session_id;

  insert into public.inventory_asset_audit_lines(
    session_id, asset_id, asset_code_snapshot, asset_name_snapshot, is_expected, expected_location_id, scan_status
  )
  select v_session_id, a.id, a.asset_code, a.name, true, p_warehouse_location_id, 'pending'
  from public.assets a
  where a.warehouse_location_id = p_warehouse_location_id
    and coalesce(a.status, 'active') not in ('deprecated','maintenance')
    and nullif(trim(coalesce(a.assigned_to,'')), '') is null
    and not exists (
      select 1 from public.inventory_asset_custodies c where c.asset_id = a.id and c.status = 'active'
    );

  get diagnostics v_expected_count = row_count;
  return jsonb_build_object('session_id', v_session_id, 'audit_code', v_code, 'expected_assets', v_expected_count);
end;
$$;
revoke all on function public.create_inventory_asset_audit_session(uuid,text) from public, anon;
grant execute on function public.create_inventory_asset_audit_session(uuid,text) to authenticated;

create or replace function public.record_inventory_asset_audit_scan(
  p_session_id uuid,
  p_asset_id uuid,
  p_condition text default 'good',
  p_notes text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_session public.inventory_asset_audit_sessions%rowtype;
  v_asset public.assets%rowtype;
  v_scope_location uuid;
  v_asset_scope_location uuid;
  v_line public.inventory_asset_audit_lines%rowtype;
  v_status text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;
  if p_condition not in ('good','observations','damaged') then raise exception 'Invalid asset condition'; end if;

  select * into v_session from public.inventory_asset_audit_sessions where id = p_session_id for update;
  if not found then raise exception 'Asset audit session not found'; end if;
  if v_session.status <> 'in_progress' then raise exception 'Asset audit is not open for scanning'; end if;

  select w.location_id into v_scope_location
  from public.warehouse_locations wl join public.warehouses w on w.id = wl.warehouse_id
  where wl.id = v_session.warehouse_location_id;
  if not public.can_access_operational_scope('inventory', v_scope_location) then raise exception 'Inventory scope required for audit location'; end if;

  select * into v_asset from public.assets where id = p_asset_id for share;
  if not found or v_asset.status = 'deprecated' then raise exception 'Active asset not found'; end if;

  if v_asset.warehouse_location_id is not null then
    select w.location_id into v_asset_scope_location
    from public.warehouse_locations wl join public.warehouses w on w.id = wl.warehouse_id
    where wl.id = v_asset.warehouse_location_id;
    if not public.can_access_operational_scope('inventory', v_asset_scope_location) then raise exception 'Inventory scope required for scanned asset'; end if;
  end if;

  select * into v_line from public.inventory_asset_audit_lines where session_id = v_session.id and asset_id = v_asset.id for update;
  if found and v_line.is_expected then
    update public.inventory_asset_audit_lines
       set scan_status = 'present', observed_location_id = v_session.warehouse_location_id,
           condition = p_condition, notes = nullif(trim(coalesce(p_notes,'')), ''), scanned_by = v_user, scanned_at = now()
     where id = v_line.id;
    v_status := 'present';
  else
    insert into public.inventory_asset_audit_lines(
      session_id, asset_id, asset_code_snapshot, asset_name_snapshot, is_expected,
      expected_location_id, observed_location_id, scan_status, condition, notes, scanned_by, scanned_at
    ) values (
      v_session.id, v_asset.id, v_asset.asset_code, v_asset.name, false,
      v_asset.warehouse_location_id, v_session.warehouse_location_id, 'unexpected', p_condition,
      nullif(trim(coalesce(p_notes,'')), ''), v_user, now()
    )
    on conflict (session_id, asset_id) do update set
      observed_location_id = excluded.observed_location_id,
      scan_status = 'unexpected', condition = excluded.condition, notes = excluded.notes,
      scanned_by = excluded.scanned_by, scanned_at = excluded.scanned_at;
    v_status := 'unexpected';
  end if;

  return jsonb_build_object('asset_id', v_asset.id, 'asset_code', v_asset.asset_code, 'scan_status', v_status);
end;
$$;
revoke all on function public.record_inventory_asset_audit_scan(uuid,uuid,text,text) from public, anon;
grant execute on function public.record_inventory_asset_audit_scan(uuid,uuid,text,text) to authenticated;

create or replace function public.submit_inventory_asset_audit_session(p_session_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_session public.inventory_asset_audit_sessions%rowtype;
  v_scope_location uuid;
  v_missing integer;
  v_unexpected integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;
  select * into v_session from public.inventory_asset_audit_sessions where id = p_session_id for update;
  if not found or v_session.status <> 'in_progress' then raise exception 'Asset audit is not open'; end if;
  select w.location_id into v_scope_location from public.warehouse_locations wl join public.warehouses w on w.id=wl.warehouse_id where wl.id=v_session.warehouse_location_id;
  if not public.can_access_operational_scope('inventory', v_scope_location) then raise exception 'Inventory scope required for audit location'; end if;

  update public.inventory_asset_audit_lines set scan_status='missing' where session_id=v_session.id and is_expected and scan_status='pending';
  select count(*) filter (where scan_status='missing'), count(*) filter (where scan_status='unexpected') into v_missing, v_unexpected from public.inventory_asset_audit_lines where session_id=v_session.id;
  update public.inventory_asset_audit_sessions set status='submitted', submitted_by=v_user, submitted_at=now() where id=v_session.id;
  return jsonb_build_object('missing_assets',v_missing,'unexpected_assets',v_unexpected);
end;
$$;
revoke all on function public.submit_inventory_asset_audit_session(uuid) from public, anon;
grant execute on function public.submit_inventory_asset_audit_session(uuid) to authenticated;

create or replace function public.review_inventory_asset_audit_session(p_session_id uuid, p_approved boolean, p_notes text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_session public.inventory_asset_audit_sessions%rowtype;
  v_scope_location uuid;
  v_state text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if public.current_app_role() not in ('admin','approver') then raise exception 'Inventory approval role required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;
  select * into v_session from public.inventory_asset_audit_sessions where id=p_session_id for update;
  if not found or v_session.status <> 'submitted' then raise exception 'Asset audit is not awaiting review'; end if;
  select w.location_id into v_scope_location from public.warehouse_locations wl join public.warehouses w on w.id=wl.warehouse_id where wl.id=v_session.warehouse_location_id;
  if not public.can_access_operational_scope('inventory',v_scope_location) then raise exception 'Inventory scope required for audit location'; end if;
  v_state := case when p_approved then 'approved' else 'rejected' end;
  update public.inventory_asset_audit_sessions set status=v_state, review_notes=nullif(trim(coalesce(p_notes,'')),''), reviewed_by=v_user, reviewed_at=now() where id=v_session.id;
  return jsonb_build_object('session_id',v_session.id,'status',v_state);
end;
$$;
revoke all on function public.review_inventory_asset_audit_session(uuid,boolean,text) from public, anon;
grant execute on function public.review_inventory_asset_audit_session(uuid,boolean,text) to authenticated;

create or replace function public.close_inventory_asset_audit_session(p_session_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_session public.inventory_asset_audit_sessions%rowtype;
  v_scope_location uuid;
  v_finding record;
  v_findings integer := 0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if public.current_app_role() not in ('admin','approver') then raise exception 'Inventory approval role required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;
  select * into v_session from public.inventory_asset_audit_sessions where id=p_session_id for update;
  if not found or v_session.status <> 'approved' then raise exception 'Only approved asset audits can be closed'; end if;
  select w.location_id into v_scope_location from public.warehouse_locations wl join public.warehouses w on w.id=wl.warehouse_id where wl.id=v_session.warehouse_location_id;
  if not public.can_access_operational_scope('inventory',v_scope_location) then raise exception 'Inventory scope required for audit location'; end if;

  for v_finding in select * from public.inventory_asset_audit_lines where session_id=v_session.id and (scan_status in ('missing','unexpected') or condition in ('observations','damaged')) loop
    insert into public.asset_logs(asset_id,log_type,description,created_by,created_at)
    values (
      v_finding.asset_id,
      case when v_finding.scan_status='missing' then 'physical_audit_missing' when v_finding.scan_status='unexpected' then 'physical_audit_unexpected' else 'physical_audit_condition' end,
      'Asset audit ' || v_session.audit_code || ': ' || v_finding.scan_status || coalesce(' · condition ' || v_finding.condition,'') || coalesce(' · ' || v_finding.notes,''),
      v_user, now()
    );
    v_findings := v_findings + 1;
  end loop;

  update public.inventory_asset_audit_sessions set status='closed',closed_by=v_user,closed_at=now() where id=v_session.id;
  return jsonb_build_object('session_id',v_session.id,'findings_logged',v_findings,'assets_mutated',0);
end;
$$;
revoke all on function public.close_inventory_asset_audit_session(uuid) from public, anon;
grant execute on function public.close_inventory_asset_audit_session(uuid) to authenticated;

create or replace function public.cancel_inventory_asset_audit_session(p_session_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_session public.inventory_asset_audit_sessions%rowtype;
  v_scope_location uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Cancellation reason is required'; end if;
  select * into v_session from public.inventory_asset_audit_sessions where id=p_session_id for update;
  if not found or v_session.status not in ('in_progress','submitted') then raise exception 'Asset audit cannot be cancelled in its current state'; end if;
  select w.location_id into v_scope_location from public.warehouse_locations wl join public.warehouses w on w.id=wl.warehouse_id where wl.id=v_session.warehouse_location_id;
  if not public.can_access_operational_scope('inventory',v_scope_location) then raise exception 'Inventory scope required for audit location'; end if;
  update public.inventory_asset_audit_sessions set status='cancelled', review_notes=trim(p_reason), reviewed_by=v_user, reviewed_at=now() where id=v_session.id;
  return jsonb_build_object('session_id',v_session.id,'status','cancelled');
end;
$$;
revoke all on function public.cancel_inventory_asset_audit_session(uuid,text) from public, anon;
grant execute on function public.cancel_inventory_asset_audit_session(uuid,text) to authenticated;

comment on table public.inventory_asset_audit_sessions is 'Physical audit sessions for serialized inventory assets. Findings never mutate asset location automatically.';
comment on table public.inventory_asset_audit_lines is 'Snapshot and scan evidence for serialized asset audits: expected, present, missing, or unexpected.';

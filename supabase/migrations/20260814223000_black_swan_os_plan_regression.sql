-- Black Swan OS: final regression gate for Ed request plan 1-10.
-- Read-only assertions only; this migration does not seed or mutate operational source data.

do $regression$
declare
  v_def text;
  v_count integer;
  v_public_execute boolean;
  v_corp uuid;
  v_infra uuid;
  v_agricola uuid;
  v_blue uuid;
begin
  select id into v_corp from public.legal_entities where code='BS_CORPORACION' and is_active;
  select id into v_infra from public.legal_entities where code='BS_INFRA' and is_active;
  select id into v_agricola from public.legal_entities where code='AGRICOLA' and is_active;
  select id into v_blue from public.legal_entities where code='BLUE_MARBLE' and is_active;

  if v_corp is null or v_infra is null or v_agricola is null or v_blue is null then
    raise exception 'REGRESSION: four canonical legal entities must exist';
  end if;

  -- Plan 1: People Graph must keep Guests beneath Members and gate guest access on Member presence.
  select pg_get_functiondef('public.can_guest_enter(uuid,timestamptz)'::regprocedure) into v_def;
  if position('is_member_on_ground' in v_def)=0 then
    raise exception 'REGRESSION: guest access must depend on inviting member presence';
  end if;
  select pg_get_functiondef('public.create_member_guest_invitation(uuid,text,timestamptz,timestamptz,uuid,uuid)'::regprocedure) into v_def;
  if position('inviting_member_id' in v_def)=0 or position('guest_invitations' in v_def)=0 then
    raise exception 'REGRESSION: guest invitation must remain Member-linked';
  end if;

  -- Plan 2/3: Every newly created event must create Member linkage and Education collection atomically.
  select pg_get_functiondef('public.create_member_operational_event(uuid,text,date,date,text,text)'::regprocedure) into v_def;
  if position('event_member_roles' in v_def)=0 or position('education_collections' in v_def)=0 then
    raise exception 'REGRESSION: Member event creation must also create Member role and Education collection';
  end if;

  -- Plan 3/6: Foundation publication cannot bypass approved/public Education source.
  select pg_get_functiondef('public.validate_foundation_publication_material()'::regprocedure) into v_def;
  if position('approved' in v_def)=0 or position('public' in v_def)=0 then
    raise exception 'REGRESSION: publication guard must require approved public education material';
  end if;

  -- Plan 4: Orchard + Kitchen remains one Corporacion operating domain.
  select count(*) into v_count
  from public.corporacion_operating_domains d
  where d.legal_entity_id=v_corp and d.code='ORCHARD_KITCHEN' and d.is_active;
  if v_count<>1 then raise exception 'REGRESSION: ORCHARD_KITCHEN operating domain must exist exactly once'; end if;

  -- Plan 5: Event providers must remain supplier-backed.
  if not exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name and ccu.constraint_schema=tc.constraint_schema
    where tc.table_schema='public' and tc.table_name='event_service_provider_profiles'
      and tc.constraint_type='FOREIGN KEY' and ccu.table_name='suppliers'
  ) then raise exception 'REGRESSION: event service provider profiles must remain supplier-backed'; end if;

  -- Plan 7: canonical imports must preserve source rows and never infer company assignments on staging.
  select pg_get_functiondef('public.stage_canonical_import(text,text,jsonb)'::regprocedure) into v_def;
  if position('raw_payload' in v_def)=0 or position('unresolved' in v_def)=0 then
    raise exception 'REGRESSION: source imports must preserve raw rows and begin unresolved';
  end if;
  if position('legal_entity_id' in v_def)>0 or position('matched_employee_id' in v_def)>0 or position('matched_stock_item_id' in v_def)>0 then
    raise exception 'REGRESSION: staging must not infer canonical legal entity or record matches';
  end if;

  select pg_get_functiondef('public.apply_canonical_import_batch(uuid)'::regprocedure) into v_def;
  if position('approved' in v_def)=0 or position('unresolved' in v_def)=0 or position('ambiguous' in v_def)=0 then
    raise exception 'REGRESSION: canonical import apply must require approval and resolved rows';
  end if;

  -- Plan 8: intercompany rules created through OS remain draft until real commercial terms are approved.
  select pg_get_functiondef('public.save_intercompany_draft_rule(text,uuid,uuid,text,text,text,date,numeric,numeric,text,text,text)'::regprocedure) into v_def;
  if position('''draft''' in v_def)=0 then raise exception 'REGRESSION: OS intercompany rule creation must be draft-only'; end if;

  -- Plan 9: Audit Center must be explicitly admin-only.
  select pg_get_functiondef('public.get_black_swan_audit_center()'::regprocedure) into v_def;
  if position('current_app_role' in v_def)=0 or position('admin' in v_def)=0 then
    raise exception 'REGRESSION: Audit Center must remain admin-gated';
  end if;

  -- Plan 10: server navigation must use canonical role/entity/member boundaries, never JWT metadata.
  select pg_get_functiondef('public.get_black_swan_os_navigation()'::regprocedure) into v_def;
  if position('current_app_role' in v_def)=0 or position('can_access_legal_entity' in v_def)=0 or position('member_auth_links' in v_def)=0 then
    raise exception 'REGRESSION: OS navigation must use canonical server authorization';
  end if;
  if position('app_metadata' in lower(v_def))>0 or position('jwt' in lower(v_def))>0 then
    raise exception 'REGRESSION: OS navigation must not use JWT/app_metadata role inference';
  end if;

  -- Member Financials: only Infra + Corporacion can be added through Member transparency path.
  select pg_get_functiondef('public.can_view_financial_report(uuid)'::regprocedure) into v_def;
  if position('BS_INFRA' in v_def)=0 or position('BS_CORPORACION' in v_def)=0 then
    raise exception 'REGRESSION: Member finance transparency must include Infra + Corporacion';
  end if;
  if position('AGRICOLA' in v_def)>0 or position('BLUE_MARBLE' in v_def)>0 then
    raise exception 'REGRESSION: Member finance transparency must not include Agricola or Blue Marble';
  end if;

  -- Curated HR must never expose phone/email/payroll/private fields.
  select pg_get_functiondef('public.get_entity_hr_transparency(uuid)'::regprocedure) into v_def;
  if position('e.email' in lower(v_def))>0 or position('e.phone' in lower(v_def))>0 or position('salary' in lower(v_def))>0 or position('payroll' in lower(v_def))>0 then
    raise exception 'REGRESSION: Member HR transparency must not expose private HR/payroll fields';
  end if;

  -- Sensitive OS actions must not be executable by PUBLIC/anon.
  select bool_or(has_function_privilege('public', p.oid, 'EXECUTE')) into v_public_execute
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in (
    'set_member_ground_presence','create_member_guest_invitation','create_member_operational_event',
    'add_event_education_material','review_education_material','record_orchard_kitchen_cost',
    'assign_orchard_kitchen_responsibility','register_event_service_provider','engage_event_service_provider',
    'create_foundation_publication_draft','review_foundation_publication','stage_canonical_import',
    'resolve_canonical_import_row','apply_canonical_import_batch','review_canonical_import_batch',
    'save_intercompany_draft_rule','get_black_swan_audit_center'
  );
  if coalesce(v_public_execute,false) then raise exception 'REGRESSION: sensitive OS functions must not be PUBLIC executable'; end if;

  select bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')) into v_public_execute
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in (
    'set_member_ground_presence','create_member_guest_invitation','create_member_operational_event',
    'add_event_education_material','review_education_material','record_orchard_kitchen_cost',
    'assign_orchard_kitchen_responsibility','register_event_service_provider','engage_event_service_provider',
    'create_foundation_publication_draft','review_foundation_publication','stage_canonical_import',
    'resolve_canonical_import_row','apply_canonical_import_batch','review_canonical_import_batch',
    'save_intercompany_draft_rule','get_black_swan_audit_center'
  );
  if coalesce(v_public_execute,false) then raise exception 'REGRESSION: sensitive OS functions must not be anon executable'; end if;

  -- Blue Marble remains intentionally limited to Accounting + Legal only.
  select count(*) into v_count
  from public.entity_departments d where d.legal_entity_id=v_blue and d.is_active;
  if v_count<>2 or not exists(select 1 from public.entity_departments where legal_entity_id=v_blue and code='ACCOUNTING' and is_active)
    or not exists(select 1 from public.entity_departments where legal_entity_id=v_blue and code='LEGAL' and is_active) then
    raise exception 'REGRESSION: Blue Marble must have only Accounting and Legal';
  end if;
end;
$regression$;

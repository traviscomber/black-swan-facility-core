-- Read-only regression gate for the Black Swan Corporacion member lifecycle.
-- Run after applying 20260814135500_add_member_guest_event_education_foundation.sql.

DO $$
DECLARE
  v_missing integer;
  v_bad_members integer;
  v_open_presence_dupes integer;
  v_unlinked_new_events integer;
BEGIN
  select count(*) into v_missing
  from (values
    ('members'),
    ('member_presence'),
    ('guest_invitations'),
    ('event_member_roles'),
    ('education_collections'),
    ('education_materials'),
    ('foundation_publications')
  ) expected(table_name)
  where to_regclass('public.' || expected.table_name) is null;

  if v_missing <> 0 then
    raise exception 'Member lifecycle regression: expected tables are missing';
  end if;

  select count(*) into v_bad_members
  from public.members m
  join public.legal_entities le on le.id = m.legal_entity_id
  where le.code <> 'BS_CORPORACION';

  if v_bad_members <> 0 then
    raise exception 'Member lifecycle regression: members must belong to BS_CORPORACION';
  end if;

  select count(*) into v_open_presence_dupes
  from (
    select member_id
    from public.member_presence
    where status = 'on_ground' and checked_out_at is null
    group by member_id
    having count(*) > 1
  ) q;

  if v_open_presence_dupes <> 0 then
    raise exception 'Member lifecycle regression: duplicate open on-ground sessions found';
  end if;

  -- Existing operational events predate the member model. This gate only flags
  -- events created after the foundation migration if they have no member role.
  select count(*) into v_unlinked_new_events
  from public.operational_events e
  where e.created_at >= timestamptz '2026-08-14 12:55:00+00'
    and not exists (
      select 1 from public.event_member_roles emr where emr.event_id = e.id
    );

  if v_unlinked_new_events <> 0 then
    raise exception 'Member lifecycle regression: new Foundation events require at least one member relationship';
  end if;
END $$;

-- Guest access must fail closed unless invitation is valid and member is on ground,
-- or an explicit audited override exists. The function must reference the presence gate.
DO $$
DECLARE
  v_def text;
BEGIN
  select pg_get_functiondef('public.can_guest_enter(uuid,timestamptz)'::regprocedure)
  into v_def;

  if v_def not ilike '%is_member_on_ground%' then
    raise exception 'Member lifecycle regression: guest access no longer depends on member presence';
  end if;

  if v_def not ilike '%approved_override%' then
    raise exception 'Member lifecycle regression: audited override path missing';
  end if;
END $$;

-- No publication may bypass educational approval/public classification.
DO $$
DECLARE
  v_trigger_count integer;
BEGIN
  select count(*) into v_trigger_count
  from pg_trigger
  where tgrelid = 'public.foundation_publications'::regclass
    and tgname = 'foundation_publication_material_guard'
    and not tgisinternal;

  if v_trigger_count <> 1 then
    raise exception 'Member lifecycle regression: publication guard trigger missing';
  end if;
END $$;

-- New member-domain tables must have RLS enabled.
DO $$
DECLARE
  v_rls_missing integer;
BEGIN
  select count(*) into v_rls_missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'members','member_presence','guest_invitations','event_member_roles',
      'education_collections','education_materials','foundation_publications'
    )
    and not c.relrowsecurity;

  if v_rls_missing <> 0 then
    raise exception 'Member lifecycle regression: RLS missing from one or more tables';
  end if;
END $$;
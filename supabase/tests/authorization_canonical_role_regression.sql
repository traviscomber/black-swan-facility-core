-- Black Swan OS authorization regression gate
-- Read-only assertions. Intended to run after the Phase 1 migrations on a
-- Supabase development/preview database before production promotion.

begin;

-- Every current authenticated user must have a canonical access profile.
do $test$
begin
  if exists (
    select 1
    from auth.users u
    left join public.user_access_profiles p on p.user_id = u.id
    where p.user_id is null
  ) then
    raise exception 'AUTH REGRESSION: one or more auth.users rows lack user_access_profiles';
  end if;
end;
$test$;

-- current_app_role must not fall back to JWT role metadata.
do $test$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid)
  into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname='current_app_role' and p.prokind='f'
  limit 1;

  if v_def is null then
    raise exception 'AUTH REGRESSION: current_app_role() not found';
  end if;

  if v_def ilike '%procurement_role%' then
    raise exception 'AUTH REGRESSION: current_app_role() still contains procurement_role JWT fallback';
  end if;
end;
$test$;

-- High-risk RPCs migrated during Phase 1 must use canonical authorization,
-- never direct procurement_role reads.
do $test$
declare
  v_name text;
  v_def text;
  v_targets text[] := array[
    'create_reservation_atomic',
    'create_walk_in_reservation',
    'check_in_or_queue',
    'add_reservation_financial_adjustment',
    'reverse_reservation_payment',
    'void_reservation_financial_adjustment',
    'execute_bulk_update',
    'restore_bulk_operation_state',
    'create_operational_task_atomic',
    'update_operational_task_atomic',
    'add_task_comment',
    'register_task_evidence',
    'guided_check_in',
    'handle_booking_exception',
    'link_reservation_guest',
    'record_booking_message',
    'update_booking_message_status',
    'schedule_stayover_housekeeping',
    'create_reservation_invoice',
    'generate_reservation_invoice',
    'get_booking_financial_readiness',
    'get_reservation_final_invoice',
    'get_reservation_folio',
    'upsert_booking_extra',
    'add_reservation_service',
    'update_reservation_service_status',
    'book_reservation_activity',
    'update_reservation_activity_status',
    'confirm_vehicle_classification',
    'review_fuel_consumption',
    'start_procurement_quotation',
    'build_procurement_comparison',
    'approve_procurement_comparison',
    'procurement_approval_limit_clp'
  ];
begin
  foreach v_name in array v_targets loop
    select string_agg(pg_get_functiondef(p.oid), E'\n--- overload ---\n')
    into v_def
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=v_name and p.prokind='f';

    if v_def is null then
      raise exception 'AUTH REGRESSION: expected function % not found', v_name;
    end if;

    if v_name <> 'procurement_approval_limit_clp' and v_def ilike '%procurement_role%' then
      raise exception 'AUTH REGRESSION: function % still reads procurement_role directly', v_name;
    end if;

    if v_name = 'procurement_approval_limit_clp'
       and v_def ilike '%procurement_role%'
       and v_def not ilike '%procurement_approval_limit_clp%' then
      raise exception 'AUTH REGRESSION: procurement approval helper has unexpected legacy role dependency';
    end if;
  end loop;
end;
$test$;

-- Canonical role function should not be executable by anon/public.
do $test$
begin
  if has_function_privilege('anon', 'public.current_app_role()', 'EXECUTE') then
    raise exception 'AUTH REGRESSION: anon can execute current_app_role()';
  end if;
end;
$test$;

rollback;

-- Stage 4: repeatable canonical-data drift and reconciliation health.
-- Read-only. No canonical rows are modified by this function.

create or replace function public.get_canonical_data_health(p_location_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := public.current_app_role();
  v_user uuid := auth.uid();
  v_has_scopes boolean := false;
  v_scope_filter uuid := p_location_id;
  v_reservation_scope_drift integer := 0;
  v_invalid_dates integer := 0;
  v_payment_projection_drift integer := 0;
  v_import_without_lineage integer := 0;
  v_deterministic_unresolved integer := 0;
  v_candidate integer := 0;
  v_manual_review integer := 0;
  v_detached_payments integer := 0;
  v_detached_invoices integer := 0;
  v_status text;
begin
  if v_user is null and coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Authentication required';
  end if;

  if coalesce(auth.role(),'') <> 'service_role' and v_role not in ('admin','approver') then
    raise exception 'Canonical data health access denied';
  end if;

  if coalesce(auth.role(),'') <> 'service_role' then
    select exists(
      select 1 from public.user_operational_scopes s
      where s.user_id=v_user and s.is_active
    ) into v_has_scopes;

    -- A scoped user may never request a global aggregate because that would leak
    -- counts outside the locations they are allowed to inspect.
    if v_has_scopes and v_scope_filter is null then
      raise exception 'A location is required for scoped data-health access';
    end if;

    if v_scope_filter is not null
       and not public.can_access_operational_scope('booking',v_scope_filter) then
      raise exception 'Location outside operational scope';
    end if;
  end if;

  select count(*) into v_reservation_scope_drift
  from public.reservations r
  left join public.beds b on b.id=r.bed_id
  left join public.rooms rm on rm.id=coalesce(b.room_id,r.room_id)
  where (v_scope_filter is null or r.location_id=v_scope_filter)
    and (
      (r.bed_id is not null and b.id is null)
      or (b.id is not null and r.room_id is distinct from b.room_id)
      or (rm.id is not null and r.location_id is distinct from rm.location_id)
    );

  select count(*) into v_invalid_dates
  from public.reservations r
  where (v_scope_filter is null or r.location_id=v_scope_filter)
    and (r.check_in is null or r.check_out is null or r.check_out<=r.check_in);

  select count(*) into v_payment_projection_drift
  from public.reservations r
  where (v_scope_filter is null or r.location_id=v_scope_filter)
    and r.payment_status is distinct from (public.get_reservation_folio(r.id) #>> '{summary,paymentStatus}');

  select count(*) into v_import_without_lineage
  from public.reservations r
  where (v_scope_filter is null or r.location_id=v_scope_filter)
    and r.source='canonical_event_xls'
    and r.source_participant_id is null;

  select
    count(*) filter (where q.reconciliation_status='deterministic'),
    count(*) filter (where q.reconciliation_status='candidate'),
    count(*) filter (where q.reconciliation_status='manual_review')
  into v_deterministic_unresolved,v_candidate,v_manual_review
  from public.hospitality_import_reconciliation_queue q
  join public.reservations r on r.id=q.reservation_id
  where v_scope_filter is null or r.location_id=v_scope_filter;

  select count(*) into v_detached_payments
  from public.payments p
  where p.reservation_id is null;

  select count(*) into v_detached_invoices
  from public.invoices i
  where i.reservation_id is null;

  v_status := case
    when v_reservation_scope_drift>0 or v_invalid_dates>0 or v_payment_projection_drift>0 then 'critical'
    when v_import_without_lineage>0 or v_deterministic_unresolved>0 or v_detached_payments>0 or v_detached_invoices>0 then 'warning'
    else 'healthy'
  end;

  return jsonb_build_object(
    'status',v_status,
    'locationId',v_scope_filter,
    'checks',jsonb_build_object(
      'reservationScopeDrift',v_reservation_scope_drift,
      'invalidReservationDates',v_invalid_dates,
      'paymentProjectionDrift',v_payment_projection_drift,
      'canonicalEventReservationsWithoutLineage',v_import_without_lineage,
      'deterministicReconciliationPending',v_deterministic_unresolved,
      'candidateReconciliationPending',v_candidate,
      'manualReviewPending',v_manual_review,
      'detachedPayments',v_detached_payments,
      'detachedInvoices',v_detached_invoices
    ),
    'interpretation',jsonb_build_object(
      'critical','canonical invariant drift requiring immediate investigation',
      'warning','known reconciliation or historical exception requiring explicit handling',
      'healthy','no critical drift and no known pending historical exception'
    ),
    'executedAt',now()
  );
end;
$$;

revoke all on function public.get_canonical_data_health(uuid) from public,anon;
grant execute on function public.get_canonical_data_health(uuid) to authenticated,service_role;

comment on function public.get_canonical_data_health(uuid) is
'Read-only Stage 4 canonical-data health report. Scoped users must provide an allowed location; global aggregates are limited to unscoped admin/approver or service_role.';

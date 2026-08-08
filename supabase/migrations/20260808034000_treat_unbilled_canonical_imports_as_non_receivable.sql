-- Legacy canonical_event_xls reservations carry imported informational amounts.
-- They must not become receivables unless canonical financial evidence exists.

create or replace function public.get_reservation_folio(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'procurement_role', '');
  v_reservation public.reservations%rowtype;
  v_lodging numeric := 0;
  v_services_subtotal numeric := 0;
  v_services_tax numeric := 0;
  v_services_total numeric := 0;
  v_fees numeric := 0;
  v_discounts numeric := 0;
  v_credits numeric := 0;
  v_refunds numeric := 0;
  v_payments numeric := 0;
  v_gross numeric := 0;
  v_balance numeric := 0;
  v_payment_status text;
  v_has_financial_evidence boolean := false;
begin
  if auth.role() <> 'service_role' and v_role not in ('admin','approver') then
    raise exception 'No autorizado para consultar folios';
  end if;

  select * into v_reservation
  from public.reservations
  where id = p_reservation_id;

  if not found then
    raise exception 'Reserva no encontrada';
  end if;

  select exists (
    select 1 from public.invoices i where i.reservation_id = p_reservation_id
    union all
    select 1 from public.payments p where p.reservation_id = p_reservation_id
    union all
    select 1 from public.reservation_financial_adjustments a where a.reservation_id = p_reservation_id and a.voided_at is null
    union all
    select 1 from public.reservation_extras re where re.reservation_id = p_reservation_id and re.service_status <> 'cancelled'
  ) into v_has_financial_evidence;

  v_lodging := case
    when v_reservation.source = 'canonical_event_xls' and not v_has_financial_evidence then 0
    else coalesce(v_reservation.total_amount, 0)
  end;

  select
    coalesce(sum(quantity * unit_price),0),
    coalesce(sum((quantity * unit_price) * tax_rate / 100),0),
    coalesce(sum(coalesce(total_amount, (quantity * unit_price) * (1 + tax_rate / 100))),0)
  into v_services_subtotal, v_services_tax, v_services_total
  from public.reservation_extras
  where reservation_id = p_reservation_id and service_status <> 'cancelled';

  select
    coalesce(sum(amount) filter (where adjustment_type='fee' and voided_at is null),0),
    coalesce(sum(amount) filter (where adjustment_type='discount' and voided_at is null),0),
    coalesce(sum(amount) filter (where adjustment_type='credit' and voided_at is null),0),
    coalesce(sum(amount) filter (where adjustment_type='refund' and voided_at is null),0)
  into v_fees, v_discounts, v_credits, v_refunds
  from public.reservation_financial_adjustments
  where reservation_id = p_reservation_id;

  select coalesce(sum(amount),0)
  into v_payments
  from public.payments
  where reservation_id = p_reservation_id
    and payment_status in ('paid','completed','succeeded')
    and reversed_at is null;

  v_gross := v_lodging + v_services_total + v_fees - v_discounts - v_credits;
  v_balance := greatest(v_gross - v_payments + v_refunds, 0);
  v_payment_status := case
    when v_gross <= 0 then 'not_required'
    when v_balance <= 0 then 'paid'
    when v_payments > 0 then 'partial'
    else 'pending'
  end;

  return jsonb_build_object(
    'reservation', jsonb_build_object(
      'id', v_reservation.id,
      'guestName', v_reservation.guest_name,
      'checkIn', v_reservation.check_in,
      'checkOut', v_reservation.check_out,
      'status', v_reservation.status,
      'paymentStatus', v_payment_status
    ),
    'summary', jsonb_build_object(
      'lodging', v_lodging,
      'servicesSubtotal', v_services_subtotal,
      'servicesTax', v_services_tax,
      'servicesTotal', v_services_total,
      'fees', v_fees,
      'discounts', v_discounts,
      'credits', v_credits,
      'refunds', v_refunds,
      'grossTotal', v_gross,
      'payments', v_payments,
      'balance', v_balance,
      'paymentStatus', v_payment_status
    ),
    'services', coalesce((
      select jsonb_agg(to_jsonb(re) order by re.created_at desc)
      from public.reservation_extras re
      where re.reservation_id=p_reservation_id and re.service_status <> 'cancelled'
    ), '[]'::jsonb),
    'adjustments', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at desc)
      from public.reservation_financial_adjustments a
      where a.reservation_id=p_reservation_id
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(to_jsonb(p) order by coalesce(p.paid_at,p.created_at) desc)
      from public.payments p
      where p.reservation_id=p_reservation_id
    ), '[]'::jsonb)
  );
end;
$function$;
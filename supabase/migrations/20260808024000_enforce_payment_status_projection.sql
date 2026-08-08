-- Stage 5: reservations.payment_status is a projection of the canonical payments ledger.
-- Direct client edits must never manufacture a paid/pending state without a real payment.

create or replace function public.sync_reservation_payment_status(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_folio jsonb;
  v_status text;
begin
  v_folio := public.get_reservation_folio(p_reservation_id);
  v_status := v_folio #>> '{summary,paymentStatus}';
  perform set_config('app.payment_projection_writer','ledger_sync',true);
  update public.reservations set payment_status=v_status where id=p_reservation_id;
end;
$function$;

create or replace function public.guard_reservation_payment_status_projection()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  if new.payment_status is distinct from old.payment_status
     and coalesce(auth.role(),'') <> 'service_role'
     and current_setting('app.payment_projection_writer',true) <> 'ledger_sync' then
    raise exception using
      errcode='P0001',
      message='El estado de pago se calcula desde el ledger. Registre o revierta un pago en lugar de editar payment_status.';
  end if;
  return new;
end;
$function$;

revoke all on function public.guard_reservation_payment_status_projection() from public,anon,authenticated;
grant execute on function public.guard_reservation_payment_status_projection() to service_role;

drop trigger if exists reservations_guard_payment_status_projection on public.reservations;
create trigger reservations_guard_payment_status_projection
before update of payment_status on public.reservations
for each row execute function public.guard_reservation_payment_status_projection();

comment on column public.reservations.payment_status is
'Derived projection from the canonical payments/adjustments folio. Direct authenticated edits are rejected; use ledger write paths.';

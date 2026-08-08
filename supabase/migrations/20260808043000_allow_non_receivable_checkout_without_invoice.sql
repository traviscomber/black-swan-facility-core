-- A final invoice is mandatory only when a reservation has a financial receivable.
-- payment_status is a guarded ledger projection; not_required means there is no
-- canonical amount to collect and checkout must not manufacture an invoice.

create or replace function public.validate_checkout_financial_close()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_invoice public.invoices%rowtype;
begin
  if new.status in ('checked_out','checked-out')
     and old.status not in ('checked_out','checked-out')
     and coalesce(new.payment_status, 'pending') <> 'not_required' then
    select * into v_invoice
    from public.invoices
    where reservation_id = new.id
      and finalized_at is not null
      and voided_at is null
    order by finalized_at desc
    limit 1;

    if not found then
      raise exception 'Debe generar la factura final antes del check-out';
    end if;

    if coalesce(v_invoice.balance_due, 0) > 0 then
      raise exception 'No se puede completar el check-out: saldo pendiente %', v_invoice.balance_due;
    end if;
  end if;

  return new;
end;
$function$;
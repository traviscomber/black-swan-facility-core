-- Canonical invoice payment lifecycle with atomic reconciliation.

begin;

alter table public.invoice_payments
  add column if not exists idempotency_key text,
  drop constraint if exists invoice_payments_amount_clp,
  add constraint invoice_payments_amount_clp
    check (amount > 0 and amount = trunc(amount));

create unique index if not exists invoice_payments_idempotency_key_idx
  on public.invoice_payments (idempotency_key)
  where idempotency_key is not null;

create or replace function public.register_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_idempotency_key text,
  p_transaction_id text default null,
  p_notes text default null,
  p_payment_date timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_payment public.invoice_payments%rowtype;
  v_paid numeric;
  v_balance numeric;
  v_status text;
  v_created_by uuid;
  v_created boolean := false;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Authentication required';
  end if;

  if p_invoice_id is null then
    raise exception 'invoice_id is required';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount <> trunc(p_amount) then
    raise exception 'amount must be a positive integer CLP value';
  end if;

  if nullif(btrim(p_payment_method), '') is null then
    raise exception 'payment_method is required';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'idempotency_key is required';
  end if;

  select *
  into v_payment
  from public.invoice_payments
  where idempotency_key = p_idempotency_key
  limit 1;

  if found then
    select * into v_invoice from public.invoices where id = v_payment.invoice_id;
    return jsonb_build_object(
      'created', false,
      'payment', to_jsonb(v_payment),
      'invoice', to_jsonb(v_invoice),
      'balance', greatest(v_invoice.total_amount - v_invoice.amount_paid, 0)
    );
  end if;

  select *
  into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice not found';
  end if;

  if coalesce(v_invoice.status, 'draft') in ('void', 'cancelled') then
    raise exception 'Cannot pay a void or cancelled invoice';
  end if;

  v_paid := coalesce(v_invoice.amount_paid, 0);
  v_balance := v_invoice.total_amount - v_paid;

  if p_amount > v_balance then
    raise exception 'Payment exceeds outstanding balance';
  end if;

  select e.id
  into v_created_by
  from public.employees e
  where lower(e.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and coalesce(e.is_active, true)
  order by e.created_at
  limit 1;

  insert into public.invoice_payments (
    invoice_id,
    amount,
    payment_method,
    transaction_id,
    payment_date,
    notes,
    created_by,
    idempotency_key
  ) values (
    p_invoice_id,
    p_amount,
    btrim(p_payment_method),
    nullif(btrim(p_transaction_id), ''),
    coalesce(p_payment_date, now()),
    nullif(btrim(p_notes), ''),
    v_created_by,
    btrim(p_idempotency_key)
  )
  on conflict (idempotency_key) where idempotency_key is not null do nothing
  returning * into v_payment;

  if not found then
    select * into v_payment
    from public.invoice_payments
    where idempotency_key = p_idempotency_key;
  else
    v_created := true;
  end if;

  select coalesce(sum(ip.amount), 0)
  into v_paid
  from public.invoice_payments ip
  where ip.invoice_id = p_invoice_id;

  v_balance := greatest(v_invoice.total_amount - v_paid, 0);
  v_status := case
    when v_paid >= v_invoice.total_amount then 'paid'
    when v_paid > 0 then 'partial'
    when v_invoice.due_date < current_date then 'overdue'
    else 'pending'
  end;

  update public.invoices
  set amount_paid = v_paid,
      payment_status = v_status,
      payment_date = case when v_status = 'paid' then coalesce(p_payment_date, now()) else payment_date end,
      payment_method = case when v_status = 'paid' then btrim(p_payment_method) else payment_method end,
      status = case when v_status = 'paid' then 'paid' when status = 'draft' then 'sent' else status end,
      updated_at = now(),
      updated_by = coalesce(v_created_by, updated_by)
  where id = p_invoice_id
  returning * into v_invoice;

  if v_invoice.reservation_id is not null then
    update public.reservations
    set payment_status = v_status
    where id = v_invoice.reservation_id;
  end if;

  return jsonb_build_object(
    'created', v_created,
    'payment', to_jsonb(v_payment),
    'invoice', to_jsonb(v_invoice),
    'balance', v_balance
  );
end;
$$;

create or replace function public.refresh_invoice_payment_status(p_invoice_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_paid numeric;
  v_status text;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Authentication required';
  end if;

  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;

  select coalesce(sum(amount), 0) into v_paid
  from public.invoice_payments where invoice_id = p_invoice_id;

  v_status := case
    when coalesce(v_invoice.status, 'draft') in ('void', 'cancelled') then v_invoice.payment_status
    when v_paid >= v_invoice.total_amount then 'paid'
    when v_paid > 0 then 'partial'
    when v_invoice.due_date < current_date then 'overdue'
    else 'pending'
  end;

  update public.invoices
  set amount_paid = v_paid,
      payment_status = v_status,
      updated_at = now()
  where id = p_invoice_id
  returning * into v_invoice;

  if v_invoice.reservation_id is not null and coalesce(v_invoice.status, 'draft') not in ('void', 'cancelled') then
    update public.reservations set payment_status = v_status where id = v_invoice.reservation_id;
  end if;

  return to_jsonb(v_invoice);
end;
$$;

drop policy if exists "Authenticated users manage invoice payments" on public.invoice_payments;
drop policy if exists "Authenticated users read invoice payments" on public.invoice_payments;
create policy "Authenticated users read invoice payments"
on public.invoice_payments
for select
to authenticated
using (true);

revoke all on function public.register_invoice_payment(uuid, numeric, text, text, text, text, timestamptz) from public;
revoke execute on function public.register_invoice_payment(uuid, numeric, text, text, text, text, timestamptz) from anon;
grant execute on function public.register_invoice_payment(uuid, numeric, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.register_invoice_payment(uuid, numeric, text, text, text, text, timestamptz) to service_role;

revoke all on function public.refresh_invoice_payment_status(uuid) from public;
revoke execute on function public.refresh_invoice_payment_status(uuid) from anon;
grant execute on function public.refresh_invoice_payment_status(uuid) to authenticated;
grant execute on function public.refresh_invoice_payment_status(uuid) to service_role;

commit;

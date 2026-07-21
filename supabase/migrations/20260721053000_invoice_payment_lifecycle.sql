-- Canonical invoice payment lifecycle with atomic reconciliation and read-only financial tables.

begin;

alter table public.invoice_payments
  add column if not exists idempotency_key text,
  drop constraint if exists invoice_payments_amount_clp,
  drop constraint if exists invoice_payments_idempotency_key_length,
  add constraint invoice_payments_amount_clp
    check (amount > 0 and amount = trunc(amount)),
  add constraint invoice_payments_idempotency_key_length
    check (idempotency_key is null or char_length(idempotency_key) between 8 and 200);

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
  v_paid numeric := 0;
  v_balance numeric := 0;
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

  if nullif(btrim(p_idempotency_key), '') is null
    or char_length(btrim(p_idempotency_key)) not between 8 and 200 then
    raise exception 'idempotency_key must contain between 8 and 200 characters';
  end if;

  select *
  into v_payment
  from public.invoice_payments
  where idempotency_key = btrim(p_idempotency_key)
  limit 1;

  if found then
    if v_payment.invoice_id <> p_invoice_id
      or v_payment.amount <> p_amount
      or v_payment.payment_method <> btrim(p_payment_method) then
      raise exception 'idempotency_key payload mismatch';
    end if;

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

  select coalesce(sum(ip.amount), 0)
  into v_paid
  from public.invoice_payments ip
  where ip.invoice_id = p_invoice_id;

  v_balance := v_invoice.total_amount - v_paid;

  if v_balance <= 0 then
    raise exception 'Invoice has no outstanding balance';
  end if;

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

  if found then
    v_created := true;
  else
    select * into v_payment
    from public.invoice_payments
    where idempotency_key = btrim(p_idempotency_key);

    if v_payment.invoice_id <> p_invoice_id
      or v_payment.amount <> p_amount
      or v_payment.payment_method <> btrim(p_payment_method) then
      raise exception 'idempotency_key payload mismatch';
    end if;
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
      status = case when v_status = 'paid' then 'paid' when status = 'draft' and v_paid > 0 then 'sent' else status end,
      updated_at = now()
  where id = p_invoice_id
  returning * into v_invoice;

  if v_invoice.reservation_id is not null and coalesce(v_invoice.status, 'draft') not in ('void', 'cancelled') then
    update public.reservations set payment_status = v_status where id = v_invoice.reservation_id;
  end if;

  return to_jsonb(v_invoice);
end;
$$;

create or replace function public.set_invoice_lifecycle(
  p_invoice_id uuid,
  p_status text default null,
  p_due_date date default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_next_status text;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Authentication required';
  end if;

  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;

  v_next_status := coalesce(nullif(btrim(p_status), ''), v_invoice.status);

  if v_next_status not in ('draft', 'sent', 'void', 'cancelled') then
    raise exception 'Unsupported invoice status transition';
  end if;

  if v_invoice.status in ('paid', 'void', 'cancelled') and v_next_status <> v_invoice.status then
    raise exception 'Current invoice status is terminal';
  end if;

  if v_next_status in ('void', 'cancelled') and coalesce(v_invoice.amount_paid, 0) > 0 then
    raise exception 'A paid or partially paid invoice cannot be voided';
  end if;

  if p_due_date is not null and p_due_date < v_invoice.invoice_date then
    raise exception 'due_date cannot be before invoice_date';
  end if;

  update public.invoices
  set status = v_next_status,
      due_date = coalesce(p_due_date, due_date),
      notes = case when p_notes is null then notes else nullif(btrim(p_notes), '') end,
      payment_status = case
        when v_next_status in ('void', 'cancelled') then payment_status
        when coalesce(amount_paid, 0) >= total_amount then 'paid'
        when coalesce(amount_paid, 0) > 0 then 'partial'
        when coalesce(p_due_date, due_date) < current_date then 'overdue'
        else 'pending'
      end,
      updated_at = now()
  where id = p_invoice_id
  returning * into v_invoice;

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

revoke insert, update, delete on table public.invoice_payments from authenticated;
grant select on table public.invoice_payments to authenticated;

drop policy if exists "Authenticated users manage invoices" on public.invoices;
drop policy if exists "Authenticated users read invoices" on public.invoices;
create policy "Authenticated users read invoices"
on public.invoices
for select
to authenticated
using (true);

revoke insert, update, delete on table public.invoices from authenticated;
grant select on table public.invoices to authenticated;

revoke all on function public.register_invoice_payment(uuid, numeric, text, text, text, text, timestamptz) from public;
revoke execute on function public.register_invoice_payment(uuid, numeric, text, text, text, text, timestamptz) from anon;
grant execute on function public.register_invoice_payment(uuid, numeric, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.register_invoice_payment(uuid, numeric, text, text, text, text, timestamptz) to service_role;

revoke all on function public.refresh_invoice_payment_status(uuid) from public;
revoke execute on function public.refresh_invoice_payment_status(uuid) from anon;
grant execute on function public.refresh_invoice_payment_status(uuid) to authenticated;
grant execute on function public.refresh_invoice_payment_status(uuid) to service_role;

revoke all on function public.set_invoice_lifecycle(uuid, text, date, text) from public;
revoke execute on function public.set_invoice_lifecycle(uuid, text, date, text) from anon;
grant execute on function public.set_invoice_lifecycle(uuid, text, date, text) to authenticated;
grant execute on function public.set_invoice_lifecycle(uuid, text, date, text) to service_role;

commit;

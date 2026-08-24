begin;

-- Canonical invoice payment lifecycle for the current Blackswan schema.
alter table public.invoice_payments
  add column if not exists idempotency_key text;

create unique index if not exists invoice_payments_idempotency_key_idx
  on public.invoice_payments (idempotency_key)
  where idempotency_key is not null;

create or replace function public.register_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text default null,
  p_paid_at timestamptz default now(),
  p_reference text default null,
  p_idempotency_key text default null
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
  v_status text;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Authentication required';
  end if;
  if p_invoice_id is null then raise exception 'p_invoice_id is required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'p_amount must be > 0'; end if;

  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.status in ('void', 'cancelled') then raise exception 'Cannot pay a void or cancelled invoice'; end if;

  if nullif(btrim(p_idempotency_key), '') is not null then
    select * into v_payment
    from public.invoice_payments
    where idempotency_key = btrim(p_idempotency_key)
    limit 1;
    if found then
      if v_payment.invoice_id <> p_invoice_id or v_payment.amount <> p_amount or coalesce(v_payment.method,'') <> coalesce(p_method,'') then
        raise exception 'idempotency_key payload mismatch';
      end if;
      return jsonb_build_object('ok',true,'idempotent_replay',true,'payment_id',v_payment.id,'invoice_id',p_invoice_id);
    end if;
  end if;

  if p_amount > greatest(v_invoice.total_amount - coalesce(v_invoice.paid_amount,0),0) then
    raise exception 'Payment exceeds outstanding balance';
  end if;

  insert into public.invoice_payments (invoice_id,amount,method,paid_at,reference,idempotency_key)
  values (p_invoice_id,p_amount,btrim(p_method),coalesce(p_paid_at,now()),nullif(btrim(p_reference),''),nullif(btrim(p_idempotency_key),''))
  on conflict (idempotency_key) where idempotency_key is not null do nothing
  returning * into v_payment;

  if not found then
    select * into v_payment from public.invoice_payments where idempotency_key=btrim(p_idempotency_key);
  end if;

  select coalesce(sum(amount),0) into v_paid from public.invoice_payments where invoice_id=p_invoice_id;
  v_status := case
    when v_paid >= v_invoice.total_amount then 'paid'
    when v_paid > 0 then 'partial'
    when v_invoice.due_date is not null and v_invoice.due_date < current_date then 'overdue'
    else 'pending'
  end;

  update public.invoices
  set paid_amount=v_paid,status=v_status,updated_at=now()
  where id=p_invoice_id
  returning * into v_invoice;

  return jsonb_build_object('ok',true,'idempotent_replay',false,'payment_id',v_payment.id,'invoice_id',p_invoice_id,'new_paid_amount',v_paid,'new_status',v_status);
end;
$$;

create or replace function public.set_invoice_lifecycle(
  p_invoice_id uuid,
  p_status text default null,
  p_due_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_next text;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then raise exception 'Authentication required'; end if;
  select * into v_invoice from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  v_next:=coalesce(nullif(btrim(p_status),''),v_invoice.status);
  if v_next not in ('draft','sent','pending','partial','paid','overdue','void','cancelled') then raise exception 'Unsupported invoice status'; end if;
  if v_invoice.status in ('paid','void','cancelled') and v_next<>v_invoice.status then raise exception 'Current invoice status is terminal'; end if;
  if v_next in ('void','cancelled') and coalesce(v_invoice.paid_amount,0)>0 then raise exception 'Paid invoice cannot be voided or cancelled'; end if;
  update public.invoices set status=v_next,due_date=coalesce(p_due_date,due_date),updated_at=now() where id=p_invoice_id returning * into v_invoice;
  return to_jsonb(v_invoice);
end;
$$;

revoke all on function public.register_invoice_payment(uuid,numeric,text,timestamptz,text,text) from public,anon;
grant execute on function public.register_invoice_payment(uuid,numeric,text,timestamptz,text,text) to authenticated,service_role;
revoke all on function public.set_invoice_lifecycle(uuid,text,date) from public,anon;
grant execute on function public.set_invoice_lifecycle(uuid,text,date) to authenticated,service_role;

commit;

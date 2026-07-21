-- Create reservation invoices atomically and keep reservation-extra totals authoritative.

begin;

alter table public.reservations
  drop constraint if exists reservations_total_amount_clp,
  add constraint reservations_total_amount_clp
    check (
      total_amount is null
      or (total_amount >= 0 and total_amount = trunc(total_amount))
    );

create or replace function public.set_reservation_extra_total()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.total_amount := round(new.quantity * new.unit_price, 0);
  return new;
end;
$$;

drop trigger if exists set_reservation_extra_total_before_write
  on public.reservation_extras;

create trigger set_reservation_extra_total_before_write
before insert or update of quantity, unit_price
on public.reservation_extras
for each row
execute function public.set_reservation_extra_total();

update public.reservation_extras
set total_amount = round(quantity * unit_price, 0)
where total_amount is distinct from round(quantity * unit_price, 0);

alter table public.reservation_extras
  alter column total_amount set not null;

create or replace function public.create_reservation_invoice(
  p_reservation_id uuid,
  p_due_date date default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation record;
  v_invoice public.invoices%rowtype;
  v_extra_items jsonb := '[]'::jsonb;
  v_line_items jsonb := '[]'::jsonb;
  v_lodging_subtotal numeric := 0;
  v_extras_subtotal numeric := 0;
  v_extras_tax numeric := 0;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_created_by uuid;
  v_created boolean := false;
begin
  if p_reservation_id is null then
    raise exception 'reservation_id is required';
  end if;

  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Authentication required';
  end if;

  if p_due_date is not null and p_due_date < current_date then
    raise exception 'due_date cannot be before invoice_date';
  end if;

  select
    r.*,
    coalesce(g.name, r.guest_name) as resolved_guest_name,
    coalesce(g.email, r.guest_email) as resolved_guest_email,
    coalesce(g.phone, r.guest_phone) as resolved_guest_phone,
    g.address as resolved_guest_address,
    rm.room_number as resolved_room_number
  into v_reservation
  from public.reservations r
  left join public.guests g on g.id = r.guest_id
  left join public.beds b on b.id = r.bed_id
  left join public.rooms rm on rm.id = coalesce(r.room_id, b.room_id)
  where r.id = p_reservation_id
  for update of r;

  if not found then
    raise exception 'Reservation not found';
  end if;

  if lower(coalesce(v_reservation.status, 'confirmed')) in (
    'cancelled', 'canceled', 'void', 'voided'
  ) then
    raise exception 'Cannot invoice a cancelled or void reservation';
  end if;

  if v_reservation.check_out <= v_reservation.check_in then
    raise exception 'Reservation check_out must be after check_in';
  end if;

  select *
  into v_invoice
  from public.invoices
  where reservation_id = p_reservation_id
    and coalesce(status, 'draft') not in ('void', 'cancelled')
  order by created_at desc, id
  limit 1;

  if found then
    return jsonb_build_object(
      'created', false,
      'invoice', to_jsonb(v_invoice)
    );
  end if;

  v_lodging_subtotal := round(coalesce(v_reservation.total_amount, 0), 0);

  if v_lodging_subtotal < 0 then
    raise exception 'Reservation total_amount cannot be negative';
  end if;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type', 'extra',
          'extra_id', re.extra_id,
          'description', re.name,
          'unit', re.unit,
          'qty', re.quantity,
          'quantity', re.quantity,
          'unit_price', re.unit_price,
          'tax_rate', re.tax_rate,
          'subtotal', re.total_amount,
          'tax_amount', round(re.total_amount * re.tax_rate / 100, 0),
          'total', re.total_amount + round(re.total_amount * re.tax_rate / 100, 0)
        )
        order by re.created_at, re.id
      ),
      '[]'::jsonb
    ),
    coalesce(sum(re.total_amount), 0),
    coalesce(sum(round(re.total_amount * re.tax_rate / 100, 0)), 0)
  into v_extra_items, v_extras_subtotal, v_extras_tax
  from public.reservation_extras re
  where re.reservation_id = p_reservation_id;

  v_line_items := jsonb_build_array(
    jsonb_build_object(
      'type', 'lodging',
      'description', format(
        'Alojamiento %s - %s a %s',
        coalesce(v_reservation.resolved_room_number, 'sin habitación asignada'),
        v_reservation.check_in,
        v_reservation.check_out
      ),
      'qty', 1,
      'quantity', 1,
      'nights', v_reservation.check_out - v_reservation.check_in,
      'unit_price', v_lodging_subtotal,
      'tax_rate', 0,
      'subtotal', v_lodging_subtotal,
      'tax_amount', 0,
      'total', v_lodging_subtotal
    )
  ) || v_extra_items;

  v_subtotal := v_lodging_subtotal + v_extras_subtotal;
  v_total := v_subtotal + v_extras_tax;

  select e.id
  into v_created_by
  from public.employees e
  where lower(e.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and coalesce(e.is_active, true)
  order by e.created_at
  limit 1;

  insert into public.invoices (
    reservation_id,
    invoice_number,
    invoice_date,
    due_date,
    status,
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    line_items,
    subtotal,
    discount_amount,
    discount_percentage,
    tax_rate,
    tax_amount,
    additional_fees,
    total_amount,
    payment_status,
    amount_paid,
    notes,
    created_by,
    updated_by
  )
  values (
    p_reservation_id,
    public.next_invoice_number(),
    current_date,
    coalesce(p_due_date, current_date + 7),
    'draft',
    v_reservation.resolved_guest_name,
    v_reservation.resolved_guest_email,
    v_reservation.resolved_guest_phone,
    v_reservation.resolved_guest_address,
    v_line_items,
    v_subtotal,
    0,
    0,
    0,
    v_extras_tax,
    0,
    v_total,
    'pending',
    0,
    coalesce(nullif(btrim(p_notes), ''), 'Generada desde los cargos de la reserva.'),
    v_created_by,
    v_created_by
  )
  on conflict do nothing
  returning * into v_invoice;

  if found then
    v_created := true;
  else
    select *
    into v_invoice
    from public.invoices
    where reservation_id = p_reservation_id
      and coalesce(status, 'draft') not in ('void', 'cancelled')
    order by created_at desc, id
    limit 1;

    if not found then
      raise exception 'Invoice creation conflicted without an active invoice';
    end if;
  end if;

  return jsonb_build_object(
    'created', v_created,
    'invoice', to_jsonb(v_invoice)
  );
end;
$$;

revoke all on function public.create_reservation_invoice(uuid, date, text) from public;
revoke execute on function public.create_reservation_invoice(uuid, date, text) from anon;
grant execute on function public.create_reservation_invoice(uuid, date, text) to authenticated;
grant execute on function public.create_reservation_invoice(uuid, date, text) to service_role;

revoke execute on function public.next_invoice_number() from authenticated;
grant execute on function public.next_invoice_number() to service_role;

comment on function public.create_reservation_invoice(uuid, date, text)
is 'Atomically returns an existing active invoice or creates one from reservation lodging and extras.';

commit;

begin;

create or replace function public.attach_operational_document_to_reservation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document_id uuid;
  v_location_id uuid;
  v_room_id uuid;
  v_room_number text;
begin
  if new.operational_document_id is not null then
    return new;
  end if;

  select b.room_id, r.location_id, r.room_number
    into v_room_id, v_location_id, v_room_number
  from public.beds b
  join public.rooms r on r.id = b.room_id
  where b.id = new.bed_id;

  insert into public.operational_documents (
    document_type,
    status,
    title,
    customer_name,
    customer_email,
    customer_phone,
    location_id,
    reservation_id,
    priority,
    currency,
    start_at,
    end_at,
    notes,
    metadata
  ) values (
    'reservation',
    case when new.status in ('confirmed','checked_in','checked-in') then 'confirmed' else 'draft' end,
    concat('Estadía · ', new.guest_name, coalesce(' · Habitación ' || v_room_number, '')),
    new.guest_name,
    new.guest_email,
    new.guest_phone,
    coalesce(new.location_id, v_location_id),
    new.id,
    'normal',
    'CLP',
    new.check_in::timestamptz,
    new.check_out::timestamptz,
    new.special_requests,
    jsonb_build_object('source', 'reservation_trigger', 'bed_id', new.bed_id, 'room_id', v_room_id)
  ) returning id into v_document_id;

  update public.reservations
  set operational_document_id = v_document_id,
      room_id = coalesce(room_id, v_room_id),
      location_id = coalesce(location_id, v_location_id)
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists reservations_attach_operational_document on public.reservations;
create trigger reservations_attach_operational_document
after insert on public.reservations
for each row execute function public.attach_operational_document_to_reservation();

create or replace function public.inherit_invoice_operational_document()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.operational_document_id is null and new.reservation_id is not null then
    select operational_document_id
      into new.operational_document_id
    from public.reservations
    where id = new.reservation_id;
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_inherit_operational_document on public.invoices;
create trigger invoices_inherit_operational_document
before insert or update of reservation_id on public.invoices
for each row execute function public.inherit_invoice_operational_document();

commit;

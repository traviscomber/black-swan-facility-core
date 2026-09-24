-- Finance state alerts for Santiago + independent reconciliation observation by Raimundo.

alter table public.finance_documents
  add column if not exists reconciliation_status text not null default 'unknown',
  add column if not exists reconciliation_checked_by uuid references auth.users(id) on delete restrict,
  add column if not exists reconciliation_checked_at timestamptz,
  add column if not exists reconciliation_notes text;

alter table public.finance_documents
  drop constraint if exists finance_documents_reconciliation_status_check;
alter table public.finance_documents
  add constraint finance_documents_reconciliation_status_check
  check (reconciliation_status in ('unknown','unpaid','paid_observed','reconciled','exception'));

create table if not exists public.finance_document_alerts (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.finance_documents(id) on delete cascade,
  change_kind text not null,
  old_value text,
  new_value text,
  title text not null,
  detail text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint finance_document_alerts_kind_check check (change_kind in ('approval_status','payment_status','reconciliation_status','allocation'))
);

create index if not exists finance_document_alerts_recipient_idx
  on public.finance_document_alerts(recipient_user_id, read_at, created_at desc);

alter table public.finance_document_alerts enable row level security;
drop policy if exists finance_document_alerts_recipient_read on public.finance_document_alerts;
create policy finance_document_alerts_recipient_read
  on public.finance_document_alerts for select to authenticated
  using (recipient_user_id = auth.uid());

drop policy if exists finance_document_alerts_recipient_update on public.finance_document_alerts;
create policy finance_document_alerts_recipient_update
  on public.finance_document_alerts for update to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

grant select, update on public.finance_document_alerts to authenticated;

create or replace function public.finance_alert_title(p_kind text, p_new text)
returns text
language sql
immutable
as $function$
  select case
    when p_kind='approval_status' and p_new='ready' then 'Documento listo para validación'
    when p_kind='approval_status' and p_new='pending_valuation' then 'Raimundo aprobó el gasto'
    when p_kind='approval_status' and p_new='approved' then 'Raimundo aprobó el gasto'
    when p_kind='approval_status' and p_new='rejected' then 'Raimundo rechazó el gasto'
    when p_kind='payment_status' and p_new='pending_santiago' then 'Pago listo para decisión de Santiago'
    when p_kind='payment_status' and p_new='authorized' then 'Pago autorizado'
    when p_kind='payment_status' and p_new='rejected' then 'Pago rechazado'
    when p_kind='payment_status' and p_new='paid' then 'Pago ejecutado'
    when p_kind='reconciliation_status' and p_new='unpaid' then 'Raimundo confirma: aún no pagado'
    when p_kind='reconciliation_status' and p_new='paid_observed' then 'Raimundo observó el pago'
    when p_kind='reconciliation_status' and p_new='reconciled' then 'Pago conciliado'
    when p_kind='reconciliation_status' and p_new='exception' then 'Excepción de conciliación'
    else 'Cambio de estado financiero'
  end;
$function$;

create or replace function public.emit_finance_document_state_alerts()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
declare
  v_recipient uuid;
  v_detail text;
begin
  for v_recipient in
    select a.user_id from public.finance_payment_authorizers a
    where a.is_active and a.user_id is distinct from auth.uid()
  loop
    v_detail := concat_ws(' · ', nullif(new.supplier_name,''), nullif(new.document_number,''));

    if old.approval_status is distinct from new.approval_status then
      insert into public.finance_document_alerts(recipient_user_id,document_id,change_kind,old_value,new_value,title,detail,actor_id)
      values(v_recipient,new.id,'approval_status',old.approval_status,new.approval_status,public.finance_alert_title('approval_status',new.approval_status),v_detail,auth.uid());
    end if;

    if old.payment_status is distinct from new.payment_status then
      insert into public.finance_document_alerts(recipient_user_id,document_id,change_kind,old_value,new_value,title,detail,actor_id)
      values(v_recipient,new.id,'payment_status',old.payment_status,new.payment_status,public.finance_alert_title('payment_status',new.payment_status),v_detail,auth.uid());
    end if;

    if old.reconciliation_status is distinct from new.reconciliation_status then
      insert into public.finance_document_alerts(recipient_user_id,document_id,change_kind,old_value,new_value,title,detail,actor_id)
      values(v_recipient,new.id,'reconciliation_status',old.reconciliation_status,new.reconciliation_status,public.finance_alert_title('reconciliation_status',new.reconciliation_status),v_detail,auth.uid());
    end if;
  end loop;
  return new;
end;
$function$;

drop trigger if exists finance_document_state_alerts on public.finance_documents;
create trigger finance_document_state_alerts
after update of approval_status,payment_status,reconciliation_status
on public.finance_documents
for each row execute function public.emit_finance_document_state_alerts();

create or replace function public.set_finance_document_reconciliation_status(
  p_document_id uuid,
  p_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
declare
  v_old text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_finance_approve() then raise exception 'Raimundo finance review permission required'; end if;
  if p_status not in ('unknown','unpaid','paid_observed','reconciled','exception') then
    raise exception 'Invalid reconciliation status';
  end if;

  select reconciliation_status into v_old
  from public.finance_documents where id=p_document_id for update;
  if not found then raise exception 'Finance document not found'; end if;

  update public.finance_documents
  set reconciliation_status=p_status,
      reconciliation_checked_by=auth.uid(),
      reconciliation_checked_at=now(),
      reconciliation_notes=nullif(trim(p_notes),''),
      updated_at=now()
  where id=p_document_id;

  insert into public.critical_action_audit_log(
    entity_type,entity_id,action,category,actor_id,actor_email,actor_role,
    old_data,new_data,changed_fields,occurred_at
  ) values (
    'finance_document',p_document_id,'update_reconciliation_status','finance',
    auth.uid(),auth.jwt()->>'email',public.current_app_role(),
    jsonb_build_object('reconciliation_status',v_old),
    jsonb_build_object('reconciliation_status',p_status,'notes',nullif(trim(p_notes),'')),
    array['reconciliation_status','reconciliation_checked_by','reconciliation_checked_at','reconciliation_notes'],now()
  );

  return jsonb_build_object('success',true,'document_id',p_document_id,'reconciliation_status',p_status);
end;
$function$;

revoke all on function public.set_finance_document_reconciliation_status(uuid,text,text) from public, anon;
grant execute on function public.set_finance_document_reconciliation_status(uuid,text,text) to authenticated;

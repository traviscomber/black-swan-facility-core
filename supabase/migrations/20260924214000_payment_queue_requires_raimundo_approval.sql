-- Do not send historical/admin test approvals to Santiago.
-- Only expenses approved by the canonical expense validator may enter the payment queue.

update public.finance_documents d
set payment_status='not_ready',
    payment_decided_by=null,
    payment_decided_at=null,
    payment_decision_notes=null,
    updated_at=now()
where d.payment_status='pending_santiago'
  and not exists (
    select 1 from public.finance_expense_validators v
    where v.user_id=d.approved_by and v.is_active
  );

update public.finance_documents d
set payment_status='pending_santiago',
    updated_at=now()
where d.approved_at is not null
  and d.approval_status in ('pending_valuation','approved')
  and d.payment_status='not_ready'
  and exists (
    select 1 from public.finance_expense_validators v
    where v.user_id=d.approved_by and v.is_active
  );

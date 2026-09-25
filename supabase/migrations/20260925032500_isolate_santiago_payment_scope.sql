-- Isolate Santiago's payment role from Raimundo's approval queue.
-- Payment authorizers who are not expense approvers may only read documents
-- that have already reached Santiago's payment workflow.

drop policy if exists finance_documents_read_authorized on public.finance_documents;

create policy finance_documents_read_authorized
on public.finance_documents
for select
to authenticated
using (
  public.current_app_role() in ('admin','service_role')
  or public.can_finance_approve()
  or (
    public.can_finance_payment_authorize()
    and payment_status in ('pending_santiago','authorized','rejected','paid')
  )
  or (
    not public.can_finance_payment_authorize()
    and public.can_app_action('finance.adjust')
  )
);

comment on policy finance_documents_read_authorized on public.finance_documents is
  'Approvers can read approval work; payment-only authorizers can read only documents already handed to Santiago.';

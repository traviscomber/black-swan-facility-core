-- Restrict invoice number generation to trusted application roles.

begin;

revoke execute on function public.next_invoice_number() from public;
revoke execute on function public.next_invoice_number() from anon;

grant execute on function public.next_invoice_number() to authenticated;
grant execute on function public.next_invoice_number() to service_role;

commit;

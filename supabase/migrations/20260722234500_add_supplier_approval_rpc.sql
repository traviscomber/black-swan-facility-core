create or replace function public.set_supplier_approval(
  supplier_id uuid,
  next_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  requester_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'procurement_role', '');
begin
  if next_status not in ('approved', 'rejected', 'pending') then
    raise exception 'Invalid supplier approval status';
  end if;

  if requester_email not in (
    'juan@n3uralia.com',
    'raimundo@blackswn.org',
    'santiago@blackswn.org'
  ) or requester_role not in ('approver', 'admin') then
    raise exception 'Not authorized to approve suppliers';
  end if;

  update public.suppliers
  set
    approval_status = next_status,
    is_active = (next_status = 'approved'),
    approved_at = case when next_status = 'approved' then now() else null end,
    approved_by = case when next_status = 'approved' then auth.uid() else null end
  where id = supplier_id;

  if not found then
    raise exception 'Supplier not found';
  end if;
end;
$$;

revoke all on function public.set_supplier_approval(uuid, text) from public;
grant execute on function public.set_supplier_approval(uuid, text) to authenticated;

-- Restrict the booking domain to authenticated application users.
-- Public booking flows must use server-side APIs with service-role access,
-- never direct anonymous access to these tables.

begin;

alter table public.reservations enable row level security;
alter table public.rooms enable row level security;
alter table public.beds enable row level security;
alter table public.payments enable row level security;
alter table public.guests enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.housekeeping_tasks enable row level security;
alter table public.reservation_history enable row level security;
alter table public.audit_actions enable row level security;

-- Remove legacy unrestricted public policies.
drop policy if exists "Allow all on reservations" on public.reservations;
drop policy if exists "Allow all on rooms" on public.rooms;
drop policy if exists "Allow all operations on beds" on public.beds;
drop policy if exists "Allow all on payments" on public.payments;
drop policy if exists "Allow all on guests" on public.guests;
drop policy if exists "Allow all on invoices" on public.invoices;
drop policy if exists "Allow all on invoice_payments" on public.invoice_payments;
drop policy if exists "Allow all on pricing_rules" on public.pricing_rules;
drop policy if exists "Allow all on housekeeping_tasks" on public.housekeeping_tasks;
drop policy if exists "Allow all on reservation_history" on public.reservation_history;
drop policy if exists "Allow all operations on audit_actions" on public.audit_actions;

-- Recreate one explicit authenticated policy per table.
drop policy if exists "Authenticated users manage reservations" on public.reservations;
create policy "Authenticated users manage reservations" on public.reservations
  for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users manage rooms" on public.rooms;
create policy "Authenticated users manage rooms" on public.rooms
  for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users manage beds" on public.beds;
create policy "Authenticated users manage beds" on public.beds
  for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users manage payments" on public.payments;
create policy "Authenticated users manage payments" on public.payments
  for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users manage guests" on public.guests;
create policy "Authenticated users manage guests" on public.guests
  for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users manage invoices" on public.invoices;
create policy "Authenticated users manage invoices" on public.invoices
  for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users manage invoice payments" on public.invoice_payments;
create policy "Authenticated users manage invoice payments" on public.invoice_payments
  for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users manage pricing rules" on public.pricing_rules;
create policy "Authenticated users manage pricing rules" on public.pricing_rules
  for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users manage housekeeping tasks" on public.housekeeping_tasks;
create policy "Authenticated users manage housekeeping tasks" on public.housekeeping_tasks
  for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users manage reservation history" on public.reservation_history;
create policy "Authenticated users manage reservation history" on public.reservation_history
  for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users manage audit actions" on public.audit_actions;
create policy "Authenticated users manage audit actions" on public.audit_actions
  for all to authenticated using (true) with check (true);

-- Remove direct anonymous table privileges as defense in depth.
revoke all on table public.reservations from anon;
revoke all on table public.rooms from anon;
revoke all on table public.beds from anon;
revoke all on table public.payments from anon;
revoke all on table public.guests from anon;
revoke all on table public.invoices from anon;
revoke all on table public.invoice_payments from anon;
revoke all on table public.pricing_rules from anon;
revoke all on table public.housekeeping_tasks from anon;
revoke all on table public.reservation_history from anon;
revoke all on table public.audit_actions from anon;

-- Preserve the current authenticated application behavior.
grant select, insert, update, delete on table public.reservations to authenticated;
grant select, insert, update, delete on table public.rooms to authenticated;
grant select, insert, update, delete on table public.beds to authenticated;
grant select, insert, update, delete on table public.payments to authenticated;
grant select, insert, update, delete on table public.guests to authenticated;
grant select, insert, update, delete on table public.invoices to authenticated;
grant select, insert, update, delete on table public.invoice_payments to authenticated;
grant select, insert, update, delete on table public.pricing_rules to authenticated;
grant select, insert, update, delete on table public.housekeeping_tasks to authenticated;
grant select, insert, update, delete on table public.reservation_history to authenticated;
grant select, insert, update, delete on table public.audit_actions to authenticated;

commit;

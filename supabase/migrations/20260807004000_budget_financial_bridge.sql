create table if not exists public.financial_postings (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references public.budget_divisions(id),
  category_id uuid not null references public.budget_categories(id),
  cost_center_id uuid references public.cost_centers(id),
  posting_type text not null check (posting_type in ('cost','income')),
  transaction_date date not null,
  source_module text not null,
  source_table text,
  source_id uuid,
  source_label text,
  source_amount numeric not null,
  source_currency text not null default 'EUR',
  fx_rate_to_eur numeric,
  fx_date date,
  amount_eur numeric not null,
  status text not null default 'draft' check (status in ('draft','ready','posted','exception','rejected')),
  exception_reason text,
  approved_by uuid,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (source_currency = 'EUR' and coalesce(fx_rate_to_eur,1) = 1)
    or (source_currency <> 'EUR' and fx_rate_to_eur is not null and fx_rate_to_eur > 0 and fx_date is not null)
  )
);

create unique index if not exists financial_postings_source_uq
  on public.financial_postings(source_table, source_id, division_id, category_id)
  where source_table is not null and source_id is not null and status <> 'rejected';

create index if not exists financial_postings_period_idx
  on public.financial_postings(division_id, category_id, transaction_date, status);

create table if not exists public.budget_module_routes (
  category_key text primary key,
  primary_route text not null,
  primary_label text not null,
  secondary_routes jsonb not null default '[]'::jsonb,
  operational_owner text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.budget_module_routes(category_key, primary_route, primary_label, secondary_routes, operational_owner, description)
values
  ('hr','/employees','Personal y asignaciones','[]'::jsonb,'People / Finance','Remuneraciones y distribución porcentual por centro P&L.'),
  ('buildings','/maintenance','Propiedades y mantenimiento','["/assets","/property-management"]'::jsonb,'Facilities','Edificios, propiedades, mantenimiento y documentos asociados.'),
  ('vehicles-machines-fuel','/fleet','Vehículos, máquinas y combustible','["/fuel-consumption","/maintenance","/assets"]'::jsonb,'Operations','Vehículos, máquinas, combustible, seguros y mantenimiento.'),
  ('variable-consumables-tools','/procurement','Compras y consumibles','["/inventory","/procurement/receiving"]'::jsonb,'Procurement','Compras operacionales, herramientas, consumibles y suministros.'),
  ('legal-financial','/budgets/reports','Legal y financiero','["/procurement/approvals"]'::jsonb,'Finance','Facturas, seguros, asesorías, permisos, impuestos y gastos financieros.'),
  ('planning-investments-hr','/procurement','Inversiones planificadas','["/assets","/infrastructure"]'::jsonb,'Finance / Projects','Inversiones aún no ejecutadas o no comprometidas.'),
  ('realising-investments','/assets','Inversiones en ejecución','["/procurement","/infrastructure"]'::jsonb,'Finance / Projects','Inversiones aprobadas, compradas o en ejecución.'),
  ('income','/bookings/invoices','Ingresos','["/bookings","/bookings/payments","/bookings/revenue"]'::jsonb,'Finance / Hospitality','Ingresos desde reservas, servicios, actividades, extras, facturas y pagos.')
on conflict (category_key) do update
set primary_route = excluded.primary_route,
    primary_label = excluded.primary_label,
    secondary_routes = excluded.secondary_routes,
    operational_owner = excluded.operational_owner,
    description = excluded.description,
    updated_at = now();

create or replace view public.budget_actual_reconciliation as
with posted as (
  select division_id,
         category_id,
         extract(year from transaction_date)::integer as year,
         extract(month from transaction_date)::integer as month,
         sum(amount_eur) filter (where status = 'posted') as operational_actual_eur,
         count(*) filter (where status = 'posted') as posted_count,
         count(*) filter (where status in ('draft','ready','exception')) as pending_count
  from public.financial_postings
  group by division_id, category_id, extract(year from transaction_date), extract(month from transaction_date)
)
select b.id as budget_id,
       b.division_id,
       d.name as division_name,
       d.source_key as division_key,
       b.category_id,
       c.name as category_name,
       c.source_key as category_key,
       c.category_role,
       b.year,
       b.month,
       b.budgeted_amount as plan_amount,
       coalesce(b.actual_amount,0) as excel_actual_amount,
       coalesce(p.operational_actual_eur,0) as operational_actual_amount,
       coalesce(b.actual_amount,0) - coalesce(p.operational_actual_eur,0) as reconciliation_difference,
       coalesce(p.posted_count,0) as posted_count,
       coalesce(p.pending_count,0) as pending_count,
       r.primary_route,
       r.primary_label,
       r.secondary_routes,
       r.operational_owner
from public.budgets b
join public.budget_divisions d on d.id=b.division_id
join public.budget_categories c on c.id=b.category_id
left join posted p on p.division_id=b.division_id and p.category_id=b.category_id and p.year=b.year and p.month=b.month
left join public.budget_module_routes r on r.category_key=c.source_key;

alter table public.financial_postings enable row level security;
alter table public.budget_module_routes enable row level security;

drop policy if exists financial_postings_read on public.financial_postings;
create policy financial_postings_read on public.financial_postings
  for select to authenticated using (auth.uid() is not null);

drop policy if exists financial_postings_write on public.financial_postings;
create policy financial_postings_write on public.financial_postings
  for all to authenticated
  using (public.current_app_role() in ('admin','approver'))
  with check (public.current_app_role() in ('admin','approver'));

drop policy if exists budget_module_routes_read on public.budget_module_routes;
create policy budget_module_routes_read on public.budget_module_routes
  for select to authenticated using (auth.uid() is not null);

drop policy if exists budget_module_routes_write on public.budget_module_routes;
create policy budget_module_routes_write on public.budget_module_routes
  for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

grant select on public.budget_actual_reconciliation to authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='financial_postings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_postings;
  END IF;
END $$;

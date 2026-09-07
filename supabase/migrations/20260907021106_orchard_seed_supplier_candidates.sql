-- Stage current seed supplier candidates for Orchard procurement review.
--
-- These rows are evidence-backed candidates only. The migration deliberately
-- keeps them inactive and pending so it cannot bypass Procurement supplier
-- approval, quotation or purchase-order controls.

begin;

update public.suppliers
set category = 'Semillas e insumos agrícolas',
    website = coalesce(website, 'https://cooprinsem.cl'),
    source_url = 'https://cooprinsem.cl/semillas/3321-semilla-de-rucula-5-grs.html',
    coverage_notes = 'Public Cooprinsem seed catalogue lists vegetable seed products and includes Valdivia in the per-branch stock table. Candidate for Orchard quotation review only; availability and exact cultivars must be confirmed during sourcing.',
    last_verified_at = now(),
    is_active = false,
    approval_status = 'pending',
    updated_at = now()
where name = 'Cooprinsem Valdivia';

insert into public.suppliers (
  name,
  category,
  region,
  website,
  source_url,
  coverage_notes,
  is_active,
  approval_status,
  last_verified_at
)
select
  'Anasac Agropecuario',
  'Semillas de hortalizas',
  'Los Ríos',
  'https://anasac.cl/agropecuario/',
  'https://anasac.cl/agropecuario/folletos-para-semillas/',
  'Anasac publishes a current vegetable-seed catalogue and identifies commercial vegetable-seed coverage from Maule through Los Lagos, which includes Los Ríos. Candidate for Procurement review only; no supplier approval, stock claim or cultivar substitution is implied.',
  false,
  'pending',
  now()
where not exists (
  select 1 from public.suppliers where lower(name) = lower('Anasac Agropecuario')
);

-- Fail closed if this migration accidentally activates or approves either seed
-- candidate. Procurement must make those decisions through its own workflow.
do $$
begin
  if exists (
    select 1
    from public.suppliers
    where name in ('Cooprinsem Valdivia', 'Anasac Agropecuario')
      and (is_active or approval_status <> 'pending')
  ) then
    raise exception 'Seed supplier candidate staging must remain pending and inactive';
  end if;
end $$;

commit;

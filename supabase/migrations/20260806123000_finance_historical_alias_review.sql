create table if not exists public.finance_historical_center_aliases (
  id uuid primary key default gen_random_uuid(),
  source_center_id uuid not null references public.finance_historical_cost_centers(id) on delete cascade,
  canonical_center_id uuid not null references public.finance_historical_cost_centers(id) on delete cascade,
  proposal_kind text not null default 'format_normalization' check (proposal_kind in ('format_normalization','manual_candidate')),
  confidence numeric(5,4) not null default 1 check (confidence >= 0 and confidence <= 1),
  proposal_reason text not null,
  status text not null default 'proposed' check (status in ('proposed','approved','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_historical_center_aliases_distinct check (source_center_id <> canonical_center_id),
  constraint finance_historical_center_aliases_source_unique unique (source_center_id)
);

alter table public.finance_historical_center_aliases enable row level security;

drop policy if exists finance_historical_center_aliases_read on public.finance_historical_center_aliases;
create policy finance_historical_center_aliases_read on public.finance_historical_center_aliases
for select to authenticated using (auth.uid() is not null);

drop policy if exists finance_historical_center_aliases_write on public.finance_historical_center_aliases;
create policy finance_historical_center_aliases_write on public.finance_historical_center_aliases
for all to authenticated using (public.can_finance_review_ambiguous()) with check (public.can_finance_review_ambiguous());

create or replace function public.normalize_finance_historical_label(p_label text)
returns text
language sql
immutable
as $$
  select upper(trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(p_label,''), '<---.*$', '', 'g'),
        E'\\([[:space:]]*', '(', 'g'
      ),
      E'[[:space:]]*\\)', ')', 'g'
    ),
    '[[:space:]]+', ' ', 'g'
  )));
$$;

create or replace function public.refresh_finance_historical_alias_proposals()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if not public.can_finance_review_ambiguous() then
    raise exception 'Only Raimundo or an administrator can refresh historical alias proposals';
  end if;

  with ranked as (
    select c.*,
           public.normalize_finance_historical_label(c.historical_label) as normalized_label,
           row_number() over (
             partition by c.source_workbook_hash, public.normalize_finance_historical_label(c.historical_label)
             order by (c.mapping_status = 'mapped') desc,
                      c.header_frequency desc,
                      length(c.historical_label) asc,
                      c.created_at asc,
                      c.id
           ) as rn,
           count(*) over (
             partition by c.source_workbook_hash, public.normalize_finance_historical_label(c.historical_label)
           ) as group_count
    from public.finance_historical_cost_centers c
  ), pairs as (
    select s.id as source_center_id,
           t.id as canonical_center_id
    from ranked s
    join ranked t
      on t.source_workbook_hash = s.source_workbook_hash
     and t.normalized_label = s.normalized_label
     and t.rn = 1
    where s.group_count > 1
      and s.rn > 1
      and s.id <> t.id
  )
  insert into public.finance_historical_center_aliases (
    source_center_id, canonical_center_id, proposal_kind, confidence, proposal_reason, status
  )
  select p.source_center_id,
         p.canonical_center_id,
         'format_normalization',
         1,
         'Sugerencia determinística: ambas etiquetas son idénticas después de normalizar espacios, paréntesis y marcadores editoriales; la etiqueta original se conserva.',
         'proposed'
  from pairs p
  on conflict (source_center_id) do nothing;

  get diagnostics inserted_count = row_count;
  return jsonb_build_object('inserted', inserted_count);
end;
$$;

create or replace function public.review_finance_historical_alias(
  p_alias_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_finance_review_ambiguous() then
    raise exception 'Only Raimundo or an administrator can review historical aliases';
  end if;
  if p_decision not in ('approved','rejected') then
    raise exception 'Invalid alias decision';
  end if;
  if not exists (select 1 from public.finance_historical_center_aliases where id = p_alias_id) then
    raise exception 'Alias proposal not found';
  end if;

  update public.finance_historical_center_aliases
     set status = p_decision,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = nullif(trim(coalesce(p_note,'')),''),
         updated_at = now()
   where id = p_alias_id;

  return jsonb_build_object('id', p_alias_id, 'status', p_decision);
end;
$$;

create or replace function public.resolve_finance_historical_center_id(
  p_source_workbook_hash text,
  p_historical_label text
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(a.canonical_center_id, c.id)
  from public.finance_historical_cost_centers c
  left join public.finance_historical_center_aliases a
    on a.source_center_id = c.id
   and a.status = 'approved'
  where c.source_workbook_hash = p_source_workbook_hash
    and c.historical_label = p_historical_label
  limit 1;
$$;

create or replace view public.finance_historical_alias_queue
with (security_invoker = true)
as
select a.id,
       a.status,
       a.proposal_kind,
       a.confidence,
       a.proposal_reason,
       a.review_note,
       a.reviewed_at,
       s.id as source_center_id,
       s.source_workbook_hash,
       s.historical_label as source_label,
       s.operational_label as source_operational_label,
       s.header_frequency as source_frequency,
       s.mapping_status as source_mapping_status,
       sd.name as source_division_name,
       sc.name as source_category_name,
       t.id as canonical_center_id,
       t.historical_label as canonical_label,
       t.operational_label as canonical_operational_label,
       t.header_frequency as canonical_frequency,
       t.mapping_status as canonical_mapping_status,
       td.name as canonical_division_name,
       tc.name as canonical_category_name
from public.finance_historical_center_aliases a
join public.finance_historical_cost_centers s on s.id = a.source_center_id
join public.finance_historical_cost_centers t on t.id = a.canonical_center_id
left join public.budget_divisions sd on sd.id = s.division_id
left join public.budget_categories sc on sc.id = s.category_id
left join public.budget_divisions td on td.id = t.division_id
left join public.budget_categories tc on tc.id = t.category_id;

grant select on public.finance_historical_alias_queue to authenticated;
grant execute on function public.refresh_finance_historical_alias_proposals() to authenticated;
grant execute on function public.review_finance_historical_alias(uuid,text,text) to authenticated;
grant execute on function public.resolve_finance_historical_center_id(text,text) to authenticated;

with ranked as (
  select c.*,
         public.normalize_finance_historical_label(c.historical_label) as normalized_label,
         row_number() over (
           partition by c.source_workbook_hash, public.normalize_finance_historical_label(c.historical_label)
           order by (c.mapping_status = 'mapped') desc,
                    c.header_frequency desc,
                    length(c.historical_label) asc,
                    c.created_at asc,
                    c.id
         ) as rn,
         count(*) over (
           partition by c.source_workbook_hash, public.normalize_finance_historical_label(c.historical_label)
         ) as group_count
  from public.finance_historical_cost_centers c
), pairs as (
  select s.id as source_center_id, t.id as canonical_center_id
  from ranked s
  join ranked t
    on t.source_workbook_hash = s.source_workbook_hash
   and t.normalized_label = s.normalized_label
   and t.rn = 1
  where s.group_count > 1 and s.rn > 1 and s.id <> t.id
)
insert into public.finance_historical_center_aliases (
  source_center_id, canonical_center_id, proposal_kind, confidence, proposal_reason, status
)
select source_center_id,
       canonical_center_id,
       'format_normalization',
       1,
       'Sugerencia determinística: ambas etiquetas son idénticas después de normalizar espacios, paréntesis y marcadores editoriales; la etiqueta original se conserva.',
       'proposed'
from pairs
on conflict (source_center_id) do nothing;

create or replace function public.refresh_finance_historical_alias_proposals()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  format_count integer := 0;
  semantic_count integer := 0;
  semantic_extra integer := 0;
begin
  if not public.can_finance_review_ambiguous() then
    raise exception 'Only Raimundo or an administrator can refresh historical alias proposals';
  end if;

  with ranked as (
    select c.*,
           public.normalize_finance_historical_label(c.historical_label) as normalized_label,
           row_number() over (
             partition by c.source_workbook_hash, public.normalize_finance_historical_label(c.historical_label)
             order by (c.mapping_status = 'mapped') desc, c.header_frequency desc, length(c.historical_label) asc, c.created_at asc, c.id
           ) as rn,
           count(*) over (
             partition by c.source_workbook_hash, public.normalize_finance_historical_label(c.historical_label)
           ) as group_count
    from public.finance_historical_cost_centers c
  ), pairs as (
    select s.id as source_center_id, t.id as canonical_center_id
    from ranked s
    join ranked t on t.source_workbook_hash = s.source_workbook_hash and t.normalized_label = s.normalized_label and t.rn = 1
    where s.group_count > 1 and s.rn > 1 and s.id <> t.id
  )
  insert into public.finance_historical_center_aliases(source_center_id, canonical_center_id, proposal_kind, confidence, proposal_reason, status)
  select source_center_id, canonical_center_id, 'format_normalization', 1,
         'Sugerencia determinística: ambas etiquetas son idénticas después de normalizar espacios, paréntesis y marcadores editoriales; la etiqueta original se conserva.',
         'proposed'
  from pairs
  on conflict (source_center_id) do nothing;
  get diagnostics format_count = row_count;

  with ranked as (
    select c.*,
           row_number() over (
             partition by c.source_workbook_hash, c.division_id, upper(trim(c.operational_label))
             order by (c.mapping_status = 'mapped') desc, c.header_frequency desc, length(c.historical_label) asc, c.created_at asc, c.id
           ) as rn,
           count(*) over (
             partition by c.source_workbook_hash, c.division_id, upper(trim(c.operational_label))
           ) as group_count
    from public.finance_historical_cost_centers c
    where c.division_id is not null and nullif(trim(c.operational_label),'') is not null
  ), pairs as (
    select s.id as source_center_id, t.id as canonical_center_id
    from ranked s
    join ranked t on t.source_workbook_hash = s.source_workbook_hash
                 and t.division_id = s.division_id
                 and upper(trim(t.operational_label)) = upper(trim(s.operational_label))
                 and t.rn = 1
    where s.group_count > 1 and s.rn > 1 and s.id <> t.id
      and public.normalize_finance_historical_label(s.historical_label) <> public.normalize_finance_historical_label(t.historical_label)
  )
  insert into public.finance_historical_center_aliases(source_center_id, canonical_center_id, proposal_kind, confidence, proposal_reason, status)
  select source_center_id, canonical_center_id, 'manual_candidate', 0.95,
         'Candidato semántico: mismo P&L y mismo detalle operacional, pero etiqueta histórica distinta. Requiere confirmación de Raimundo; no se fusiona automáticamente.',
         'proposed'
  from pairs
  on conflict (source_center_id) do nothing;
  get diagnostics semantic_count = row_count;

  with explicit_pairs(source_label, canonical_label, confidence, reason) as (
    values
      ('(ADM) OTROS INTERES PAGADOS', '(ADM) OTROS INTERESES PAGADOS', 0.98::numeric, 'Candidato semántico: variante singular/plural observada en el mismo centro administrativo. Requiere confirmación de Raimundo.'),
      ('(AGRICOLA) BENCINA', '(AGRICOLA) BENCINAS', 0.95::numeric, 'Candidato semántico: variante singular/plural observada en la misma taxonomía histórica AGRICOLA. Requiere confirmación de Raimundo.')
  ), pairs as (
    select s.id as source_center_id, t.id as canonical_center_id, p.confidence, p.reason
    from explicit_pairs p
    join public.finance_historical_cost_centers s on s.historical_label = p.source_label
    join public.finance_historical_cost_centers t on t.source_workbook_hash = s.source_workbook_hash and t.historical_label = p.canonical_label
  )
  insert into public.finance_historical_center_aliases(source_center_id, canonical_center_id, proposal_kind, confidence, proposal_reason, status)
  select source_center_id, canonical_center_id, 'manual_candidate', confidence, reason, 'proposed'
  from pairs
  on conflict (source_center_id) do nothing;
  get diagnostics semantic_extra = row_count;
  semantic_count := semantic_count + semantic_extra;

  return jsonb_build_object(
    'inserted', format_count + semantic_count,
    'format_inserted', format_count,
    'manual_inserted', semantic_count
  );
end;
$$;

grant execute on function public.refresh_finance_historical_alias_proposals() to authenticated;

-- Seed review-only candidates for the current canonical workbook. These remain proposed.
with ranked as (
  select c.*,
         row_number() over (
           partition by c.source_workbook_hash, c.division_id, upper(trim(c.operational_label))
           order by (c.mapping_status = 'mapped') desc, c.header_frequency desc, length(c.historical_label) asc, c.created_at asc, c.id
         ) as rn,
         count(*) over (
           partition by c.source_workbook_hash, c.division_id, upper(trim(c.operational_label))
         ) as group_count
  from public.finance_historical_cost_centers c
  where c.division_id is not null and nullif(trim(c.operational_label),'') is not null
), pairs as (
  select s.id source_center_id, t.id canonical_center_id
  from ranked s
  join ranked t on t.source_workbook_hash=s.source_workbook_hash and t.division_id=s.division_id and upper(trim(t.operational_label))=upper(trim(s.operational_label)) and t.rn=1
  where s.group_count>1 and s.rn>1 and s.id<>t.id
    and public.normalize_finance_historical_label(s.historical_label)<>public.normalize_finance_historical_label(t.historical_label)
)
insert into public.finance_historical_center_aliases(source_center_id,canonical_center_id,proposal_kind,confidence,proposal_reason,status)
select source_center_id,canonical_center_id,'manual_candidate',0.95,
       'Candidato semántico: mismo P&L y mismo detalle operacional, pero etiqueta histórica distinta. Requiere confirmación de Raimundo; no se fusiona automáticamente.',
       'proposed'
from pairs on conflict(source_center_id) do nothing;

with explicit_pairs(source_label, canonical_label, confidence, reason) as (
 values
 ('(ADM) OTROS INTERES PAGADOS','(ADM) OTROS INTERESES PAGADOS',0.98::numeric,'Candidato semántico: variante singular/plural observada en el mismo centro administrativo. Requiere confirmación de Raimundo.'),
 ('(AGRICOLA) BENCINA','(AGRICOLA) BENCINAS',0.95::numeric,'Candidato semántico: variante singular/plural observada en la misma taxonomía histórica AGRICOLA. Requiere confirmación de Raimundo.')
), pairs as (
 select s.id source_center_id,t.id canonical_center_id,p.confidence,p.reason
 from explicit_pairs p
 join public.finance_historical_cost_centers s on s.historical_label=p.source_label
 join public.finance_historical_cost_centers t on t.source_workbook_hash=s.source_workbook_hash and t.historical_label=p.canonical_label
)
insert into public.finance_historical_center_aliases(source_center_id,canonical_center_id,proposal_kind,confidence,proposal_reason,status)
select source_center_id,canonical_center_id,'manual_candidate',confidence,reason,'proposed'
from pairs on conflict(source_center_id) do nothing;
-- Black Swan OS: canonical reference catalog for OCR/document classification.
-- The OCR worker may read only approved reference data needed to propose IDs.

create or replace function public.ocr_get_reference_catalog()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_principal_id uuid;
  v_result jsonb;
begin
  v_principal_id := public.require_machine_scope('ocr:reference');

  select jsonb_build_object(
    'legal_entities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', le.id,
        'code', le.code,
        'legal_name', le.legal_name,
        'display_name', le.display_name,
        'entity_type', le.entity_type,
        'is_nonprofit', le.is_nonprofit
      ) order by le.display_name)
      from public.legal_entities le
      where le.active = true
    ), '[]'::jsonb),
    'departments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ed.id,
        'legal_entity_id', ed.legal_entity_id,
        'code', ed.code,
        'name', ed.name
      ) order by ed.name)
      from public.entity_departments ed
      where ed.is_active = true
    ), '[]'::jsonb),
    'cost_centers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cc.id,
        'code', cc.code,
        'name', cc.name,
        'description', cc.description
      ) order by cc.name)
      from public.cost_centers cc
      where coalesce(cc.is_active, true) = true
    ), '[]'::jsonb),
    'counterparties', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ac.id,
        'counterparty_type', ac.counterparty_type,
        'display_name', ac.display_name,
        'tax_id', ac.tax_id,
        'supplier_id', ac.supplier_id,
        'counterparty_legal_entity_id', ac.counterparty_legal_entity_id
      ) order by ac.display_name)
      from public.accounting_counterparties ac
      where ac.is_active = true
    ), '[]'::jsonb),
    'machine_principal_id', v_principal_id
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.ocr_get_reference_catalog() from public, authenticated;
grant execute on function public.ocr_get_reference_catalog() to anon;

comment on function public.ocr_get_reference_catalog() is 'Machine-only canonical reference catalog for OCR proposals. Returns active IDs only; no financial records or private HR data.';

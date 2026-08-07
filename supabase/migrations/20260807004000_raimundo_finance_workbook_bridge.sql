-- Valentina/Raimundo historical classification workbook bridge.
-- Raw historical labels and CLP ranges are preserved until a canonical Budget mapping is validated.

create table if not exists public.finance_historical_cost_centers (
  id uuid primary key default gen_random_uuid(),
  source_workbook_hash text not null,
  historical_label text not null,
  header_frequency integer not null default 0,
  division_id uuid references public.budget_divisions(id),
  category_id uuid references public.budget_categories(id),
  cost_center_id uuid references public.cost_centers(id),
  mapping_status text not null default 'unmapped' check (mapping_status in ('unmapped','mapped','ignored')),
  mapping_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_workbook_hash, historical_label)
);

create table if not exists public.finance_historical_rules (
  id uuid primary key default gen_random_uuid(),
  source_workbook_hash text not null,
  supplier_key text not null,
  supplier_name text not null,
  historical_cost_center text not null,
  historical_count integer not null default 0,
  match_count integer not null default 0,
  dominance numeric,
  median_clp numeric,
  accepted_min_clp numeric,
  accepted_max_clp numeric,
  confidence_label text,
  treatment text,
  historical_alternatives text,
  historical_cost_center_id uuid references public.finance_historical_cost_centers(id),
  promoted_rule_id uuid references public.finance_classification_rules(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_workbook_hash, supplier_key)
);

create index if not exists finance_historical_rules_supplier_idx on public.finance_historical_rules(supplier_key);
create index if not exists finance_historical_rules_center_idx on public.finance_historical_rules(historical_cost_center);

alter table public.finance_classification_rules
  add column if not exists historical_currency text not null default 'CLP';

alter table public.finance_historical_cost_centers enable row level security;
alter table public.finance_historical_rules enable row level security;

drop policy if exists finance_historical_cost_centers_read on public.finance_historical_cost_centers;
create policy finance_historical_cost_centers_read on public.finance_historical_cost_centers
  for select to authenticated using (auth.uid() is not null);

drop policy if exists finance_historical_rules_read on public.finance_historical_rules;
create policy finance_historical_rules_read on public.finance_historical_rules
  for select to authenticated using (auth.uid() is not null);

drop policy if exists finance_historical_cost_centers_write on public.finance_historical_cost_centers;
create policy finance_historical_cost_centers_write on public.finance_historical_cost_centers
  for all to authenticated
  using (public.current_app_role() in ('admin','approver'))
  with check (public.current_app_role() in ('admin','approver'));

drop policy if exists finance_historical_rules_write on public.finance_historical_rules;
create policy finance_historical_rules_write on public.finance_historical_rules
  for all to authenticated
  using (public.current_app_role() in ('admin','approver'))
  with check (public.current_app_role() in ('admin','approver'));

create or replace function public.import_raimundo_finance_workbook(
  p_workbook_hash text,
  p_centers jsonb,
  p_rules jsonb,
  p_documents jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := public.current_app_role();
  v_center jsonb;
  v_rule jsonb;
  v_doc jsonb;
  v_center_id uuid;
  v_division_id uuid;
  v_centers integer := 0;
  v_rules integer := 0;
  v_documents integer := 0;
  v_status text;
  v_label text;
begin
  if v_role not in ('admin','approver','service_role') then
    raise exception 'Not authorized to import finance workbook';
  end if;
  if coalesce(p_workbook_hash,'') = '' then raise exception 'Missing workbook hash'; end if;
  if jsonb_typeof(p_centers) <> 'array' or jsonb_typeof(p_rules) <> 'array' or jsonb_typeof(p_documents) <> 'array' then
    raise exception 'Centers, rules and documents must be arrays';
  end if;

  for v_center in select value from jsonb_array_elements(p_centers) loop
    insert into public.finance_historical_cost_centers(source_workbook_hash,historical_label,header_frequency)
    values (p_workbook_hash,v_center->>'label',coalesce((v_center->>'header_frequency')::integer,0))
    on conflict (source_workbook_hash,historical_label) do update
      set header_frequency=excluded.header_frequency,updated_at=now()
    returning id into v_center_id;
    v_centers := v_centers + 1;
  end loop;

  for v_rule in select value from jsonb_array_elements(p_rules) loop
    select id into v_center_id from public.finance_historical_cost_centers
      where source_workbook_hash=p_workbook_hash and historical_label=v_rule->>'historical_cost_center' limit 1;

    insert into public.finance_historical_rules(
      source_workbook_hash,supplier_key,supplier_name,historical_cost_center,historical_count,match_count,dominance,
      median_clp,accepted_min_clp,accepted_max_clp,confidence_label,treatment,historical_alternatives,historical_cost_center_id
    ) values (
      p_workbook_hash,v_rule->>'supplier_key',v_rule->>'supplier_name',v_rule->>'historical_cost_center',
      coalesce((v_rule->>'historical_count')::integer,0),coalesce((v_rule->>'match_count')::integer,0),nullif(v_rule->>'dominance','')::numeric,
      nullif(v_rule->>'median_clp','')::numeric,nullif(v_rule->>'accepted_min_clp','')::numeric,nullif(v_rule->>'accepted_max_clp','')::numeric,
      nullif(v_rule->>'confidence_label',''),nullif(v_rule->>'treatment',''),nullif(v_rule->>'historical_alternatives',''),v_center_id
    )
    on conflict (source_workbook_hash,supplier_key) do update set
      supplier_name=excluded.supplier_name,historical_cost_center=excluded.historical_cost_center,historical_count=excluded.historical_count,
      match_count=excluded.match_count,dominance=excluded.dominance,median_clp=excluded.median_clp,accepted_min_clp=excluded.accepted_min_clp,
      accepted_max_clp=excluded.accepted_max_clp,confidence_label=excluded.confidence_label,treatment=excluded.treatment,
      historical_alternatives=excluded.historical_alternatives,historical_cost_center_id=excluded.historical_cost_center_id,updated_at=now();
    v_rules := v_rules + 1;
  end loop;

  for v_doc in select value from jsonb_array_elements(p_documents) loop
    v_label := coalesce(v_doc->>'historical_cost_center','');
    v_division_id := null;
    if v_label ~ '^\(ADM\)' then select id into v_division_id from public.budget_divisions where source_key='admin-general' limit 1;
    elsif v_label ~ '^\((HOSP FARM|HOSPITALITY FARM)\)' then select id into v_division_id from public.budget_divisions where source_key='hospitality-farm' limit 1;
    elsif v_label ~ '^\((HOSP TOROBAYO|HOSPITALITY TOROBAYO)\)' then select id into v_division_id from public.budget_divisions where source_key='hospitality-torobayo' limit 1;
    elsif v_label ~ '^\(LANDSCAPING\)' then select id into v_division_id from public.budget_divisions where source_key='landscaping' limit 1;
    elsif v_label ~ '^\(CATTLE ?\)' then select id into v_division_id from public.budget_divisions where source_key='farming-cattle' limit 1;
    elsif v_label ~ '^\(VINEYARD\)' then select id into v_division_id from public.budget_divisions where source_key='farming-vineyard' limit 1;
    elsif v_label ~ '^\(HORSES\)' then select id into v_division_id from public.budget_divisions where source_key='farming-horses' limit 1;
    elsif v_label ~ '^\(ORCHARD\)' then select id into v_division_id from public.budget_divisions where source_key='farming-orchard' limit 1;
    end if;

    v_status := case v_doc->>'classification_status' when 'ready' then 'ready' when 'exception' then 'exception' else 'manual_review' end;

    insert into public.finance_documents(
      document_type,external_source,external_id,supplier_name,supplier_rut,document_number,document_date,description,total_amount,currency,
      division_id,classification_status,classification_reason,historical_count,historical_dominance,accepted_min,accepted_max,amount_in_range,
      duplicate_key,source_payload
    ) values (
      'invoice','raimundo_workbook',v_doc->>'external_id',v_doc->>'supplier_name',nullif(v_doc->>'supplier_rut',''),v_doc->>'document_number',
      (v_doc->>'document_date')::date,nullif(v_doc->>'description',''),coalesce((v_doc->>'total_amount')::numeric,0),'CLP',v_division_id,v_status,
      nullif(v_doc->>'classification_reason',''),coalesce((v_doc->>'historical_count')::integer,0),nullif(v_doc->>'historical_dominance','')::numeric,
      nullif(v_doc->>'accepted_min','')::numeric,nullif(v_doc->>'accepted_max','')::numeric,
      case when nullif(v_doc->>'accepted_min','') is null or nullif(v_doc->>'accepted_max','') is null then null
           else (v_doc->>'total_amount')::numeric between (v_doc->>'accepted_min')::numeric and (v_doc->>'accepted_max')::numeric end,
      md5(v_doc->>'external_id'),
      jsonb_build_object('historical_cost_center',v_label,'confidence_label',v_doc->>'confidence_label','decision_source',v_doc->>'decision_source',
        'source_row',nullif(v_doc->>'source_row','')::integer,'source_workbook_hash',p_workbook_hash,'canonical_category_pending',true)
    ) on conflict do nothing;
    if found then v_documents := v_documents + 1; end if;
  end loop;

  return jsonb_build_object('success',true,'centers',v_centers,'rules',v_rules,'documents_inserted',v_documents,'workbook_hash',p_workbook_hash);
end;
$$;

revoke all on function public.import_raimundo_finance_workbook(text,jsonb,jsonb,jsonb) from public;
grant execute on function public.import_raimundo_finance_workbook(text,jsonb,jsonb,jsonb) to authenticated;

update public.finance_historical_cost_centers c set division_id = d.id, updated_at=now()
from public.budget_divisions d
where c.division_id is null and (
  (c.historical_label ~ '^\(ADM\)' and d.source_key='admin-general') or
  (c.historical_label ~ '^\((HOSP FARM|HOSPITALITY FARM)\)' and d.source_key='hospitality-farm') or
  (c.historical_label ~ '^\((HOSP TOROBAYO|HOSPITALITY TOROBAYO)\)' and d.source_key='hospitality-torobayo') or
  (c.historical_label ~ '^\(LANDSCAPING\)' and d.source_key='landscaping') or
  (c.historical_label ~ '^\(CATTLE ?\)' and d.source_key='farming-cattle') or
  (c.historical_label ~ '^\(VINEYARD\)' and d.source_key='farming-vineyard') or
  (c.historical_label ~ '^\(HORSES\)' and d.source_key='farming-horses') or
  (c.historical_label ~ '^\(ORCHARD\)' and d.source_key='farming-orchard')
);

drop view if exists public.finance_approval_queue;
create view public.finance_approval_queue as
select d.id,d.document_type,d.external_source,d.external_id,d.supplier_name,d.supplier_rut,d.document_number,d.document_date,d.due_date,d.description,
  d.net_amount,d.tax_amount,d.total_amount,d.currency,d.classification_status,d.confidence,d.classification_reason,d.historical_count,d.historical_dominance,
  d.historical_median,d.accepted_min,d.accepted_max,d.amount_in_range,d.decision_notes,d.approved_at,d.rejected_at,d.division_id,
  bd.name as division_name,bd.source_key as division_key,d.category_id,bc.name as category_name,bc.source_key as category_key,d.cost_center_id,
  coalesce(cc.name,nullif(d.source_payload->>'historical_cost_center','')) as cost_center_name,cc.code as cost_center_code,
  d.source_payload->>'confidence_label' as confidence_label,
  case d.classification_status when 'ready' then 1 when 'exception' then 2 when 'manual_review' then 3 when 'approved' then 4 when 'rejected' then 5 else 9 end as queue_order
from public.finance_documents d
left join public.budget_divisions bd on bd.id=d.division_id
left join public.budget_categories bc on bc.id=d.category_id
left join public.cost_centers cc on cc.id=d.cost_center_id;
grant select on public.finance_approval_queue to authenticated;

create or replace view public.finance_center_mapping_queue as
select c.id,c.source_workbook_hash,c.historical_label,c.header_frequency,c.division_id,d.name as division_name,d.source_key as division_key,
  c.category_id,bc.name as category_name,bc.source_key as category_key,c.mapping_status,c.mapping_note,
  count(fd.id) filter (where fd.classification_status in ('ready','exception','manual_review')) as open_document_count,
  count(hr.id) as historical_rule_count
from public.finance_historical_cost_centers c
left join public.budget_divisions d on d.id=c.division_id
left join public.budget_categories bc on bc.id=c.category_id
left join public.finance_documents fd on fd.source_payload->>'historical_cost_center'=c.historical_label and fd.source_payload->>'source_workbook_hash'=c.source_workbook_hash
left join public.finance_historical_rules hr on hr.historical_cost_center_id=c.id
group by c.id,d.name,d.source_key,bc.name,bc.source_key;
grant select on public.finance_center_mapping_queue to authenticated;

create or replace function public.map_finance_historical_center(p_center_id uuid,p_division_id uuid,p_category_id uuid,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_role text:=public.current_app_role();
  v_center public.finance_historical_cost_centers%rowtype;
  v_rule record;
  v_promoted uuid;
  v_docs integer:=0;
  v_rules integer:=0;
begin
  if v_role not in ('admin','approver','service_role') then raise exception 'Not authorized'; end if;
  select * into v_center from public.finance_historical_cost_centers where id=p_center_id for update;
  if not found then raise exception 'Historical center not found'; end if;
  if not exists(select 1 from public.budget_categories where id=p_category_id and division_id=p_division_id and is_active=true) then
    raise exception 'Category does not belong to selected division';
  end if;

  update public.finance_historical_cost_centers set division_id=p_division_id,category_id=p_category_id,mapping_status='mapped',mapping_note=p_note,updated_at=now() where id=p_center_id;
  update public.finance_documents set division_id=p_division_id,category_id=p_category_id,updated_at=now(),
    source_payload=source_payload || jsonb_build_object('canonical_category_pending',false,'historical_center_mapping_id',p_center_id)
  where source_payload->>'historical_cost_center'=v_center.historical_label and source_payload->>'source_workbook_hash'=v_center.source_workbook_hash
    and classification_status in ('ready','exception','manual_review');
  get diagnostics v_docs=row_count;

  for v_rule in select * from public.finance_historical_rules where historical_cost_center_id=p_center_id and promoted_rule_id is null loop
    insert into public.finance_classification_rules(
      supplier_name_pattern,supplier_rut,division_id,category_id,minimum_history,minimum_dominance,accepted_min,accepted_max,
      historical_median,historical_count,historical_dominance,historical_currency,is_active,source_note
    ) values (
      v_rule.supplier_name,v_rule.supplier_key,p_division_id,p_category_id,3,0.8,v_rule.accepted_min_clp,v_rule.accepted_max_clp,
      v_rule.median_clp,v_rule.historical_count,v_rule.dominance,'CLP',true,
      concat('Valentina/Raimundo workbook ',v_center.source_workbook_hash,' · ',v_center.historical_label,' · ',coalesce(v_rule.treatment,''))
    ) returning id into v_promoted;
    update public.finance_historical_rules set promoted_rule_id=v_promoted,updated_at=now() where id=v_rule.id;
    v_rules:=v_rules+1;
  end loop;

  return jsonb_build_object('success',true,'documents_updated',v_docs,'rules_promoted',v_rules,'center',v_center.historical_label);
end $$;

revoke all on function public.map_finance_historical_center(uuid,uuid,uuid,text) from public;
grant execute on function public.map_finance_historical_center(uuid,uuid,uuid,text) to authenticated;

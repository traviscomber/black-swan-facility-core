alter table public.procurement_requests
  add column if not exists source_type text,
  add column if not exists source_ref text,
  add column if not exists source_path text;

create index if not exists idx_procurement_requests_source_lineage
  on public.procurement_requests (source_type, source_ref)
  where source_type is not null and source_ref is not null;

comment on column public.procurement_requests.source_type is
  'Optional canonical source domain that generated or originated the procurement requirement.';
comment on column public.procurement_requests.source_ref is
  'Stable source reference within source_type; used to reconcile an operational demand with its procurement lifecycle.';
comment on column public.procurement_requests.source_path is
  'Human-auditable source path or route for the originating operational requirement.';

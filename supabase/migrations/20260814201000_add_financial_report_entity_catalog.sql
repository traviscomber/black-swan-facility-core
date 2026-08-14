-- Black Swan OS: authorized financial-report entity catalog.
-- Uses the same canonical policy as report retrieval so the frontend never infers
-- member/entity visibility from a broader legal-entity listing.

create or replace function public.list_financial_report_entities()
returns table (
  id uuid,
  code text,
  display_name text,
  entity_type text
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select le.id, le.code, le.display_name, le.entity_type
  from public.legal_entities le
  where le.active
    and public.can_view_financial_report(le.id)
  order by case le.code when 'BS_CORPORACION' then 1 when 'BS_INFRA' then 2 else 3 end, le.display_name;
$function$;

revoke all on function public.list_financial_report_entities() from public;
grant execute on function public.list_financial_report_entities() to authenticated;

comment on function public.list_financial_report_entities() is 'Returns only legal entities the current authenticated user may access through the canonical financial reporting boundary.';

alter table public.budget_divisions
  add column if not exists parent_id uuid references public.budget_divisions(id),
  add column if not exists source_key text,
  add column if not exists source_label text,
  add column if not exists is_aggregate boolean not null default false,
  add column if not exists sort_order integer not null default 100;

alter table public.budget_categories
  add column if not exists parent_id uuid references public.budget_categories(id),
  add column if not exists source_key text,
  add column if not exists source_label text,
  add column if not exists category_role text,
  add column if not exists source_row integer,
  add column if not exists sort_order integer not null default 100;

create unique index if not exists budget_divisions_source_key_uq
  on public.budget_divisions(source_key)
  where source_key is not null;

create unique index if not exists budget_categories_source_key_uq
  on public.budget_categories(division_id, source_key)
  where division_id is not null and source_key is not null;

create unique index if not exists budgets_period_uq
  on public.budgets(division_id, category_id, year, month)
  where category_id is not null and month is not null;

create table if not exists public.budget_import_runs (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_hash text not null,
  storage_path text,
  workbook_title text,
  fiscal_year integer not null check (fiscal_year between 2000 and 2100),
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  row_count integer not null default 0,
  warning_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  imported_by uuid default auth.uid(),
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists budget_import_runs_year_created_idx
  on public.budget_import_runs(fiscal_year, created_at desc);
create index if not exists budget_import_runs_hash_idx
  on public.budget_import_runs(file_hash, status);

create table if not exists public.budget_import_lines (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.budget_import_runs(id) on delete cascade,
  division_id uuid not null references public.budget_divisions(id),
  category_id uuid not null references public.budget_categories(id),
  division_key text not null,
  division_name text not null,
  parent_division_key text,
  category_key text not null,
  category_name text not null,
  category_role text not null check (category_role in ('cost','income')),
  fiscal_year integer not null,
  month integer not null check (month between 1 and 12),
  plan_amount numeric not null default 0,
  actual_amount numeric not null default 0,
  source_sheet text not null,
  source_row integer not null,
  source_plan_cell text not null,
  source_actual_cell text not null,
  source_plan_formula text,
  source_actual_formula text,
  warnings text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (run_id, division_key, category_key, month)
);

alter table public.budgets
  add column if not exists import_run_id uuid references public.budget_import_runs(id),
  add column if not exists source_line_id uuid references public.budget_import_lines(id),
  add column if not exists source_kind text not null default 'manual',
  add column if not exists source_sheet text,
  add column if not exists source_plan_cell text,
  add column if not exists source_actual_cell text;

alter table public.budget_import_runs enable row level security;
alter table public.budget_import_lines enable row level security;

drop policy if exists budget_import_runs_read on public.budget_import_runs;
create policy budget_import_runs_read on public.budget_import_runs
  for select to authenticated using (auth.uid() is not null);

drop policy if exists budget_import_runs_finance_write on public.budget_import_runs;
create policy budget_import_runs_finance_write on public.budget_import_runs
  for all to authenticated
  using (public.current_app_role() in ('admin','approver'))
  with check (public.current_app_role() in ('admin','approver'));

drop policy if exists budget_import_lines_read on public.budget_import_lines;
create policy budget_import_lines_read on public.budget_import_lines
  for select to authenticated using (auth.uid() is not null);

drop policy if exists budget_import_lines_finance_write on public.budget_import_lines;
create policy budget_import_lines_finance_write on public.budget_import_lines
  for all to authenticated
  using (public.current_app_role() in ('admin','approver'))
  with check (public.current_app_role() in ('admin','approver'));

insert into storage.buckets (id, name, public, file_size_limit)
values ('budget-workbooks', 'budget-workbooks', false, 26214400)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists budget_workbooks_read on storage.objects;
create policy budget_workbooks_read on storage.objects
  for select to authenticated
  using (bucket_id = 'budget-workbooks' and public.current_app_role() in ('admin','approver'));

drop policy if exists budget_workbooks_insert on storage.objects;
create policy budget_workbooks_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'budget-workbooks' and public.current_app_role() in ('admin','approver'));

drop policy if exists budget_workbooks_delete on storage.objects;
create policy budget_workbooks_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'budget-workbooks' and public.current_app_role() = 'admin');

create or replace function public.import_budget_workbook(
  p_file_name text,
  p_file_hash text,
  p_storage_path text,
  p_workbook_title text,
  p_fiscal_year integer,
  p_lines jsonb,
  p_warnings jsonb default '[]'::jsonb,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := public.current_app_role();
  v_run_id uuid;
  v_existing_run_id uuid;
  v_line jsonb;
  v_parent_id uuid;
  v_division_id uuid;
  v_category_id uuid;
  v_source_line_id uuid;
  v_month integer;
  v_plan numeric;
  v_actual numeric;
  v_line_count integer := 0;
  v_budget_count integer := 0;
begin
  if v_role not in ('admin','approver','service_role') then
    raise exception 'Only finance approvers can import the master budget workbook';
  end if;
  if p_fiscal_year not between 2000 and 2100 then
    raise exception 'Invalid fiscal year';
  end if;
  if jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Budget lines must be a JSON array';
  end if;
  if jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_lines) > 2000 then
    raise exception 'Unexpected budget line count';
  end if;

  select id into v_existing_run_id
  from public.budget_import_runs
  where file_hash = p_file_hash and status = 'completed'
  order by created_at desc
  limit 1;

  if v_existing_run_id is not null then
    return jsonb_build_object('success', true, 'already_imported', true, 'run_id', v_existing_run_id);
  end if;

  insert into public.budget_import_runs (
    file_name, file_hash, storage_path, workbook_title, fiscal_year, status,
    warning_count, warnings, metadata, imported_by
  ) values (
    p_file_name, p_file_hash, p_storage_path, p_workbook_title, p_fiscal_year, 'processing',
    jsonb_array_length(coalesce(p_warnings, '[]'::jsonb)), coalesce(p_warnings, '[]'::jsonb),
    coalesce(p_metadata, '{}'::jsonb), auth.uid()
  ) returning id into v_run_id;

  begin
    for v_line in select value from jsonb_array_elements(p_lines)
    loop
      v_month := nullif(v_line->>'month','')::integer;
      if v_month not between 1 and 12 then raise exception 'Invalid month in budget line'; end if;
      if coalesce(v_line->>'division_key','') = '' or coalesce(v_line->>'category_key','') = '' then
        raise exception 'Missing canonical key in budget line';
      end if;
      v_plan := coalesce(nullif(v_line->>'plan_amount','')::numeric, 0);
      v_actual := coalesce(nullif(v_line->>'actual_amount','')::numeric, 0);
      v_parent_id := null;

      if coalesce(v_line->>'parent_division_key','') <> '' then
        select id into v_parent_id from public.budget_divisions where source_key = v_line->>'parent_division_key' limit 1;
        if v_parent_id is null then
          select id into v_parent_id from public.budget_divisions where lower(name) = lower(v_line->>'parent_division_name') limit 1;
        end if;
        if v_parent_id is null then
          insert into public.budget_divisions (name, type, is_active, source_key, source_label, is_aggregate, sort_order)
          values (v_line->>'parent_division_name', 'P&L', true, v_line->>'parent_division_key', v_line->>'parent_division_name', true, (v_line->>'division_sort_order')::integer - 1)
          returning id into v_parent_id;
        else
          update public.budget_divisions
          set source_key = coalesce(source_key, v_line->>'parent_division_key'),
              source_label = coalesce(source_label, v_line->>'parent_division_name'),
              is_aggregate = true,
              updated_at = current_timestamp
          where id = v_parent_id;
        end if;
      end if;

      select id into v_division_id from public.budget_divisions where source_key = v_line->>'division_key' limit 1;
      if v_division_id is null then
        select id into v_division_id from public.budget_divisions where lower(name) = lower(v_line->>'division_name') limit 1;
      end if;
      if v_division_id is null then
        insert into public.budget_divisions (name, type, is_active, source_key, source_label, parent_id, is_aggregate, sort_order)
        values (v_line->>'division_name', 'P&L', true, v_line->>'division_key', v_line->>'division_name', v_parent_id, false, (v_line->>'division_sort_order')::integer)
        returning id into v_division_id;
      else
        update public.budget_divisions
        set source_key = coalesce(source_key, v_line->>'division_key'),
            source_label = coalesce(source_label, v_line->>'division_name'),
            parent_id = v_parent_id,
            is_aggregate = false,
            sort_order = coalesce(nullif(v_line->>'division_sort_order','')::integer, sort_order),
            updated_at = current_timestamp
        where id = v_division_id;
      end if;

      select id into v_category_id
      from public.budget_categories
      where division_id = v_division_id and source_key = v_line->>'category_key'
      limit 1;
      if v_category_id is null then
        select id into v_category_id
        from public.budget_categories
        where division_id = v_division_id and lower(name) = lower(v_line->>'category_name')
        limit 1;
      end if;
      if v_category_id is null then
        insert into public.budget_categories (
          division_id, name, category_type, is_active, source_key, source_label,
          category_role, source_row, sort_order
        ) values (
          v_division_id, v_line->>'category_name',
          case when v_line->>'category_role' = 'income' then 'Revenue' else 'Operational' end,
          true, v_line->>'category_key', v_line->>'category_name', v_line->>'category_role',
          (v_line->>'source_row')::integer, (v_line->>'category_sort_order')::integer
        ) returning id into v_category_id;
      else
        update public.budget_categories
        set source_key = coalesce(source_key, v_line->>'category_key'),
            source_label = coalesce(source_label, v_line->>'category_name'),
            category_role = v_line->>'category_role',
            source_row = (v_line->>'source_row')::integer,
            sort_order = (v_line->>'category_sort_order')::integer,
            category_type = case when v_line->>'category_role' = 'income' then 'Revenue' else 'Operational' end,
            updated_at = current_timestamp
        where id = v_category_id;
      end if;

      insert into public.budget_import_lines (
        run_id, division_id, category_id, division_key, division_name, parent_division_key,
        category_key, category_name, category_role, fiscal_year, month, plan_amount, actual_amount,
        source_sheet, source_row, source_plan_cell, source_actual_cell, source_plan_formula,
        source_actual_formula, warnings
      ) values (
        v_run_id, v_division_id, v_category_id, v_line->>'division_key', v_line->>'division_name',
        nullif(v_line->>'parent_division_key',''), v_line->>'category_key', v_line->>'category_name',
        v_line->>'category_role', p_fiscal_year, v_month, v_plan, v_actual,
        v_line->>'source_sheet', (v_line->>'source_row')::integer, v_line->>'source_plan_cell',
        v_line->>'source_actual_cell', nullif(v_line->>'source_plan_formula',''),
        nullif(v_line->>'source_actual_formula',''),
        coalesce(array(select jsonb_array_elements_text(coalesce(v_line->'warnings','[]'::jsonb))), '{}'::text[])
      ) returning id into v_source_line_id;

      insert into public.budgets (
        division_id, category_id, year, month, budgeted_amount, actual_amount, variance,
        import_run_id, source_line_id, source_kind, source_sheet, source_plan_cell, source_actual_cell
      ) values (
        v_division_id, v_category_id, p_fiscal_year, v_month, v_plan, v_actual, v_plan - v_actual,
        v_run_id, v_source_line_id, 'workbook', v_line->>'source_sheet', v_line->>'source_plan_cell', v_line->>'source_actual_cell'
      )
      on conflict (division_id, category_id, year, month) where category_id is not null and month is not null
      do update set
        budgeted_amount = excluded.budgeted_amount,
        actual_amount = excluded.actual_amount,
        variance = excluded.variance,
        import_run_id = excluded.import_run_id,
        source_line_id = excluded.source_line_id,
        source_kind = excluded.source_kind,
        source_sheet = excluded.source_sheet,
        source_plan_cell = excluded.source_plan_cell,
        source_actual_cell = excluded.source_actual_cell,
        updated_at = current_timestamp;

      v_line_count := v_line_count + 1;
      v_budget_count := v_budget_count + 1;
    end loop;

    update public.budget_import_runs
    set status = 'completed', row_count = v_line_count, imported_at = now(), updated_at = now()
    where id = v_run_id;
  exception when others then
    update public.budget_import_runs
    set status = 'failed', error_message = sqlerrm, updated_at = now()
    where id = v_run_id;
    return jsonb_build_object('success', false, 'run_id', v_run_id, 'error', sqlerrm);
  end;

  return jsonb_build_object(
    'success', true,
    'already_imported', false,
    'run_id', v_run_id,
    'line_count', v_line_count,
    'budget_count', v_budget_count,
    'fiscal_year', p_fiscal_year
  );
end;
$$;

revoke all on function public.import_budget_workbook(text,text,text,text,integer,jsonb,jsonb,jsonb) from public;
grant execute on function public.import_budget_workbook(text,text,text,text,integer,jsonb,jsonb,jsonb) to authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'budget_import_runs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.budget_import_runs;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'budgets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.budgets;
  END IF;
END $$;

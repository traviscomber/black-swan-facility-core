-- Black Swan OS accounting journal editor regression gate.
-- Run after accounting foundation + posting + journal editor migrations.
-- Read-only assertions; rollback keeps the test non-destructive.

begin;

do $test$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.replace_draft_accounting_journal_lines(uuid,jsonb)'::regprocedure)
  into v_definition;

  if v_definition not like '%current_app_role() <> ''admin''%' then
    raise exception 'JOURNAL EDITOR REGRESSION: line replacement is not admin-only';
  end if;

  if v_definition not like '%v_entry.status <> ''draft''%' then
    raise exception 'JOURNAL EDITOR REGRESSION: approved/posted journals are not protected from line edits';
  end if;

  if v_definition not like '%coa.legal_entity_id = v_entry.legal_entity_id%' then
    raise exception 'JOURNAL EDITOR REGRESSION: account legal-entity ownership is not enforced';
  end if;

  if v_definition not like '%d.legal_entity_id = v_entry.legal_entity_id%' then
    raise exception 'JOURNAL EDITOR REGRESSION: department legal-entity ownership is not enforced';
  end if;

  if v_definition not like '%a.legal_entity_id = v_entry.legal_entity_id%' then
    raise exception 'JOURNAL EDITOR REGRESSION: cost-center legal-entity ownership is not enforced';
  end if;

  if v_definition not like '%return public.validate_accounting_journal(p_journal_id)%' then
    raise exception 'JOURNAL EDITOR REGRESSION: canonical validation is not returned after save';
  end if;
end;
$test$;

-- Anonymous callers must never receive journal mutation authority.
do $test$
begin
  if has_function_privilege('anon', 'public.replace_draft_accounting_journal_lines(uuid,jsonb)', 'EXECUTE') then
    raise exception 'JOURNAL EDITOR REGRESSION: anon can replace journal lines';
  end if;

  if has_function_privilege('anon', 'public.approve_accounting_journal(uuid)', 'EXECUTE') then
    raise exception 'JOURNAL EDITOR REGRESSION: anon can approve journals';
  end if;

  if has_function_privilege('anon', 'public.post_accounting_journal(uuid)', 'EXECUTE') then
    raise exception 'JOURNAL EDITOR REGRESSION: anon can post journals';
  end if;
end;
$test$;

rollback;

revoke all on function public.link_asana_task_external_ref(uuid,text,text,text,text,date,timestamptz) from public;
revoke all on function public.link_asana_task_external_ref(uuid,text,text,text,text,date,timestamptz) from anon;
grant execute on function public.link_asana_task_external_ref(uuid,text,text,text,text,date,timestamptz) to authenticated;

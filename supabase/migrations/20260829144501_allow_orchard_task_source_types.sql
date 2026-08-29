alter table public.tasks drop constraint if exists tasks_source_type_check;

alter table public.tasks add constraint tasks_source_type_check check (
  source_type is null or source_type = any (array[
    'hospitality_request'::text,
    'housekeeping_task'::text,
    'maintenance_task'::text,
    'cattle_area'::text,
    'issue'::text,
    'orchard_general'::text,
    'orchard_succession'::text,
    'orchard_succession_sow'::text,
    'orchard_succession_transplant'::text,
    'orchard_succession_harvest'::text
  ])
);

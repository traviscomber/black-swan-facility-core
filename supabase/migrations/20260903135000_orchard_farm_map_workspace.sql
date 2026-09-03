begin;

create table if not exists public.orchard_farm_map_objects (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null,
  plot_id uuid references public.orchard_plots(id) on delete cascade,
  object_type text not null check (object_type in ('field_block','greenhouse','tunnel','farm_area','water','electricity','internet')),
  name text not null,
  x_pct numeric not null default 50 check (x_pct between 0 and 100),
  y_pct numeric not null default 50 check (y_pct between 0 and 100),
  width_pct numeric not null default 10 check (width_pct > 0 and width_pct <= 100),
  height_pct numeric not null default 10 check (height_pct > 0 and height_pct <= 100),
  rotation_deg numeric not null default 0,
  bed_count integer check (bed_count is null or bed_count > 0),
  bed_length_m numeric check (bed_length_m is null or bed_length_m > 0),
  bed_width_cm numeric check (bed_width_cm is null or bed_width_cm > 0),
  path_width_cm numeric check (path_width_cm is null or path_width_cm >= 0),
  line_points jsonb,
  placement_source text not null default 'operator',
  is_visible boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists orchard_farm_map_objects_plot_unique
  on public.orchard_farm_map_objects(plot_id) where plot_id is not null;
create index if not exists orchard_farm_map_objects_location_idx
  on public.orchard_farm_map_objects(location_id);

alter table public.orchard_farm_map_objects enable row level security;
grant select, insert, update, delete on table public.orchard_farm_map_objects to authenticated;

drop policy if exists orchard_farm_map_objects_scoped on public.orchard_farm_map_objects;
create policy orchard_farm_map_objects_scoped on public.orchard_farm_map_objects
for all to authenticated
using (public.can_access_orchard_location(location_id))
with check (public.can_access_orchard_location(location_id));

insert into public.orchard_farm_map_objects (
  location_id, plot_id, object_type, name, x_pct, y_pct, width_pct, height_pct, rotation_deg,
  bed_count, bed_length_m, bed_width_cm, path_width_cm, placement_source
)
select p.location_id, p.id, 'field_block', p.name, v.x_pct, v.y_pct, v.width_pct, v.height_pct, v.rotation_deg,
       count(b.id)::int, max(b.length_m), max(b.width_m) * 100, 40,
       'reference_image_2026_09_03_approximate'
from (values
  ('Current 01',31::numeric,28::numeric,9::numeric,13::numeric,-12::numeric),
  ('Current 02',43,24,9,13,-3),
  ('Current 03',57,27,9,13,8),
  ('Current 04',67,37,9,13,16),
  ('Current 05',59,50,9,13,12),
  ('Expansion 01',48,58,9,13,-2),
  ('Expansion 02',34,54,9,13,-10),
  ('Expansion 03',26,42,9,13,-14)
) as v(name,x_pct,y_pct,width_pct,height_pct,rotation_deg)
join public.orchard_plots p on p.name=v.name and p.status='active'
left join public.orchard_beds b on b.plot_id=p.id and b.status='active'
where p.location_id is not null
  and not exists (select 1 from public.orchard_farm_map_objects o where o.plot_id=p.id)
group by p.location_id,p.id,p.name,v.x_pct,v.y_pct,v.width_pct,v.height_pct,v.rotation_deg;

create or replace function public.orchard_create_growing_location(
  p_location_id uuid,
  p_object_type text,
  p_name text,
  p_bed_count integer default null,
  p_bed_length_m numeric default null,
  p_bed_width_cm numeric default null,
  p_path_width_cm numeric default null,
  p_x_pct numeric default 50,
  p_y_pct numeric default 50
)
returns jsonb
language plpgsql
set search_path=public,pg_temp
as $$
declare
  v_plot_id uuid;
  v_object_id uuid;
  v_i integer;
begin
  if not public.can_access_orchard_location(p_location_id) then
    raise exception 'Not authorized for Orchard location';
  end if;
  if p_object_type not in ('field_block','greenhouse','tunnel','farm_area','water','electricity','internet') then
    raise exception 'Unsupported Farm Map object type';
  end if;
  if nullif(trim(p_name),'') is null then
    raise exception 'Name is required';
  end if;

  if p_object_type in ('field_block','greenhouse') then
    if coalesce(p_bed_count,0) <= 0 or coalesce(p_bed_length_m,0) <= 0 or coalesce(p_bed_width_cm,0) <= 0 or coalesce(p_path_width_cm,-1) < 0 then
      raise exception 'Beds, bed length, bed width and path width are required';
    end if;
    insert into public.orchard_plots(name,location_id,description,plot_type,size_sqm,status,notes)
    values(trim(p_name),p_location_id,
      case when p_object_type='greenhouse' then 'Greenhouse growing location created from Farm Map.' else 'Field block created from Farm Map.' end,
      'vegetable_garden',null,'active','Farm Map physical definition; square metres intentionally not required.')
    returning id into v_plot_id;

    for v_i in 1..p_bed_count loop
      insert into public.orchard_beds(plot_id,name,length_m,width_m,status,planning_order,notes)
      values(v_plot_id,lpad(v_i::text,2,'0'),p_bed_length_m,p_bed_width_cm/100.0,'active',v_i,
        'Created from Farm Map; path width '||p_path_width_cm||' cm.');
    end loop;
  end if;

  insert into public.orchard_farm_map_objects(
    location_id,plot_id,object_type,name,x_pct,y_pct,width_pct,height_pct,bed_count,bed_length_m,bed_width_cm,path_width_cm,placement_source
  ) values (
    p_location_id,v_plot_id,p_object_type,trim(p_name),greatest(0,least(100,p_x_pct)),greatest(0,least(100,p_y_pct)),
    case when p_object_type in ('field_block','greenhouse') then 10 else 6 end,
    case when p_object_type in ('field_block','greenhouse') then 14 else 6 end,
    p_bed_count,p_bed_length_m,p_bed_width_cm,p_path_width_cm,'operator'
  ) returning id into v_object_id;

  return jsonb_build_object('object_id',v_object_id,'plot_id',v_plot_id);
end;
$$;

revoke all on function public.orchard_create_growing_location(uuid,text,text,integer,numeric,numeric,numeric,numeric,numeric) from public;
grant execute on function public.orchard_create_growing_location(uuid,text,text,integer,numeric,numeric,numeric,numeric,numeric) to authenticated,service_role;

commit;

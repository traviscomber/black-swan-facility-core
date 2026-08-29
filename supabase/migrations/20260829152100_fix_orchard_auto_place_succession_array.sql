create or replace function public.orchard_auto_place_succession(
  p_succession_id uuid,
  p_plot_id uuid,
  p_start_date date,
  p_end_date date,
  p_required_area_sqm numeric default null
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_remaining numeric;
  v_bed record;
  v_area numeric;
  v_created uuid[] := array[]::uuid[];
  v_created_id uuid;
begin
  if not public.can_access_orchard_succession(p_succession_id) then raise exception 'Not authorized for succession'; end if;
  if not public.can_access_orchard_plot(p_plot_id) then raise exception 'Not authorized for plot'; end if;
  if p_end_date < p_start_date then raise exception 'End date must be on or after start date'; end if;
  select coalesce(p_required_area_sqm, s.planned_area_sqm, 0) into v_remaining from public.orchard_crop_successions s where s.id = p_succession_id;
  if v_remaining <= 0 then raise exception 'A positive required area is needed'; end if;

  for v_bed in
    select b.id, b.area_sqm, b.length_m, b.width_m
    from public.orchard_beds b
    where b.plot_id = p_plot_id and b.status = 'active'
      and not exists (
        select 1 from public.orchard_bed_allocations a
        where a.bed_id = b.id
          and daterange(a.planned_start_date, a.planned_end_date, '[]') && daterange(p_start_date, p_end_date, '[]')
      )
    order by coalesce(b.code, b.name), b.id
    for update
  loop
    v_area := coalesce(v_bed.area_sqm, coalesce(v_bed.length_m,0) * coalesce(v_bed.width_m,0));
    if v_area <= 0 then continue; end if;
    v_area := least(v_area, v_remaining);
    insert into public.orchard_bed_allocations(bed_id, crop_succession_id, planned_start_date, planned_end_date, allocated_area_sqm, notes)
    values(v_bed.id, p_succession_id, p_start_date, p_end_date, v_area, 'Auto-placed across available beds')
    returning id into v_created_id;
    v_created := array_append(v_created, v_created_id);
    v_remaining := v_remaining - v_area;
    exit when v_remaining <= 0;
  end loop;

  if v_remaining > 0 then raise exception 'Insufficient conflict-free bed area in selected plot'; end if;
  return jsonb_build_object('allocation_ids', to_jsonb(v_created), 'allocated_area_sqm', coalesce(p_required_area_sqm, (select planned_area_sqm from public.orchard_crop_successions where id=p_succession_id)));
end;
$$;
revoke all on function public.orchard_auto_place_succession(uuid,uuid,date,date,numeric) from public, anon;
grant execute on function public.orchard_auto_place_succession(uuid,uuid,date,date,numeric) to authenticated;

-- Data-integrity smoke check for Orchard reference photography.
-- This migration intentionally raises if any P-Y crop lacks a verified registry row.
do $$
begin
  if exists (
    select 1
    from public.orchard_crop_library c
    left join public.orchard_crop_photo_registry p
      on lower(trim(p.crop_name)) = lower(trim(c.crop_name))
    where upper(left(trim(c.crop_name),1)) in ('P','Q','R','S','T','U','V','W','Y')
      and (p.crop_name is null or p.verification_status <> 'verified' or p.photo_url is null or trim(p.photo_url) = '')
  ) then
    raise exception 'Orchard P-Y crop photo registry coverage is incomplete';
  end if;
end $$;
-- Cache Orchard crop photography in Supabase Storage so the catalog does not
-- depend on third-party image hosts at render time.
alter table public.orchard_crop_photo_registry
  add column if not exists source_photo_url text,
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists storage_public_url text,
  add column if not exists mime_type text,
  add column if not exists byte_size bigint,
  add column if not exists sha256 text,
  add column if not exists source_etag text,
  add column if not exists source_last_modified text,
  add column if not exists cache_control text,
  add column if not exists cached_at timestamptz,
  add column if not exists cache_status text not null default 'pending',
  add column if not exists image_width integer,
  add column if not exists image_height integer,
  add column if not exists source_final_url text,
  add column if not exists source_metadata jsonb;

update public.orchard_crop_photo_registry
set source_photo_url = coalesce(source_photo_url, photo_url)
where source_photo_url is null;

insert into storage.buckets (id, name, public)
values ('orchard-crop-photos','orchard-crop-photos',true)
on conflict (id) do update set public = true;

create index if not exists orchard_crop_photo_registry_cache_status_idx
  on public.orchard_crop_photo_registry (cache_status, crop_name);

-- Correct the Peach reference before it is cached locally.
update public.orchard_crop_photo_registry
set source_photo_url='https://commons.wikimedia.org/wiki/Special:FilePath/Peach_tree.jpg',
    photo_url='https://commons.wikimedia.org/wiki/Special:FilePath/Peach_tree.jpg',
    source_page='https://commons.wikimedia.org/wiki/File:Peach_tree.jpg',
    verification_status='verified',
    verified_at=now(),
    cache_status='pending',
    notes='FAO-aligned Peach / Prunus persica; verified Commons photo showing peach fruits on the tree.',
    updated_at=now()
where crop_name='Peach';

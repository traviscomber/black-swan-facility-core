create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  rut text,
  address text,
  commune text default 'Valdivia',
  region text default 'Los Ríos',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestampt
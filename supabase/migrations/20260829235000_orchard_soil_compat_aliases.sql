-- Keep the deployed Orchard soil UI compatible with the canonical legacy column names.
-- amendment_date and notes remain the source-of-truth columns.

alter table public.orchard_soil_amendments
  add column if not exists application_date date generated always as (amendment_date) stored,
  add column if not exists description text generated always as (notes) stored;

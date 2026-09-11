alter database postgres set timezone to 'America/Santiago';

alter table public.booking_settings
  add column if not exists timezone text not null default 'America/Santiago';

update public.booking_settings
set timezone = 'America/Santiago'
where id = 'default'
  and timezone is distinct from 'America/Santiago';

alter table public.booking_settings
  drop constraint if exists booking_settings_timezone_check;

alter table public.booking_settings
  add constraint booking_settings_timezone_check
  check (timezone = 'America/Santiago');

-- Black Swan OS: Chile-ready financial provider registry.
-- Stores provider capabilities and connection metadata only. API keys, webhook
-- secrets, JWS private keys and bank credentials remain in Cloudflare secrets.

create table if not exists public.financial_provider_catalog (
  provider_key text primary key,
  display_name text not null,
  country_code text,
  provider_type text not null,
  supports_bank_movements boolean not null default false,
  supports_balances boolean not null default false,
  supports_payment_initiation boolean not null default false,
  supports_card_payments boolean not null default false,
  supports_webhooks boolean not null default false,
  supports_polling boolean not null default false,
  chile_native boolean not null default false,
  status text not null default 'available',
  notes text,
  updated_at timestamptz not null default now(),
  constraint financial_provider_type_check check (provider_type in ('open_finance','bank_payment','card_gateway','global_payment')),
  constraint financial_provider_status_check check (status in ('available','optional','disabled'))
);

insert into public.financial_provider_catalog(
  provider_key, display_name, country_code, provider_type,
  supports_bank_movements, supports_balances, supports_payment_initiation,
  supports_card_payments, supports_webhooks, supports_polling, chile_native,
  status, notes
) values
  ('fintoc','Fintoc','CL','open_finance',true,true,true,false,true,true,true,'available','Preferred Chile bank connectivity / movements adapter.'),
  ('khipu','Khipu','CL','bank_payment',true,true,true,false,true,true,true,'available','Chile Open Finance and account-to-account payment adapter.'),
  ('transbank','Transbank Webpay','CL','card_gateway',false,false,false,true,true,false,true,'available','Chile local card-payment gateway adapter.'),
  ('stripe','Stripe',null,'global_payment',false,false,false,true,true,true,false,'optional','Optional international payments adapter; activation depends on an eligible Stripe account/entity.')
on conflict (provider_key) do update set
  display_name = excluded.display_name,
  country_code = excluded.country_code,
  provider_type = excluded.provider_type,
  supports_bank_movements = excluded.supports_bank_movements,
  supports_balances = excluded.supports_balances,
  supports_payment_initiation = excluded.supports_payment_initiation,
  supports_card_payments = excluded.supports_card_payments,
  supports_webhooks = excluded.supports_webhooks,
  supports_polling = excluded.supports_polling,
  chile_native = excluded.chile_native,
  status = excluded.status,
  notes = excluded.notes,
  updated_at = now();

alter table public.bank_connections
  add column if not exists environment text not null default 'test',
  add column if not exists webhook_status text not null default 'not_configured',
  add column if not exists last_webhook_at timestamptz,
  add column if not exists adapter_version text,
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb;

alter table public.bank_connections
  drop constraint if exists bank_connections_environment_check;
alter table public.bank_connections
  add constraint bank_connections_environment_check check (environment in ('test','production'));

alter table public.bank_connections
  drop constraint if exists bank_connections_webhook_status_check;
alter table public.bank_connections
  add constraint bank_connections_webhook_status_check check (webhook_status in ('not_configured','pending','active','error','disabled'));

alter table public.financial_provider_catalog enable row level security;
create policy financial_provider_catalog_authenticated_read
  on public.financial_provider_catalog for select to authenticated
  using (true);

comment on table public.financial_provider_catalog is 'Non-secret provider capabilities used to choose Chile financial adapters. Credentials live only in Cloudflare secrets.';

create table if not exists public.booking_external_financial_documents (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  external_ref text not null,
  document_type text not null,
  currency text not null,
  net_amount numeric not null default 0,
  gross_amount numeric not null default 0,
  client_name text,
  issue_date date,
  payment_date date,
  product_service text,
  status text,
  reconciliation_status text not null default 'observed',
  canonical_invoice_id uuid references public.invoices(id) on delete set null,
  raw_payload jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_system, external_ref)
);

create table if not exists public.booking_external_tax_rates (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  external_ref text not null,
  label text not null,
  rate numeric,
  tax_treatment text not null default 'rate',
  is_active boolean not null default true,
  observed_at timestamptz not null default now(),
  unique(source_system, external_ref)
);

alter table public.booking_external_financial_documents enable row level security;
alter table public.booking_external_tax_rates enable row level security;

create index if not exists booking_external_financial_documents_issue_date_idx on public.booking_external_financial_documents(issue_date desc);
create index if not exists booking_external_financial_documents_client_idx on public.booking_external_financial_documents(client_name);
create index if not exists booking_external_financial_documents_status_idx on public.booking_external_financial_documents(status);

insert into public.booking_external_tax_rates(source_system,external_ref,label,rate,tax_treatment,observed_at) values
('invoiceocean','23','23.00%',23,'rate','2026-09-10T23:59:00-03'),
('invoiceocean','8','8.00%',8,'rate','2026-09-10T23:59:00-03'),
('invoiceocean','5','5.00%',5,'rate','2026-09-10T23:59:00-03'),
('invoiceocean','0','0.00%',0,'rate','2026-09-10T23:59:00-03'),
('invoiceocean','exempt','exempt',null,'exempt','2026-09-10T23:59:00-03'),
('invoiceocean','not-taxable','not taxable',null,'not_taxable','2026-09-10T23:59:00-03')
on conflict(source_system,external_ref) do update set label=excluded.label,rate=excluded.rate,tax_treatment=excluded.tax_treatment,is_active=true,observed_at=excluded.observed_at;

insert into public.booking_external_financial_documents(source_system,external_ref,document_type,currency,net_amount,gross_amount,client_name,issue_date,payment_date,product_service,status,reconciliation_status,raw_payload,observed_at) values
('invoiceocean','E7','estimate','CLP',6050420.17,7200000.00,'Gaby Genovese','2026-04-02',null,'Black Swan Experience','Issued','observed','{}','2026-09-10T23:59:00-03'),
('invoiceocean','E6','estimate','CLP',4273109.25,5085000.00,'Gala Bozzano','2026-03-05',null,'Arrien, Mixer , mesas , T..','Issued','observed','{}','2026-09-10T23:59:00-03'),
('invoiceocean','E5','estimate','USD',3949579.83,4700000.00,'Gala Bozzano','2026-03-05',null,'Arrien, Mixer , mesas , T..','Issued','observed','{}','2026-09-10T23:59:00-03'),
('invoiceocean','10','invoice','USD',0,0,'Evento Lombardis','2026-02-18',null,'Accommodation service','Issued','observed','{}','2026-09-10T23:59:00-03'),
('invoiceocean','9','invoice','CLP',193277.32,230000.00,'Asesorias Selva ltda','2026-02-18',null,'Alojam, Alojam','Issued','observed','{}','2026-09-10T23:59:00-03'),
('invoiceocean','9 Sres. Lombardis','estimate','CLP',9221344.53,10973400.00,'Productora Lombardis','2026-02-18','2026-04-22','Black , Lombar, barcaz, v..','Partially paid','observed','{}','2026-09-10T23:59:00-03'),
('invoiceocean','E4','estimate','CLP',200000.00,238000.00,'Lombardis','2026-02-14',null,'Black Swan Experience','Issued','observed','{}','2026-09-10T23:59:00-03'),
('invoiceocean','8','invoice','CLP',7717647.06,9184000.00,'Loop 360','2026-02-12','2026-02-12','Accommodation service','Paid','observed','{}','2026-09-10T23:59:00-03'),
('invoiceocean','7','invoice','CLP',1512605.04,1800000.00,'Ozan','2026-02-12','2026-02-12','Accommodation service','Paid','observed','{}','2026-09-10T23:59:00-03'),
('invoiceocean','6','invoice','CLP',420168.07,500000.00,'Thomas himene','2026-02-12',null,'Accommodation service','Issued','observed','{}','2026-09-10T23:59:00-03'),
('invoiceocean','E3','estimate','CLP',7530252.10,8961000.00,'Felipe Varea','2026-01-28',null,'Experi, Experi','Issued','observed','{}','2026-09-10T23:59:00-03'),
('invoiceocean','E2','estimate','CLP',11152941.20,13272000.00,'Luis Felipe Ross','2026-01-27',null,'Alojam, Alojam, Alojam, A..','Issued','observed','{}','2026-09-10T23:59:00-03'),
('invoiceocean','5','invoice','USD',1200.00,1200.00,'Permanent Ventures GP LLC','2026-01-26','2026-02-12','Accommodation service','Paid','observed','{}','2026-09-10T23:59:00-03'),
('invoiceocean','3','invoice','USD',1067.00,1067.00,'Trend Visions Trading GmbH','2026-01-22','2026-02-12','2 days, transf','Paid','observed','{}','2026-09-10T23:59:00-03'),
('invoiceocean','34','invoice','USD',1481.48,1600.00,'Ozan Polat','2025-12-03','2025-12-03','Accommodation service','Paid','observed','{}','2026-09-10T23:59:00-03'),
('invoiceocean','32','invoice','USD',25263.00,25263.00,'Stateless Ventures LLC ve..','2025-10-30','2026-01-26','Accomm, Accomm, Accomm, A..','Paid','observed','{}','2026-09-10T23:59:00-03')
on conflict(source_system,external_ref) do update set document_type=excluded.document_type,currency=excluded.currency,net_amount=excluded.net_amount,gross_amount=excluded.gross_amount,client_name=excluded.client_name,issue_date=excluded.issue_date,payment_date=excluded.payment_date,product_service=excluded.product_service,status=excluded.status,updated_at=now(),observed_at=excluded.observed_at;

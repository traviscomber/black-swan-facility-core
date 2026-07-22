alter table public.suppliers
  add column if not exists approval_status text not null default 'pending',
  add column if not exists category text,
  add column if not exists website text,
  add column if not exists source_url text,
  add column if not exists coverage_notes text,
  add column if not exists last_verified_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid;

alter table public.suppliers
  drop constraint if exists suppliers_approval_status_check;

alter table public.suppliers
  add constraint suppliers_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected'));

update public.suppliers
set approval_status = case when is_active then 'approved' else 'pending' end
where approval_status is null;

with candidates(name, email, phone, address, city, country, category, website, source_url, coverage_notes, notes) as (
  values
  ('Cooprinsem Valdivia', 'cooprinsem@cooprinsem.cl', '63 223 0420', 'Pedro Aguirre Cerda 974', 'Valdivia', 'Chile', 'Ganadería y agricultura', 'https://cooprinsem.cl', 'https://cooprinsem.cl/content/9-sucursales', 'Sucursal local. Insumos veterinarios, agrícolas, lechería y equipamiento rural.', 'Candidato investigado. Validar RUT, ejecutivo comercial, condiciones de pago y documentación antes de aprobar.'),
  ('Inelco', '', '', 'Hettich 238', 'Valdivia', 'Chile', 'Agua, bombas y electricidad', 'https://inelco.cl', 'https://inelco.cl', 'Proveedor local de bombas, pozos, presurización, aguas servidas e ingeniería eléctrica.', 'Candidato investigado. Confirmar contacto comercial y cobertura específica.'),
  ('Comercial Aseo Valdivia', '', '', 'Ramón Picarte 795', 'Valdivia', 'Chile', 'Aseo institucional', '', '', 'Productos de limpieza, papeles, dispensadores, envases e insumos institucionales.', 'Candidato investigado. Pendiente verificación documental y contacto comercial.'),
  ('Total Full Pack', '', '', 'Picarte 3181', 'Valdivia', 'Chile', 'Aseo, papel y embalaje', 'https://totalfullpack.cl', 'https://totalfullpack.cl', 'Insumos de aseo, papel, bolsas, envases y embalaje.', 'Candidato investigado. Pendiente cotización y validación de razón social.'),
  ('Recotrash', '', '', '', 'Valdivia', 'Chile', 'Gestión de residuos', 'https://www.recotrash.cl', 'https://www.recotrash.cl', 'Recolección, tolvas, residuos industriales y certificados de disposición final.', 'Candidato investigado. Validar permisos, cobertura, tarifas y certificados vigentes.'),
  ('Plagasur', 'contacto@plagasur.cl', '800 231 031', 'Avenida Pedro Montt 3034', 'Valdivia', 'Chile', 'Control de plagas y sanitización', 'https://www.controldeplagasvaldivia.cl', 'https://www.controldeplagasvaldivia.cl/quienes-somos', 'Sucursal Valdivia. Servicios de control de plagas y sanitización en Los Ríos.', 'Candidato investigado. Sitio declara ISO 9001, ISO 14001, resolución sanitaria, autorización SAG y acreditación DIRECTEMAR; verificar vigencia documental.'),
  ('SIPRA', '', '', 'Jordania 283', 'Valdivia', 'Chile', 'EPP y prevención de riesgos', 'https://sipra.cl', 'https://sipra.cl', 'EPP, ferretería, limpieza y asesoría en prevención de riesgos.', 'Candidato investigado. Pendiente validación comercial.'),
  ('Náutica Valdivia', '', '', 'General Lagos 1809', 'Valdivia', 'Chile', 'Náutica y repuestos', '', '', 'Botes, motores, hélices, carros, accesorios y repuestos náuticos.', 'Candidato investigado. Pendiente validar razón social, contacto y postventa.'),
  ('Sermarine Chile', '', '', 'Pérez Rosales 640', 'Valdivia', 'Chile', 'Ingeniería naval', '', '', 'Ingeniería naval, planos, tasaciones, trámites e importaciones.', 'Candidato investigado. Pendiente validación documental y comercial.'),
  ('Marina Río Valdivia', '', '', '', 'Valdivia', 'Chile', 'Servicios náuticos', 'https://www.marinariovaldivia.com', 'https://www.marinariovaldivia.com', 'Muelle, varadero, agua, electricidad e izado de embarcaciones.', 'Candidato investigado. Confirmar capacidades, tarifas y disponibilidad.'),
  ('Motarro', '', '', 'Soto Aguilar 210', 'Valdivia', 'Chile', 'Servicios rurales y construcción', 'https://www.motarro.cl', 'https://www.motarro.cl', 'Ganadería, transporte, movimiento de tierra, construcción e insumos agrícolas.', 'Candidato investigado. Pendiente referencias y alcance contractual.'),
  ('Avícola Agrícola', '', '', 'Camilo Henríquez 739', 'Valdivia', 'Chile', 'Insumos agrícolas y avícolas', 'https://www.avicolagricola.cl', 'https://www.avicolagricola.cl', 'Semillas, alimentos concentrados, aves, comederos, bebederos y abonos.', 'Candidato investigado. Pendiente cotización y validación tributaria.'),
  ('Iansa Insumos Agrícolas', '', '', '', 'Valdivia', 'Chile', 'Insumos agrícolas', '', '', 'Fertilizantes, nutrición animal y vegetal, semillas, fitosanitarios y riego.', 'Candidato con cobertura por confirmar para Valdivia.'),
  ('Insagri', '', '', '', 'Valdivia', 'Chile', 'Riego e insumos agrícolas', 'https://insagri.cl', 'https://insagri.cl', 'Riego, tuberías, semillas, herbicidas y fertilizantes.', 'Candidato con despacho y condiciones comerciales por confirmar.'),
  ('Sodimac Constructor Valdivia', '', '', '', 'Valdivia', 'Chile', 'Construcción y mantenimiento', 'https://www.sodimac.cl', 'https://www.sodimac.cl', 'Materiales, herramientas, sanitarios, jardín y terminaciones.', 'Candidato investigado. Validar cuenta empresa, descuentos y condiciones B2B.'),
  ('Construmart', '', '', '', 'Valdivia', 'Chile', 'Construcción y ferretería', 'https://www.construmart.cl', 'https://www.construmart.cl/catalogo-sur/', 'Materiales de construcción, madera, techumbre, aislación y gasfitería.', 'Candidato con stock y despacho a Valdivia por confirmar por producto.'),
  ('Distribuidora La Barata', '', '', '', 'Valdivia', 'Chile', 'Alimentos y abastecimiento', 'https://www.distribuidoralabarata.cl', 'https://www.distribuidoralabarata.cl', 'Abarrotes, lácteos, bebidas, congelados, carnes y productos de limpieza.', 'Candidato investigado. Validar contacto B2B, facturación y condiciones de entrega.'),
  ('OSI Valdivia', '', '', '', 'Valdivia', 'Chile', 'Servicios operativos', 'https://osi.cl', 'https://osi.cl', 'Aseo, jardinería, fumigación, lavado de flotas y gestión de compras.', 'Candidato investigado. Pendiente referencias, alcance y documentación contractual.')
)
insert into public.suppliers (
  name, contact_person, email, phone, address, city, country,
  payment_terms, notes, rating, is_active, approval_status,
  category, website, source_url, coverage_notes, last_verified_at
)
select
  c.name, '', c.email, c.phone, c.address, c.city, c.country,
  '', c.notes, 0, false, 'pending',
  c.category, c.website, c.source_url, c.coverage_notes, now()
from candidates c
where not exists (
  select 1 from public.suppliers s where lower(trim(s.name)) = lower(trim(c.name))
);

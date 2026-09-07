do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.suppliers
  where name in ('Anasac Agropecuario','Cooprinsem Valdivia');
  if v_count <> 2 then
    raise exception 'Expected exactly two Orchard seed supplier candidates, found %', v_count;
  end if;

  if exists (
    select 1 from public.suppliers
    where name in ('Anasac Agropecuario','Cooprinsem Valdivia')
      and (approval_status <> 'pending' or is_active)
  ) then
    raise exception 'Seed supplier verification refuses to overwrite an already approved/active supplier';
  end if;

  if exists (
    select 1 from public.suppliers
    where name='Anasac Agropecuario'
      and nullif(rut,'') is not null
      and rut <> '91.253.000-0'
  ) then
    raise exception 'Anasac RUT conflicts with source-backed identity';
  end if;

  if exists (
    select 1 from public.suppliers
    where name='Cooprinsem Valdivia'
      and nullif(rut,'') is not null
      and rut <> '82.392.600-6'
  ) then
    raise exception 'Cooprinsem RUT conflicts with source-backed identity';
  end if;

  update public.suppliers
  set rut='91.253.000-0',
      contact_name='Felipe Letelier',
      email='fletelier@anasac.cl',
      phone='+56 9 3386 8708',
      region='Los Ríos',
      website='https://anasac.cl/agropecuario/',
      source_url='https://anasac.cl/agropecuario/sucursales-anasac/',
      coverage_notes='Identity and Los Ríos commercial coverage verified from current ANASAC public sources. ANASAC publishes a vegetable-seed catalogue and a current Los Ríos zonal contact. Exact cultivar availability, price, lead time and payment terms remain RFQ evidence and are not claimed here.',
      notes='Supplier identity evidence: Agrícola Nacional S.A.C.I., RUT 91.253.000-0. Candidate remains pending/inactive until an authenticated Procurement manager explicitly approves it. No stock, quote, payment term or purchase is inferred.',
      last_verified_at=now(),
      updated_at=now()
  where name='Anasac Agropecuario';

  update public.suppliers
  set rut='82.392.600-6',
      email='cooprinsem@cooprinsem.cl',
      phone='600 401 0500',
      commune='Valdivia',
      region='Los Ríos',
      website='https://cooprinsem.cl',
      source_url='https://cooprinsem.cl/contactenos',
      coverage_notes='Identity and Valdivia operating presence verified from Chile public registries and Cooprinsem public channels. Cooprinsem publishes a vegetable-seed catalogue, online quotation workflow and Valdivia branch references. Exact item stock, cultivar fit, price, lead time and payment terms remain RFQ evidence and are not claimed here.',
      notes='Supplier identity evidence: Cooperativa Agrícola y de Servicios Limitada (COOPRINSEM), RUT 82.392.600-6. Candidate remains pending/inactive until an authenticated Procurement manager explicitly approves it. No branch stock, quote, payment term or purchase is inferred.',
      last_verified_at=now(),
      updated_at=now()
  where name='Cooprinsem Valdivia';

  if exists (
    select 1 from public.suppliers
    where name in ('Anasac Agropecuario','Cooprinsem Valdivia')
      and (approval_status <> 'pending' or is_active)
  ) then
    raise exception 'Supplier verification must leave both candidates pending and inactive';
  end if;
end $$;

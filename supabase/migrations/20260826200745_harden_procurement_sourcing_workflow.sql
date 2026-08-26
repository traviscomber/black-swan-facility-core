create unique index if not exists procurement_quotation_one_active_per_request_uidx
  on public.procurement_quotation_rounds(request_id)
  where status in ('draft','ready','sent','collecting','comparison_ready','pending_final_approval');

revoke insert, update, delete on table public.procurement_quotation_rounds from authenticated;
revoke insert, update, delete on table public.procurement_quotation_requests from authenticated;
revoke insert, update, delete on table public.procurement_supplier_quotes from authenticated;
revoke insert, update, delete on table public.procurement_quote_items from authenticated;
revoke insert, update, delete on table public.procurement_comparisons from authenticated;

drop policy if exists procurement_quotation_rounds_write on public.procurement_quotation_rounds;
drop policy if exists procurement_quotation_requests_write on public.procurement_quotation_requests;
drop policy if exists procurement_supplier_quotes_write on public.procurement_supplier_quotes;
drop policy if exists procurement_quote_items_write on public.procurement_quote_items;
drop policy if exists procurement_comparisons_write on public.procurement_comparisons;

create or replace function public.start_procurement_quotation(
  p_request_id uuid,
  p_supplier_ids uuid[],
  p_response_deadline timestamptz default now() + interval '3 days'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_round_id uuid;
  v_round_number integer;
  v_request public.procurement_requests%rowtype;
  v_supplier record;
  v_supplier_count integer;
  v_qr_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('procurement.manage') then raise exception 'Procurement permission required'; end if;
  if p_response_deadline <= now() then raise exception 'Response deadline must be in the future'; end if;
  if coalesce(array_length(p_supplier_ids,1),0) < 2 then raise exception 'At least two suppliers are required'; end if;
  if (select count(distinct x) from unnest(p_supplier_ids) x) <> array_length(p_supplier_ids,1) then raise exception 'Supplier selection contains duplicates'; end if;

  select * into v_request from public.procurement_requests where id=p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if not public.can_access_operational_scope('procurement',v_request.location_id) then raise exception 'Procurement scope required for this location'; end if;
  if v_request.status not in ('approved','approved_for_quotation') then raise exception 'Request status is not eligible for quotation: %',v_request.status; end if;

  select id into v_round_id
  from public.procurement_quotation_rounds
  where request_id=p_request_id and status in ('draft','ready','sent','collecting','comparison_ready','pending_final_approval')
  order by created_at desc limit 1;
  if v_round_id is not null then return v_round_id; end if;

  select count(*) into v_supplier_count
  from public.suppliers
  where id=any(p_supplier_ids) and is_active=true and approval_status='approved';
  if v_supplier_count <> array_length(p_supplier_ids,1) then raise exception 'Every selected supplier must be active and approved'; end if;

  select coalesce(max(round_number),0)+1 into v_round_number from public.procurement_quotation_rounds where request_id=p_request_id;
  insert into public.procurement_quotation_rounds(request_id,round_number,status,response_deadline,minimum_quotes,created_by,created_by_agent)
  values(p_request_id,v_round_number,'collecting',p_response_deadline,least(3,array_length(p_supplier_ids,1)),v_user,false)
  returning id into v_round_id;

  for v_supplier in
    select id,name,email from public.suppliers where id=any(p_supplier_ids) and is_active=true and approval_status='approved'
  loop
    insert into public.procurement_quotation_requests(quotation_round_id,supplier_id,status,channel,sent_to,sent_at)
    values(v_round_id,v_supplier.id,case when v_supplier.email is null then 'draft' else 'queued' end,case when v_supplier.email is null then 'manual' else 'email' end,v_supplier.email,null)
    returning id into v_qr_id;

    if v_supplier.email is not null then
      insert into public.procurement_outbox(request_id,quotation_request_id,message_type,recipient,subject,body_text,payload)
      values(p_request_id,v_qr_id,'rfq',v_supplier.email,
        'Solicitud de cotización ' || coalesce(v_request.request_number,v_request.title),
        format('Fundo Corcovado solicita cotización para: %s. Cantidad: %s %s. Fecha límite: %s. Entrega: %s.',v_request.title,v_request.quantity,v_request.unit,p_response_deadline,v_request.delivery_location),
        jsonb_build_object('request_id',p_request_id,'round_id',v_round_id,'supplier_id',v_supplier.id));
    end if;
  end loop;

  update public.procurement_requests
  set status='approved_for_quotation',approved_for_quotation_at=coalesce(approved_for_quotation_at,now()),approved_for_quotation_by=coalesce(approved_for_quotation_by,v_user),updated_at=now()
  where id=p_request_id;

  insert into public.procurement_agent_runs(request_id,quotation_round_id,job_type,idempotency_key,status,input_summary,output_summary,started_at,completed_at)
  values(p_request_id,v_round_id,'prepare_rfq','prepare-rfq:'||v_round_id,'completed',jsonb_build_object('supplier_ids',p_supplier_ids),jsonb_build_object('supplier_count',v_supplier_count),now(),now())
  on conflict(idempotency_key) do nothing;

  insert into public.procurement_audit_log(request_id,entity_type,entity_id,action,actor_type,actor_id,metadata)
  values(p_request_id,'quotation_round',v_round_id,'quotation_started','user',v_user,jsonb_build_object('supplier_count',v_supplier_count,'deadline',p_response_deadline));
  return v_round_id;
end;
$function$;
revoke all on function public.start_procurement_quotation(uuid,uuid[],timestamptz) from public,anon,authenticated;
grant execute on function public.start_procurement_quotation(uuid,uuid[],timestamptz) to authenticated,service_role;

create or replace function public.submit_procurement_supplier_quote(
  p_quotation_request_id uuid,
  p_total numeric,
  p_subtotal numeric default null,
  p_tax numeric default null,
  p_shipping numeric default null,
  p_currency text default 'CLP',
  p_lead_time_days integer default null,
  p_valid_until date default null,
  p_payment_terms text default null,
  p_warranty text default null,
  p_stock_status text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_qr public.procurement_quotation_requests%rowtype;
  v_request_id uuid;
  v_location_id uuid;
  v_quote_id uuid;
  v_quote_count integer;
  v_minimum integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('procurement.manage') then raise exception 'Procurement permission required'; end if;
  if p_total <= 0 then raise exception 'Quote total must be greater than zero'; end if;
  if p_subtotal is not null and p_subtotal < 0 then raise exception 'Quote subtotal cannot be negative'; end if;
  if p_tax is not null and p_tax < 0 then raise exception 'Quote tax cannot be negative'; end if;
  if p_shipping is not null and p_shipping < 0 then raise exception 'Quote shipping cannot be negative'; end if;
  if p_lead_time_days is not null and p_lead_time_days < 0 then raise exception 'Lead time cannot be negative'; end if;
  if length(trim(coalesce(p_currency,''))) <> 3 then raise exception 'Currency must be a three-letter code'; end if;

  select * into v_qr from public.procurement_quotation_requests where id=p_quotation_request_id for update;
  if not found then raise exception 'Quotation request not found'; end if;
  if v_qr.status in ('declined','expired','failed') then raise exception 'Quotation request is not open for a quote'; end if;

  select r.id,r.location_id into v_request_id,v_location_id
  from public.procurement_quotation_rounds qrnd
  join public.procurement_requests r on r.id=qrnd.request_id
  where qrnd.id=v_qr.quotation_round_id;
  if not found then raise exception 'Quotation round not found'; end if;
  if not public.can_access_operational_scope('procurement',v_location_id) then raise exception 'Procurement scope required for this location'; end if;

  insert into public.procurement_supplier_quotes(
    quotation_request_id,supplier_id,currency,subtotal,tax,shipping,total,lead_time_days,valid_until,payment_terms,warranty,stock_status,notes,extraction_confidence,requires_human_review,submitted_at,updated_at
  ) values (
    v_qr.id,v_qr.supplier_id,upper(trim(p_currency)),p_subtotal,p_tax,p_shipping,p_total,p_lead_time_days,p_valid_until,nullif(trim(p_payment_terms),''),nullif(trim(p_warranty),''),nullif(trim(p_stock_status),''),nullif(trim(p_notes),''),1,false,now(),now()
  )
  on conflict(quotation_request_id) do update set
    currency=excluded.currency,subtotal=excluded.subtotal,tax=excluded.tax,shipping=excluded.shipping,total=excluded.total,
    lead_time_days=excluded.lead_time_days,valid_until=excluded.valid_until,payment_terms=excluded.payment_terms,warranty=excluded.warranty,
    stock_status=excluded.stock_status,notes=excluded.notes,extraction_confidence=1,requires_human_review=false,submitted_at=now(),updated_at=now()
  returning id into v_quote_id;

  update public.procurement_quotation_requests set status='responded',responded_at=now(),updated_at=now() where id=v_qr.id;

  select count(*),max(qrnd.minimum_quotes) into v_quote_count,v_minimum
  from public.procurement_supplier_quotes q
  join public.procurement_quotation_requests qr on qr.id=q.quotation_request_id
  join public.procurement_quotation_rounds qrnd on qrnd.id=qr.quotation_round_id
  where qr.quotation_round_id=v_qr.quotation_round_id;

  update public.procurement_quotation_rounds
  set status=case when v_quote_count >= greatest(v_minimum,2) then 'comparison_ready' else 'collecting' end,updated_at=now()
  where id=v_qr.quotation_round_id and status not in ('approved','closed','cancelled','rejected');

  insert into public.procurement_audit_log(request_id,entity_type,entity_id,action,actor_type,actor_id,metadata)
  values(v_request_id,'supplier_quote',v_quote_id,'supplier_quote_recorded','user',v_user,jsonb_build_object('supplier_id',v_qr.supplier_id,'total',p_total,'currency',upper(trim(p_currency)),'quote_count',v_quote_count));
  return v_quote_id;
end;
$function$;
revoke all on function public.submit_procurement_supplier_quote(uuid,numeric,numeric,numeric,numeric,text,integer,date,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_procurement_supplier_quote(uuid,numeric,numeric,numeric,numeric,text,integer,date,text,text,text,text) to authenticated,service_role;

create or replace function public.build_procurement_comparison(p_round_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_request_id uuid;
  v_location_id uuid;
  v_count integer;
  v_minimum integer;
  v_comparison_id uuid;
  v_best record;
  v_second record;
  v_scores jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('procurement.manage') then raise exception 'Procurement permission required'; end if;

  select r.id,r.location_id,qr.minimum_quotes into v_request_id,v_location_id,v_minimum
  from public.procurement_quotation_rounds qr
  join public.procurement_requests r on r.id=qr.request_id
  where qr.id=p_round_id;
  if not found then raise exception 'Quotation round not found'; end if;
  if not public.can_access_operational_scope('procurement',v_location_id) then raise exception 'Procurement scope required for this location'; end if;

  select count(*) into v_count from public.procurement_supplier_quotes q join public.procurement_quotation_requests qr on qr.id=q.quotation_request_id where qr.quotation_round_id=p_round_id and not q.requires_human_review;
  if v_count < greatest(v_minimum,2) then raise exception 'At least % valid quotes are required',greatest(v_minimum,2); end if;

  select q.supplier_id,q.total,q.lead_time_days,s.rating,
    round((50*(min(q.total) over()/nullif(q.total,0)) + 25*(1-(coalesce(q.lead_time_days,30)::numeric/nullif(greatest(max(coalesce(q.lead_time_days,30)) over(),1),0))) + 25*(coalesce(s.rating,0)/5))::numeric,2) score
  into v_best
  from public.procurement_supplier_quotes q
  join public.procurement_quotation_requests qr on qr.id=q.quotation_request_id
  join public.suppliers s on s.id=q.supplier_id
  where qr.quotation_round_id=p_round_id and not q.requires_human_review
  order by score desc,total asc limit 1;
  if v_best.supplier_id is null then raise exception 'No eligible supplier quote could be scored'; end if;

  select q.supplier_id,q.total into v_second
  from public.procurement_supplier_quotes q join public.procurement_quotation_requests qr on qr.id=q.quotation_request_id
  where qr.quotation_round_id=p_round_id and q.supplier_id<>v_best.supplier_id and not q.requires_human_review
  order by q.total asc limit 1;

  select jsonb_object_agg(x.supplier_id::text,jsonb_build_object('score',x.score,'total',x.total,'lead_time_days',x.lead_time_days,'rating',x.rating)) into v_scores
  from (
    select q.supplier_id,q.total,q.lead_time_days,s.rating,
      round((50*(min(q.total) over()/nullif(q.total,0)) + 25*(1-(coalesce(q.lead_time_days,30)::numeric/nullif(greatest(max(coalesce(q.lead_time_days,30)) over(),1),0))) + 25*(coalesce(s.rating,0)/5))::numeric,2) score
    from public.procurement_supplier_quotes q join public.procurement_quotation_requests qr on qr.id=q.quotation_request_id join public.suppliers s on s.id=q.supplier_id
    where qr.quotation_round_id=p_round_id and not q.requires_human_review
  ) x;

  insert into public.procurement_comparisons(quotation_round_id,recommended_supplier_id,second_supplier_id,supplier_scores,recommendation_summary,risks,confidence,generated_by)
  values(p_round_id,v_best.supplier_id,v_second.supplier_id,coalesce(v_scores,'{}'::jsonb),format('Proveedor recomendado por combinación de precio, plazo y evaluación histórica. Total cotizado: %s CLP.',v_best.total),'[]'::jsonb,0.75,'rules-v2')
  on conflict(quotation_round_id) do update set recommended_supplier_id=excluded.recommended_supplier_id,second_supplier_id=excluded.second_supplier_id,supplier_scores=excluded.supplier_scores,recommendation_summary=excluded.recommendation_summary,confidence=excluded.confidence,generated_by=excluded.generated_by,generated_at=now()
  returning id into v_comparison_id;

  update public.procurement_quotation_rounds set status='pending_final_approval',updated_at=now() where id=p_round_id;
  insert into public.procurement_agent_runs(request_id,quotation_round_id,job_type,idempotency_key,status,output_summary,started_at,completed_at)
  values(v_request_id,p_round_id,'compare_quotes','compare:'||p_round_id,'completed',jsonb_build_object('comparison_id',v_comparison_id,'recommended_supplier_id',v_best.supplier_id),now(),now())
  on conflict(idempotency_key) do update set status='completed',output_summary=excluded.output_summary,completed_at=now();
  insert into public.procurement_audit_log(request_id,entity_type,entity_id,action,actor_type,actor_id,metadata)
  values(v_request_id,'comparison',v_comparison_id,'comparison_generated','user',v_user,jsonb_build_object('quote_count',v_count,'recommended_supplier_id',v_best.supplier_id));
  return v_comparison_id;
end;
$function$;
revoke all on function public.build_procurement_comparison(uuid) from public,anon,authenticated;
grant execute on function public.build_procurement_comparison(uuid) to authenticated,service_role;

create or replace function public.approve_procurement_comparison(p_comparison_id uuid,p_supplier_id uuid,p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_round_id uuid;
  v_request_id uuid;
  v_location_id uuid;
  v_quote public.procurement_supplier_quotes%rowtype;
  v_order_id uuid;
  v_existing_supplier uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('procurement.manage') then raise exception 'Procurement permission required'; end if;
  v_role := public.current_app_role();
  if v_role not in ('admin','approver') then raise exception 'Procurement approver role required'; end if;

  select c.quotation_round_id,c.approved_supplier_id into v_round_id,v_existing_supplier
  from public.procurement_comparisons c where c.id=p_comparison_id for update;
  if not found then raise exception 'Comparison not found'; end if;

  select r.id,r.location_id into v_request_id,v_location_id
  from public.procurement_quotation_rounds qr join public.procurement_requests r on r.id=qr.request_id
  where qr.id=v_round_id;
  if not public.can_access_operational_scope('procurement',v_location_id) then raise exception 'Procurement scope required for this location'; end if;

  select id into v_order_id from public.procurement_purchase_orders where request_id=v_request_id and status<>'cancelled' order by created_at desc limit 1;
  if v_order_id is not null then
    if v_existing_supplier is not null and v_existing_supplier<>p_supplier_id then raise exception 'Comparison was already approved for another supplier'; end if;
    return v_order_id;
  end if;

  select q.* into v_quote
  from public.procurement_supplier_quotes q join public.procurement_quotation_requests qr on qr.id=q.quotation_request_id
  where qr.quotation_round_id=v_round_id and q.supplier_id=p_supplier_id and not q.requires_human_review
  order by q.submitted_at desc limit 1;
  if v_quote.id is null then raise exception 'Selected supplier has no eligible quote in this round'; end if;

  update public.procurement_comparisons set approved_supplier_id=p_supplier_id,approved_by=v_user,approved_at=now(),approval_notes=nullif(trim(p_notes),'') where id=p_comparison_id;
  update public.procurement_quotation_rounds set status='approved',closed_at=now(),updated_at=now() where id=v_round_id;
  update public.procurement_requests set selected_supplier_id=p_supplier_id,status='final_approved',final_approved_at=now(),final_approved_by=v_user,updated_at=now() where id=v_request_id;

  insert into public.procurement_purchase_orders(request_id,comparison_id,supplier_id,status,currency,subtotal,tax,shipping,total,delivery_location,expected_delivery,payment_terms)
  select r.id,p_comparison_id,p_supplier_id,'ready_to_issue',v_quote.currency,v_quote.subtotal,v_quote.tax,v_quote.shipping,v_quote.total,r.delivery_location,r.required_date,v_quote.payment_terms
  from public.procurement_requests r where r.id=v_request_id
  returning id into v_order_id;
  update public.procurement_purchase_orders set order_number='PO-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.procurement_audit_log_id_seq')::text,6,'0') where id=v_order_id;

  insert into public.procurement_audit_log(request_id,entity_type,entity_id,action,actor_type,actor_id,metadata)
  values(v_request_id,'purchase_order',v_order_id,'final_approval_granted','user',v_user,jsonb_build_object('supplier_id',p_supplier_id,'comparison_id',p_comparison_id));
  return v_order_id;
end;
$function$;
revoke all on function public.approve_procurement_comparison(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.approve_procurement_comparison(uuid,uuid,text) to authenticated,service_role;

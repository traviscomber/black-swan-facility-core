-- Black Swan OS Phase 1: canonical procurement authorization
-- Replace direct JWT procurement_role reads with public.current_app_role().
-- Preserve the existing per-user procurement_approval_limit_clp metadata value
-- temporarily for approver limits until it is moved into canonical profile data.

create or replace function public.procurement_approval_limit_clp()
returns numeric
language sql
stable
set search_path to 'public'
as $function$
  select case
    when public.current_app_role() = 'admin' then 999999999999::numeric
    when public.current_app_role() = 'approver'
      and (auth.jwt() -> 'app_metadata' ->> 'procurement_approval_limit_clp') ~ '^[0-9]+(\.[0-9]+)?$'
      then (auth.jwt() -> 'app_metadata' ->> 'procurement_approval_limit_clp')::numeric
    else 0::numeric
  end;
$function$;

create or replace function public.start_procurement_quotation(
  p_request_id uuid,
  p_supplier_ids uuid[],
  p_response_deadline timestamptz default (now() + interval '3 days')
)
returns uuid
language plpgsql
set search_path to 'public'
as $function$
declare
  v_role text := public.current_app_role();
  v_round_id uuid;
  v_round_number integer;
  v_request public.procurement_requests%rowtype;
  v_supplier record;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_role not in ('admin','approver') then raise exception 'Procurement approver role required'; end if;
  if coalesce(array_length(p_supplier_ids,1),0) < 2 then raise exception 'At least two suppliers are required'; end if;

  select * into v_request from public.procurement_requests where id=p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_request.status not in ('approved','approved_for_quotation','pending') then raise exception 'Request status is not eligible for quotation: %', v_request.status; end if;

  select coalesce(max(round_number),0)+1 into v_round_number from public.procurement_quotation_rounds where request_id=p_request_id;
  insert into public.procurement_quotation_rounds(request_id,round_number,status,response_deadline,minimum_quotes,created_by,created_by_agent)
  values(p_request_id,v_round_number,'ready',p_response_deadline,least(3,array_length(p_supplier_ids,1)),auth.uid(),false)
  returning id into v_round_id;

  for v_supplier in
    select id,name,email from public.suppliers where id=any(p_supplier_ids) and is_active=true and approval_status='approved'
  loop
    insert into public.procurement_quotation_requests(quotation_round_id,supplier_id,status,channel,sent_to)
    values(v_round_id,v_supplier.id,'queued','email',v_supplier.email);

    if v_supplier.email is not null then
      insert into public.procurement_outbox(request_id,quotation_request_id,message_type,recipient,subject,body_text,payload)
      select p_request_id,qr.id,'rfq',v_supplier.email,
        'Solicitud de cotización ' || coalesce(v_request.request_number,v_request.title),
        format('Fundo Corcovado solicita cotización para: %s. Cantidad: %s %s. Fecha límite: %s. Entrega: %s.',v_request.title,v_request.quantity,v_request.unit,p_response_deadline,v_request.delivery_location),
        jsonb_build_object('request_id',p_request_id,'round_id',v_round_id,'supplier_id',v_supplier.id)
      from public.procurement_quotation_requests qr
      where qr.quotation_round_id=v_round_id and qr.supplier_id=v_supplier.id;
    end if;
  end loop;

  if (select count(*) from public.procurement_quotation_requests where quotation_round_id=v_round_id) < 2 then
    raise exception 'Not enough eligible approved suppliers';
  end if;

  update public.procurement_requests set status='approved_for_quotation',approved_for_quotation_at=coalesce(approved_for_quotation_at,now()),approved_for_quotation_by=coalesce(approved_for_quotation_by,auth.uid()),updated_at=now() where id=p_request_id;
  insert into public.procurement_agent_runs(request_id,quotation_round_id,job_type,idempotency_key,status,input_summary,output_summary,started_at,completed_at)
  values(p_request_id,v_round_id,'prepare_rfq','prepare-rfq:'||v_round_id,'completed',jsonb_build_object('supplier_ids',p_supplier_ids),jsonb_build_object('outbox_messages',(select count(*) from public.procurement_outbox where quotation_request_id in (select id from public.procurement_quotation_requests where quotation_round_id=v_round_id))),now(),now())
  on conflict(idempotency_key) do nothing;
  insert into public.procurement_audit_log(request_id,entity_type,entity_id,action,actor_type,actor_id,metadata)
  values(p_request_id,'quotation_round',v_round_id,'quotation_started','user',auth.uid(),jsonb_build_object('supplier_count',array_length(p_supplier_ids,1),'deadline',p_response_deadline));
  return v_round_id;
end;
$function$;

create or replace function public.build_procurement_comparison(p_round_id uuid)
returns uuid
language plpgsql
set search_path to 'public'
as $function$
declare
  v_role text := public.current_app_role();
  v_request_id uuid;
  v_count integer;
  v_comparison_id uuid;
  v_best record;
  v_second record;
  v_scores jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_role not in ('admin','approver') then raise exception 'Procurement approver role required'; end if;
  select request_id into v_request_id from public.procurement_quotation_rounds where id=p_round_id;
  if v_request_id is null then raise exception 'Quotation round not found'; end if;
  select count(*) into v_count from public.procurement_supplier_quotes q join public.procurement_quotation_requests qr on qr.id=q.quotation_request_id where qr.quotation_round_id=p_round_id;
  if v_count < 2 then raise exception 'At least two valid quotes are required'; end if;

  select q.supplier_id,q.total,q.lead_time_days,s.rating,
    round((50*(min(q.total) over()/nullif(q.total,0)) + 25*(1-(coalesce(q.lead_time_days,30)::numeric/nullif(greatest(max(coalesce(q.lead_time_days,30)) over(),1),0))) + 25*(coalesce(s.rating,0)/5))::numeric,2) score
  into v_best
  from public.procurement_supplier_quotes q
  join public.procurement_quotation_requests qr on qr.id=q.quotation_request_id
  join public.suppliers s on s.id=q.supplier_id
  where qr.quotation_round_id=p_round_id and not q.requires_human_review
  order by score desc,total asc limit 1;

  select q.supplier_id,q.total into v_second
  from public.procurement_supplier_quotes q join public.procurement_quotation_requests qr on qr.id=q.quotation_request_id
  where qr.quotation_round_id=p_round_id and q.supplier_id<>v_best.supplier_id
  order by q.total asc limit 1;

  select jsonb_object_agg(x.supplier_id::text,jsonb_build_object('score',x.score,'total',x.total,'lead_time_days',x.lead_time_days,'rating',x.rating)) into v_scores
  from (
    select q.supplier_id,q.total,q.lead_time_days,s.rating,
      round((50*(min(q.total) over()/nullif(q.total,0)) + 25*(1-(coalesce(q.lead_time_days,30)::numeric/nullif(greatest(max(coalesce(q.lead_time_days,30)) over(),1),0))) + 25*(coalesce(s.rating,0)/5))::numeric,2) score
    from public.procurement_supplier_quotes q join public.procurement_quotation_requests qr on qr.id=q.quotation_request_id join public.suppliers s on s.id=q.supplier_id
    where qr.quotation_round_id=p_round_id
  ) x;

  insert into public.procurement_comparisons(quotation_round_id,recommended_supplier_id,second_supplier_id,supplier_scores,recommendation_summary,risks,confidence,generated_by)
  values(p_round_id,v_best.supplier_id,v_second.supplier_id,coalesce(v_scores,'{}'::jsonb),format('Proveedor recomendado por combinación de precio, plazo y evaluación histórica. Total cotizado: %s CLP.',v_best.total),'[]'::jsonb,0.75,'rules-v1')
  on conflict(quotation_round_id) do update set recommended_supplier_id=excluded.recommended_supplier_id,second_supplier_id=excluded.second_supplier_id,supplier_scores=excluded.supplier_scores,recommendation_summary=excluded.recommendation_summary,confidence=excluded.confidence,generated_at=now()
  returning id into v_comparison_id;

  update public.procurement_quotation_rounds set status='pending_final_approval',updated_at=now() where id=p_round_id;
  insert into public.procurement_agent_runs(request_id,quotation_round_id,job_type,idempotency_key,status,output_summary,started_at,completed_at)
  values(v_request_id,p_round_id,'compare_quotes','compare:'||p_round_id,'completed',jsonb_build_object('comparison_id',v_comparison_id,'recommended_supplier_id',v_best.supplier_id),now(),now())
  on conflict(idempotency_key) do update set status='completed',output_summary=excluded.output_summary,completed_at=now();
  insert into public.procurement_audit_log(request_id,entity_type,entity_id,action,actor_type,actor_id,metadata)
  values(v_request_id,'comparison',v_comparison_id,'comparison_generated','agent',null,jsonb_build_object('quote_count',v_count,'recommended_supplier_id',v_best.supplier_id));
  return v_comparison_id;
end;
$function$;

create or replace function public.approve_procurement_comparison(
  p_comparison_id uuid,
  p_supplier_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
set search_path to 'public'
as $function$
declare
  v_role text := public.current_app_role();
  v_round_id uuid;
  v_request_id uuid;
  v_quote public.procurement_supplier_quotes%rowtype;
  v_order_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_role not in ('admin','approver') then raise exception 'Procurement approver role required'; end if;
  select quotation_round_id into v_round_id from public.procurement_comparisons where id=p_comparison_id for update;
  if v_round_id is null then raise exception 'Comparison not found'; end if;
  select request_id into v_request_id from public.procurement_quotation_rounds where id=v_round_id;
  if v_request_id is null then raise exception 'Quotation round not found'; end if;
  select q.* into v_quote from public.procurement_supplier_quotes q join public.procurement_quotation_requests qr on qr.id=q.quotation_request_id where qr.quotation_round_id=v_round_id and q.supplier_id=p_supplier_id order by q.submitted_at desc limit 1;
  if v_quote.id is null then raise exception 'Selected supplier has no quote in this round'; end if;

  update public.procurement_comparisons set approved_supplier_id=p_supplier_id,approved_by=auth.uid(),approved_at=now(),approval_notes=p_notes where id=p_comparison_id;
  update public.procurement_quotation_rounds set status='approved',closed_at=now(),updated_at=now() where id=v_round_id;
  update public.procurement_requests set selected_supplier_id=p_supplier_id,status='final_approved',final_approved_at=now(),final_approved_by=auth.uid(),updated_at=now() where id=v_request_id;

  insert into public.procurement_purchase_orders(request_id,comparison_id,supplier_id,status,currency,subtotal,tax,shipping,total,delivery_location,expected_delivery,payment_terms)
  select r.id,p_comparison_id,p_supplier_id,'ready_to_issue',v_quote.currency,v_quote.subtotal,v_quote.tax,v_quote.shipping,v_quote.total,r.delivery_location,r.required_date,v_quote.payment_terms from public.procurement_requests r where r.id=v_request_id
  returning id into v_order_id;
  update public.procurement_purchase_orders set order_number='PO-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.procurement_audit_log_id_seq')::text,6,'0') where id=v_order_id;
  insert into public.procurement_audit_log(request_id,entity_type,entity_id,action,actor_type,actor_id,metadata)
  values(v_request_id,'purchase_order',v_order_id,'final_approval_granted','user',auth.uid(),jsonb_build_object('supplier_id',p_supplier_id,'comparison_id',p_comparison_id));
  return v_order_id;
end;
$function$;

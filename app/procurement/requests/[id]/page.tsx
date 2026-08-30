import { notFound } from "next/navigation"
import { ProcurementRequestObjectView, type ProcurementRequestObjectData } from "@/components/procurement-request-object-view"
import { createClient } from "@/lib/supabase/server"

type ProcurementRequest = ProcurementRequestObjectData["request"]
type QuotationRound = ProcurementRequestObjectData["rounds"][number]
type QuotationRequest = ProcurementRequestObjectData["quotationRequests"][number]
type SupplierQuote = ProcurementRequestObjectData["quotes"][number]
type Comparison = ProcurementRequestObjectData["comparisons"][number]
type PurchaseOrder = ProcurementRequestObjectData["orders"][number]
type Receipt = ProcurementRequestObjectData["receipts"][number]
type ReceiptItem = ProcurementRequestObjectData["receiptItems"][number]
type InventoryIntake = ProcurementRequestObjectData["intakes"][number]
type Replenishment = ProcurementRequestObjectData["replenishment"][number]
type Approval = ProcurementRequestObjectData["approvals"][number]
type AuditEvent = ProcurementRequestObjectData["audit"][number]
type Supplier = { id: string; name: string }
type Location = ProcurementRequestObjectData["location"]

export default async function PurchaseObjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const requestResult = await supabase
    .from("procurement_requests")
    .select("id,request_number,title,description,business_justification,category,quantity,unit,estimated_budget_clp,priority,status,required_date,delivery_location,location_id,selected_supplier_id,approved_for_quotation_at,final_approved_at,created_at")
    .eq("id", id)
    .maybeSingle()

  if (requestResult.error || !requestResult.data) notFound()
  const request = requestResult.data as ProcurementRequest

  const [roundsResult, ordersResult, replenishmentResult, approvalsResult, auditResult, locationResult] = await Promise.all([
    supabase.from("procurement_quotation_rounds").select("id,round_number,status,response_deadline,minimum_quotes,sent_at,closed_at,created_at").eq("request_id", id).order("round_number", { ascending: false }).limit(5),
    supabase.from("procurement_purchase_orders").select("id,order_number,request_id,supplier_id,status,currency,total,expected_delivery,payment_terms,issued_at").eq("request_id", id).order("created_at", { ascending: false }).limit(5),
    supabase.from("inventory_replenishment_needs").select("id,stock_item_id,status,trigger_quantity,suggested_quantity,requested_quantity,purchase_order_id,fulfilled_at,last_event_at").eq("procurement_request_id", id).order("created_at", { ascending: false }).limit(5),
    supabase.from("procurement_approval_events").select("id,decision,request_amount_clp,approver_limit_clp,notes,created_at").eq("request_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("procurement_audit_log").select("id,entity_type,action,actor_type,metadata,created_at").eq("request_id", id).order("created_at", { ascending: false }).limit(20),
    request.location_id ? supabase.from("locations").select("id,name").eq("id", request.location_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])

  const rounds = (roundsResult.data ?? []) as QuotationRound[]
  const orders = (ordersResult.data ?? []) as PurchaseOrder[]
  const replenishment = (replenishmentResult.data ?? []) as Replenishment[]
  const approvals = (approvalsResult.data ?? []) as Approval[]
  const audit = (auditResult.data ?? []) as AuditEvent[]
  const roundIds = rounds.map((item) => item.id)
  const orderIds = orders.map((item) => item.id)

  const [quotationRequestsResult, comparisonsResult, receiptsResult] = await Promise.all([
    roundIds.length ? supabase.from("procurement_quotation_requests").select("id,quotation_round_id,supplier_id,status,sent_at,opened_at,responded_at").in("quotation_round_id", roundIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    roundIds.length ? supabase.from("procurement_comparisons").select("id,quotation_round_id,recommended_supplier_id,approved_supplier_id,approved_at,recommendation_summary,risks").in("quotation_round_id", roundIds).order("generated_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    orderIds.length ? supabase.from("procurement_receipts").select("id,purchase_order_id,receipt_number,status,received_at,delivery_document,notes").in("purchase_order_id", orderIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ])

  const quotationRequests = (quotationRequestsResult.data ?? []) as QuotationRequest[]
  const comparisons = (comparisonsResult.data ?? []) as Comparison[]
  const receipts = (receiptsResult.data ?? []) as Receipt[]
  const quotationRequestIds = quotationRequests.map((item) => item.id)
  const receiptIds = receipts.map((item) => item.id)

  const [quotesResult, receiptItemsResult] = await Promise.all([
    quotationRequestIds.length ? supabase.from("procurement_supplier_quotes").select("id,quotation_request_id,supplier_id,currency,total,lead_time_days,valid_until,stock_status,requires_human_review,submitted_at").in("quotation_request_id", quotationRequestIds).order("submitted_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    receiptIds.length ? supabase.from("procurement_receipt_items").select("id,receipt_id,request_id,ordered_quantity,received_quantity,rejected_quantity,condition,discrepancy_reason,inventory_intake_required").in("receipt_id", receiptIds).eq("request_id", id) : Promise.resolve({ data: [], error: null }),
  ])

  const quotes = (quotesResult.data ?? []) as SupplierQuote[]
  const receiptItems = (receiptItemsResult.data ?? []) as ReceiptItem[]
  const receiptItemIds = receiptItems.map((item) => item.id)
  const intakeResult = receiptItemIds.length
    ? await supabase.from("procurement_inventory_intake").select("id,receipt_item_id,intake_type,status,linked_asset_id,linked_stock_item_id,processed_quantity,reconciliation_status,processed_at").in("receipt_item_id", receiptItemIds).order("created_at", { ascending: false })
    : { data: [], error: null }
  const intakes = (intakeResult.data ?? []) as InventoryIntake[]

  const supplierIds = Array.from(new Set([
    request.selected_supplier_id,
    ...orders.map((item) => item.supplier_id),
    ...quotationRequests.map((item) => item.supplier_id),
    ...quotes.map((item) => item.supplier_id),
    ...comparisons.flatMap((item) => [item.recommended_supplier_id, item.approved_supplier_id]),
  ].filter((value): value is string => Boolean(value))))
  const suppliersResult = supplierIds.length
    ? await supabase.from("suppliers").select("id,name").in("id", supplierIds)
    : { data: [], error: null }
  const suppliers = Object.fromEntries(((suppliersResult.data ?? []) as Supplier[]).map((supplier) => [supplier.id, supplier.name]))
  const location = locationResult.data as Location

  const queryError = Boolean(roundsResult.error || ordersResult.error || replenishmentResult.error || approvalsResult.error || auditResult.error || locationResult.error || quotationRequestsResult.error || comparisonsResult.error || receiptsResult.error || quotesResult.error || receiptItemsResult.error || intakeResult.error || suppliersResult.error)

  return <ProcurementRequestObjectView data={{ request, rounds, quotationRequests, quotes, comparisons, orders, receipts, receiptItems, intakes, replenishment, approvals, audit, suppliers, location, queryError }} />
}

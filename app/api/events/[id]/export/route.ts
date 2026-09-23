import { buildOperationalEventWorkbook } from "@/lib/events/event-workbook"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

const EVENT_COLUMNS = "id,event_code,name,start_date,end_date,location_name,status,participant_count,person_days,estimated_total_clp,actual_total_clp,source_filename,source_sha256,source_version,source_status,notes,source_event_id"
const PARTICIPANT_COLUMNS = "participant_name,accommodation_name,room_name,arrival_date,arrival_time,arrival_transport,departure_date,departure_time,departure_transport,planned_stay_days,estimated_person_total_clp,confirmation_status,notes,source_reference"
const BUDGET_COLUMNS = "category,item_name,unit,quantity,estimated_unit_price_clp,estimated_subtotal_clp,actual_subtotal_clp,cost_confidence,procurement_status,source_sheet,source_row"

function filename(value: string) {
  const safe = value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"")
  return (safe || "black-swan-event") + ".xlsx"
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: "Invalid event id" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const eventResult = await supabase.from("operational_events").select(EVENT_COLUMNS).eq("id",id).maybeSingle()
  if (eventResult.error) return Response.json({ error: eventResult.error.message }, { status: 403 })
  if (!eventResult.data) return Response.json({ error: "Event not found" }, { status: 404 })

  const [participantsResult,budgetResult] = await Promise.all([
    supabase.from("operational_event_participants").select(PARTICIPANT_COLUMNS).eq("event_id",id).order("arrival_date").order("participant_name"),
    supabase.from("operational_event_budget_items").select(BUDGET_COLUMNS).eq("event_id",id).order("source_sheet").order("source_row"),
  ])
  const firstError = participantsResult.error || budgetResult.error
  if (firstError) return Response.json({ error: firstError.message }, { status: 403 })

  let sourceEvent = null
  if (eventResult.data.source_event_id) {
    const sourceResult = await supabase
      .from("operational_events")
      .select("id,event_code,name,start_date,end_date")
      .eq("id",eventResult.data.source_event_id)
      .maybeSingle()
    if (!sourceResult.error) sourceEvent = sourceResult.data
  }

  const workbook = await buildOperationalEventWorkbook(
    eventResult.data,
    participantsResult.data ?? [],
    budgetResult.data ?? [],
    sourceEvent,
  )
  return new Response(workbook,{
    status:200,
    headers:{
      "content-type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition":`attachment; filename="${filename(eventResult.data.name)}"`,
      "cache-control":"private, no-store",
    },
  })
}

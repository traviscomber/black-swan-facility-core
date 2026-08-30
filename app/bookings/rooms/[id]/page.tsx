import { notFound } from "next/navigation"
import { BookingRoomObjectView, type BookingRoomObjectData } from "@/components/booking-room-object-view"
import { createClient } from "@/lib/supabase/server"

type RequestRow = BookingRoomObjectData["requests"][number]
type Issue = BookingRoomObjectData["issues"][number]

export default async function RoomObjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const roomResult = await supabase
    .from("rooms")
    .select("id,room_number,room_type,capacity,status,operational_status,location,floor,bed_type,amenities,notes")
    .eq("id", id)
    .maybeSingle()

  if (roomResult.error || !roomResult.data) notFound()
  const room = roomResult.data as BookingRoomObjectData["room"]
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())

  const [stateResult, reservationsResult, housekeepingResult, maintenanceResult, historyResult] = await Promise.all([
    supabase.from("room_state_matrix").select("reservation_status,housekeeping_status,maintenance_status,availability_status,current_reservation_id,guest_name,check_in,check_out").eq("room_id", id).limit(1).maybeSingle(),
    supabase.from("reservations").select("id,guest_name,check_in,check_out,status,payment_status,arrival_status").eq("room_id", id).gte("check_out", today).not("status", "in", "(cancelled,canceled,void,voided)").order("check_in", { ascending: true }).limit(8),
    supabase.from("housekeeping_tasks").select("id,task_type,status,priority,service_date").eq("room_id", id).not("status", "in", "(completed,cancelled,canceled)").order("service_date", { ascending: true, nullsFirst: false }).limit(8),
    supabase.from("maintenance_tasks").select("id,title,status,prioridad,fecha_objetivo,bloqueado,asset_id").eq("room_id", id).not("status", "in", "(completada,completed,cancelada,cancelled,canceled)").order("fecha_objetivo", { ascending: true, nullsFirst: false }).limit(8),
    supabase.from("room_operational_history").select("id,previous_status,new_status,reason,source,created_at").eq("room_id", id).order("created_at", { ascending: false }).limit(10),
  ])

  const state = (stateResult.data ?? null) as BookingRoomObjectData["state"]
  const reservations = (reservationsResult.data ?? []) as BookingRoomObjectData["reservations"]
  const housekeeping = (housekeepingResult.data ?? []) as BookingRoomObjectData["housekeeping"]
  const maintenance = (maintenanceResult.data ?? []) as BookingRoomObjectData["maintenance"]
  const history = (historyResult.data ?? []) as BookingRoomObjectData["history"]
  const reservationIds = reservations.map((item) => item.id)

  const roomRequestsResult = await supabase
    .from("hospitality_requests")
    .select("id,request_type,category,description,status,priority,due_at")
    .eq("room_id", id)
    .not("status", "in", "(completed,resolved,closed,cancelled,canceled)")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(8)

  const reservationRequestsResult = reservationIds.length > 0
    ? await supabase
      .from("hospitality_requests")
      .select("id,request_type,category,description,status,priority,due_at")
      .in("reservation_id", reservationIds)
      .not("status", "in", "(completed,resolved,closed,cancelled,canceled)")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(8)
    : { data: [], error: null }

  const roomIssuesResult = await supabase
    .from("issues")
    .select("id,title,status,severity,priority,created_at,asset_id")
    .eq("related_item_type", "room")
    .eq("related_item_id", id)
    .not("status", "in", "(resolved,closed,cancelled,canceled)")
    .order("created_at", { ascending: false })
    .limit(8)

  const reservationIssuesResult = reservationIds.length > 0
    ? await supabase
      .from("issues")
      .select("id,title,status,severity,priority,created_at,asset_id")
      .eq("related_item_type", "reservation")
      .in("related_item_id", reservationIds)
      .not("status", "in", "(resolved,closed,cancelled,canceled)")
      .order("created_at", { ascending: false })
      .limit(8)
    : { data: [], error: null }

  const requests = Array.from(new Map([...(roomRequestsResult.data ?? []), ...(reservationRequestsResult.data ?? [])].map((item) => [item.id, item as RequestRow])).values())
  const issues = Array.from(new Map([...(roomIssuesResult.data ?? []), ...(reservationIssuesResult.data ?? [])].map((item) => [item.id, item as Issue])).values())
  const assetIds = Array.from(new Set([...maintenance.map((item) => item.asset_id), ...issues.map((item) => item.asset_id)].filter((value): value is string => Boolean(value))))
  const assetsResult = assetIds.length > 0
    ? await supabase.from("assets").select("id,name,asset_code,status,is_critical").in("id", assetIds).order("name")
    : { data: [], error: null }

  const data: BookingRoomObjectData = {
    room,
    state,
    reservations,
    housekeeping,
    maintenance,
    requests,
    issues,
    assets: (assetsResult.data ?? []) as BookingRoomObjectData["assets"],
    history,
    queryError: Boolean(
      stateResult.error || reservationsResult.error || housekeepingResult.error || maintenanceResult.error || historyResult.error
      || roomRequestsResult.error || reservationRequestsResult.error || roomIssuesResult.error || reservationIssuesResult.error || assetsResult.error,
    ),
  }

  return <BookingRoomObjectView data={data} />
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .select("id, room_id, bed_id, location_id, guest_name, check_in, check_out, status, payment_status, total_amount")
    .eq("id", id)
    .maybeSingle()

  if (reservationError) {
    return NextResponse.json({ error: reservationError.message }, { status: 500 })
  }

  if (!reservation) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 })
  }

  const [
    hospitalityResult,
    housekeepingResult,
    extrasResult,
    guestRequestsResult,
    issuesResult,
    catalogResult,
  ] = await Promise.all([
    supabase
      .from("hospitality_requests")
      .select("id, request_type, category, description, status, priority, tablet_device_id, created_at, completed_at")
      .eq("reservation_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("housekeeping_tasks")
      .select("id, task_type, status, priority, notes, assigned_to, created_at, completed_at")
      .eq("reservation_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("reservation_extras")
      .select("id, extra_id, name, unit, quantity, unit_price, tax_rate, total_amount, notes, created_at")
      .eq("reservation_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("guest_requests")
      .select("id, request_type, description, status, assigned_to, created_at, resolved_at")
      .eq("reservation_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("issues")
      .select("id, title, description, category, priority, severity, status, photo_url, created_at, resolved_at")
      .eq("related_item_type", "reservation")
      .eq("related_item_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("booking_extras")
      .select("id, name, description, unit, price, tax_rate")
      .eq("is_active", true)
      .order("name"),
  ])

  const firstError =
    hospitalityResult.error ||
    housekeepingResult.error ||
    extrasResult.error ||
    guestRequestsResult.error ||
    issuesResult.error ||
    catalogResult.error

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 })
  }

  const hospitality = hospitalityResult.data ?? []
  const housekeeping = housekeepingResult.data ?? []
  const extras = extrasResult.data ?? []
  const guestRequests = guestRequestsResult.data ?? []
  const issues = issuesResult.data ?? []

  const openStatuses = new Set(["pending", "assigned", "in_progress", "open"])
  const extrasTotal = extras.reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0)

  return NextResponse.json({
    reservation,
    summary: {
      hospitalityOpen: hospitality.filter((item) => openStatuses.has(item.status ?? "pending")).length,
      housekeepingOpen: housekeeping.filter((item) => openStatuses.has(item.status ?? "pending")).length,
      guestRequestsOpen: guestRequests.filter((item) => openStatuses.has(item.status ?? "pending")).length,
      issuesOpen: issues.filter((item) => openStatuses.has(item.status ?? "open")).length,
      extrasCount: extras.length,
      extrasTotal,
      operationalItems:
        hospitality.length + housekeeping.length + guestRequests.length + issues.length + extras.length,
    },
    hospitality,
    housekeeping,
    extras,
    guestRequests,
    issues,
    availableExtras: catalogResult.data ?? [],
  })
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }
type Category = "reservation" | "arrival" | "housekeeping" | "hospitality" | "service" | "finance" | "issue"
type TimelineEvent = { id: string; occurredAt: string; category: Category; title: string; description: string | null; status: string | null; source: string }

function category(value: string): Category {
  if (value === "financial") return "finance"
  if (["reservation", "arrival", "housekeeping", "hospitality", "service", "issue"].includes(value)) return value as Category
  return "reservation"
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .select("id, guest_name, status, created_at, check_in, check_out")
    .eq("id", id)
    .maybeSingle()
  if (reservationError) return NextResponse.json({ error: reservationError.message }, { status: 500 })
  if (!reservation) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 })

  const [canonical, history, housekeeping, hospitality, extras, guestRequests, issues, payments] = await Promise.all([
    supabase.from("booking_events").select("id, category, title, description, previous_state, new_state, source_type, occurred_at").eq("reservation_id", id),
    supabase.from("reservation_history").select("id, status_change, notes, created_at").eq("reservation_id", id),
    supabase.from("housekeeping_tasks").select("id, task_type, status, notes, created_at, started_at, completed_at, verified_at").eq("reservation_id", id),
    supabase.from("hospitality_requests").select("id, request_type, status, description, created_at, completed_at").eq("reservation_id", id),
    supabase.from("reservation_extras").select("id, name, quantity, total_amount, notes, created_at").eq("reservation_id", id),
    supabase.from("guest_requests").select("id, request_type, status, description, created_at, resolved_at").eq("reservation_id", id),
    supabase.from("issues").select("id, title, status, description, created_at, resolved_at").eq("related_item_type", "reservation").eq("related_item_id", id),
    supabase.from("payments").select("id, amount, payment_method, payment_status, paid_at, created_at").eq("reservation_id", id),
  ])
  const firstError = [canonical, history, housekeeping, hospitality, extras, guestRequests, issues, payments].find((result) => result.error)?.error
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 })

  const events: TimelineEvent[] = (canonical.data ?? []).map((row) => ({
    id: `event-${row.id}`,
    occurredAt: row.occurred_at,
    category: category(row.category),
    title: row.title,
    description: row.description,
    status: row.new_state,
    source: row.source_type,
  }))
  const canonicalSources = new Set((canonical.data ?? []).map((row) => `${row.source_type}:${row.id}`))
  const add = (event: TimelineEvent) => { if (!canonicalSources.has(event.id)) events.push(event) }

  if (events.length === 0 && reservation.created_at) add({ id: `snapshot-${reservation.id}`, occurredAt: reservation.created_at, category: "reservation", title: "Reserva registrada", description: `${reservation.check_in} → ${reservation.check_out}`, status: reservation.status, source: "reservation_snapshot" })
  for (const row of history.data ?? []) if (row.created_at) add({ id: `history-${row.id}`, occurredAt: row.created_at, category: "reservation", title: row.status_change, description: row.notes, status: null, source: "reservation_history" })
  for (const row of housekeeping.data ?? []) {
    if (row.created_at) add({ id: `hk-${row.id}`, occurredAt: row.created_at, category: "housekeeping", title: `Housekeeping: ${row.task_type}`, description: row.notes, status: row.status, source: "housekeeping_tasks" })
    if (row.started_at) add({ id: `hk-start-${row.id}`, occurredAt: row.started_at, category: "housekeeping", title: "Housekeeping iniciado", description: row.task_type, status: "in_progress", source: "housekeeping_tasks" })
    if (row.completed_at) add({ id: `hk-end-${row.id}`, occurredAt: row.completed_at, category: "housekeeping", title: "Housekeeping completado", description: row.task_type, status: "completed", source: "housekeeping_tasks" })
    if (row.verified_at) add({ id: `hk-verified-${row.id}`, occurredAt: row.verified_at, category: "housekeeping", title: "Inspección verificada", description: row.task_type, status: "verified", source: "housekeeping_tasks" })
  }
  for (const row of hospitality.data ?? []) {
    if (row.created_at) add({ id: `hospitality-${row.id}`, occurredAt: row.created_at, category: "hospitality", title: `Hospitality: ${row.request_type}`, description: row.description, status: row.status, source: "hospitality_requests" })
    if (row.completed_at) add({ id: `hospitality-end-${row.id}`, occurredAt: row.completed_at, category: "hospitality", title: "Solicitud completada", description: row.request_type, status: "completed", source: "hospitality_requests" })
  }
  for (const row of extras.data ?? []) if (row.created_at) add({ id: `extra-${row.id}`, occurredAt: row.created_at, category: "service", title: `Servicio agregado: ${row.name}`, description: `${row.quantity} unidad(es) · ${Number(row.total_amount ?? 0).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })}${row.notes ? ` · ${row.notes}` : ""}`, status: null, source: "reservation_extras" })
  for (const row of guestRequests.data ?? []) {
    if (row.created_at) add({ id: `request-${row.id}`, occurredAt: row.created_at, category: "hospitality", title: `Solicitud del huésped: ${row.request_type}`, description: row.description, status: row.status, source: "guest_requests" })
    if (row.resolved_at) add({ id: `request-end-${row.id}`, occurredAt: row.resolved_at, category: "hospitality", title: "Solicitud resuelta", description: row.request_type, status: "resolved", source: "guest_requests" })
  }
  for (const row of issues.data ?? []) {
    if (row.created_at) add({ id: `issue-${row.id}`, occurredAt: row.created_at, category: "issue", title: row.title ?? "Incidencia creada", description: row.description, status: row.status, source: "issues" })
    if (row.resolved_at) add({ id: `issue-end-${row.id}`, occurredAt: row.resolved_at, category: "issue", title: "Incidencia resuelta", description: row.title, status: "resolved", source: "issues" })
  }
  for (const row of payments.data ?? []) add({ id: `payment-${row.id}`, occurredAt: row.paid_at ?? row.created_at, category: "finance", title: "Pago registrado", description: `${Number(row.amount).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })}${row.payment_method ? ` · ${row.payment_method}` : ""}`, status: row.payment_status, source: "payments" })

  events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
  return NextResponse.json({ reservation, events, count: events.length })
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

type TimelineEvent = {
  id: string
  occurredAt: string
  category: "reservation" | "arrival" | "housekeeping" | "hospitality" | "service" | "finance" | "issue"
  title: string
  description: string | null
  status: string | null
  source: string
}

function event(input: TimelineEvent): TimelineEvent { return input }

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .select("id, guest_name, status, arrival_status, payment_status, created_at, check_in, check_out, arrived_at, queued_at, room_ready_notified_at, actual_arrival_at, actual_departure_at, check_in_completed_at")
    .eq("id", id)
    .maybeSingle()

  if (reservationError) return NextResponse.json({ error: reservationError.message }, { status: 500 })
  if (!reservation) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 })

  const [history, housekeeping, hospitality, extras, guestRequests, issues, payments, invoices] = await Promise.all([
    supabase.from("reservation_history").select("id, status_change, notes, created_at").eq("reservation_id", id),
    supabase.from("housekeeping_tasks").select("id, task_type, status, notes, created_at, started_at, completed_at, verified_at").eq("reservation_id", id),
    supabase.from("hospitality_requests").select("id, request_type, status, description, created_at, completed_at").eq("reservation_id", id),
    supabase.from("reservation_extras").select("id, name, quantity, total_amount, notes, created_at").eq("reservation_id", id),
    supabase.from("guest_requests").select("id, request_type, status, description, created_at, resolved_at").eq("reservation_id", id),
    supabase.from("issues").select("id, title, status, description, created_at, resolved_at").eq("related_item_type", "reservation").eq("related_item_id", id),
    supabase.from("payments").select("id, amount, payment_method, payment_status, paid_at, created_at").eq("reservation_id", id),
    supabase.from("invoices").select("id, invoice_number, status, payment_status, total_amount, amount_paid, created_at, payment_date").eq("reservation_id", id),
  ])

  const firstError = [history, housekeeping, hospitality, extras, guestRequests, issues, payments, invoices].find((result) => result.error)?.error
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 })

  const events: TimelineEvent[] = []
  if (reservation.created_at) events.push(event({ id: `reservation-${reservation.id}`, occurredAt: reservation.created_at, category: "reservation", title: "Reserva creada", description: reservation.guest_name, status: reservation.status, source: "reservations" }))
  if (reservation.queued_at) events.push(event({ id: `queue-${reservation.id}`, occurredAt: reservation.queued_at, category: "arrival", title: "Huésped en espera de habitación", description: null, status: reservation.arrival_status, source: "reservations" }))
  if (reservation.room_ready_notified_at) events.push(event({ id: `ready-${reservation.id}`, occurredAt: reservation.room_ready_notified_at, category: "arrival", title: "Habitación lista para check-in", description: null, status: "ready_for_checkin", source: "reservations" }))
  if (reservation.actual_arrival_at || reservation.arrived_at) events.push(event({ id: `arrival-${reservation.id}`, occurredAt: reservation.actual_arrival_at ?? reservation.arrived_at, category: "arrival", title: "Llegada registrada", description: null, status: reservation.arrival_status, source: "reservations" }))
  if (reservation.check_in_completed_at) events.push(event({ id: `checkin-${reservation.id}`, occurredAt: reservation.check_in_completed_at, category: "arrival", title: "Check-in completado", description: null, status: "checked_in", source: "reservations" }))
  if (reservation.actual_departure_at) events.push(event({ id: `checkout-${reservation.id}`, occurredAt: reservation.actual_departure_at, category: "arrival", title: "Check-out completado", description: null, status: "checked_out", source: "reservations" }))

  for (const row of history.data ?? []) if (row.created_at) events.push(event({ id: `history-${row.id}`, occurredAt: row.created_at, category: "reservation", title: row.status_change, description: row.notes, status: null, source: "reservation_history" }))
  for (const row of housekeeping.data ?? []) {
    if (row.created_at) events.push(event({ id: `hk-create-${row.id}`, occurredAt: row.created_at, category: "housekeeping", title: `Housekeeping: ${row.task_type}`, description: row.notes, status: row.status, source: "housekeeping_tasks" }))
    if (row.started_at) events.push(event({ id: `hk-start-${row.id}`, occurredAt: row.started_at, category: "housekeeping", title: "Housekeeping iniciado", description: row.task_type, status: "in_progress", source: "housekeeping_tasks" }))
    if (row.completed_at) events.push(event({ id: `hk-complete-${row.id}`, occurredAt: row.completed_at, category: "housekeeping", title: "Housekeeping completado", description: row.task_type, status: "completed", source: "housekeeping_tasks" }))
    if (row.verified_at) events.push(event({ id: `hk-verify-${row.id}`, occurredAt: row.verified_at, category: "housekeeping", title: "Inspección verificada", description: row.task_type, status: "verified", source: "housekeeping_tasks" }))
  }
  for (const row of hospitality.data ?? []) {
    if (row.created_at) events.push(event({ id: `hospitality-${row.id}`, occurredAt: row.created_at, category: "hospitality", title: `Hospitality: ${row.request_type}`, description: row.description, status: row.status, source: "hospitality_requests" }))
    if (row.completed_at) events.push(event({ id: `hospitality-complete-${row.id}`, occurredAt: row.completed_at, category: "hospitality", title: "Solicitud de Hospitality completada", description: row.request_type, status: "completed", source: "hospitality_requests" }))
  }
  for (const row of extras.data ?? []) if (row.created_at) events.push(event({ id: `extra-${row.id}`, occurredAt: row.created_at, category: "service", title: `Servicio agregado: ${row.name}`, description: `${row.quantity} unidad(es) · $${Number(row.total_amount ?? 0).toLocaleString("es-CL")}${row.notes ? ` · ${row.notes}` : ""}`, status: null, source: "reservation_extras" }))
  for (const row of guestRequests.data ?? []) {
    if (row.created_at) events.push(event({ id: `guest-request-${row.id}`, occurredAt: row.created_at, category: "hospitality", title: `Solicitud del huésped: ${row.request_type}`, description: row.description, status: row.status, source: "guest_requests" }))
    if (row.resolved_at) events.push(event({ id: `guest-request-resolved-${row.id}`, occurredAt: row.resolved_at, category: "hospitality", title: "Solicitud del huésped resuelta", description: row.request_type, status: "resolved", source: "guest_requests" }))
  }
  for (const row of issues.data ?? []) {
    if (row.created_at) events.push(event({ id: `issue-${row.id}`, occurredAt: row.created_at, category: "issue", title: row.title ?? "Incidencia creada", description: row.description, status: row.status, source: "issues" }))
    if (row.resolved_at) events.push(event({ id: `issue-resolved-${row.id}`, occurredAt: row.resolved_at, category: "issue", title: "Incidencia resuelta", description: row.title, status: "resolved", source: "issues" }))
  }
  for (const row of payments.data ?? []) events.push(event({ id: `payment-${row.id}`, occurredAt: row.paid_at ?? row.created_at, category: "finance", title: "Pago registrado", description: `${Number(row.amount).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })}${row.payment_method ? ` · ${row.payment_method}` : ""}`, status: row.payment_status, source: "payments" }))
  for (const row of invoices.data ?? []) {
    if (row.created_at) events.push(event({ id: `invoice-${row.id}`, occurredAt: row.created_at, category: "finance", title: `Factura ${row.invoice_number}`, description: `${Number(row.total_amount).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })} · pagado ${Number(row.amount_paid ?? 0).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })}`, status: row.payment_status ?? row.status, source: "invoices" }))
    if (row.payment_date) events.push(event({ id: `invoice-payment-${row.id}`, occurredAt: row.payment_date, category: "finance", title: `Pago aplicado a factura ${row.invoice_number}`, description: null, status: row.payment_status, source: "invoices" }))
  }

  events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
  return NextResponse.json({ reservation, events, count: events.length })
}

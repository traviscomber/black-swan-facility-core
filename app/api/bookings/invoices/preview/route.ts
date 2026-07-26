import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { roundClp } from "@/lib/money"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FINANCE_ROLES = new Set(["admin", "approver"])
const BLOCKED_STATUSES = new Set(["cancelled", "canceled", "void", "voided"])

type ReservationExtra = {
  id: string
  extra_id: string | null
  name: string
  unit: string
  quantity: number | string
  unit_price: number | string
  tax_rate: number | string
  total_amount: number | string | null
  created_at: string
}

function asNumber(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 })
  }

  const role = String(user.app_metadata?.procurement_role ?? "")
  if (!FINANCE_ROLES.has(role)) {
    return NextResponse.json({ error: "Se requiere rol administrador o aprobador" }, { status: 403 })
  }

  const reservationId = new URL(request.url).searchParams.get("reservationId")
  if (!reservationId || !UUID_PATTERN.test(reservationId)) {
    return NextResponse.json({ error: "reservationId inválido" }, { status: 400 })
  }

  try {
    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .select("id, guest_id, room_id, bed_id, guest_name, guest_email, guest_phone, check_in, check_out, status, total_amount")
      .eq("id", reservationId)
      .maybeSingle()

    if (reservationError) throw reservationError
    if (!reservation) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 })

    const [guestResult, bedResult, extrasResult, invoiceResult] = await Promise.all([
      reservation.guest_id
        ? supabase.from("guests").select("name, email, phone, address").eq("id", reservation.guest_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      reservation.bed_id
        ? supabase.from("beds").select("room_id").eq("id", reservation.bed_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("reservation_extras")
        .select("id, extra_id, name, unit, quantity, unit_price, tax_rate, total_amount, created_at")
        .eq("reservation_id", reservationId)
        .order("created_at", { ascending: true }),
      supabase
        .from("invoices")
        .select("id, invoice_number, status, total_amount")
        .eq("reservation_id", reservationId)
        .not("status", "in", "(void,cancelled)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (guestResult.error) throw guestResult.error
    if (bedResult.error) throw bedResult.error
    if (extrasResult.error) throw extrasResult.error
    if (invoiceResult.error) throw invoiceResult.error

    const roomId = reservation.room_id ?? bedResult.data?.room_id ?? null
    const roomResult = roomId
      ? await supabase.from("rooms").select("room_number").eq("id", roomId).maybeSingle()
      : { data: null, error: null }

    if (roomResult.error) throw roomResult.error

    const checkIn = new Date(`${reservation.check_in}T00:00:00Z`)
    const checkOut = new Date(`${reservation.check_out}T00:00:00Z`)
    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000)
    const status = String(reservation.status ?? "confirmed").toLowerCase()
    const lodgingSubtotal = roundClp(asNumber(reservation.total_amount))
    const extras = (extrasResult.data ?? []) as ReservationExtra[]

    const lineItems = [
      {
        type: "lodging",
        description: `Alojamiento ${roomResult.data?.room_number ?? "sin habitación asignada"} - ${reservation.check_in} a ${reservation.check_out}`,
        qty: 1,
        quantity: 1,
        nights,
        unit_price: lodgingSubtotal,
        tax_rate: 0,
        subtotal: lodgingSubtotal,
        tax_amount: 0,
        total: lodgingSubtotal,
      },
      ...extras.map((extra) => {
        const subtotal = roundClp(asNumber(extra.total_amount))
        const taxAmount = roundClp((subtotal * asNumber(extra.tax_rate)) / 100)
        return {
          type: "extra",
          extra_id: extra.extra_id,
          description: extra.name,
          unit: extra.unit,
          qty: asNumber(extra.quantity),
          quantity: asNumber(extra.quantity),
          unit_price: roundClp(asNumber(extra.unit_price)),
          tax_rate: asNumber(extra.tax_rate),
          subtotal,
          tax_amount: taxAmount,
          total: subtotal + taxAmount,
        }
      }),
    ]

    const extrasSubtotal = lineItems.slice(1).reduce((sum, item) => sum + item.subtotal, 0)
    const taxAmount = lineItems.reduce((sum, item) => sum + item.tax_amount, 0)
    const subtotal = lodgingSubtotal + extrasSubtotal
    const totalAmount = subtotal + taxAmount
    const blockers: string[] = []

    if (BLOCKED_STATUSES.has(status)) blockers.push("La reserva está anulada o cancelada")
    if (nights <= 0) blockers.push("La fecha de salida debe ser posterior a la fecha de entrada")
    if (lodgingSubtotal < 0) blockers.push("El monto de alojamiento no puede ser negativo")
    if (invoiceResult.data) blockers.push("La reserva ya tiene una factura activa")

    return NextResponse.json({
      eligible: blockers.length === 0,
      blockers,
      existing_invoice: invoiceResult.data,
      reservation: {
        id: reservation.id,
        status: reservation.status,
        check_in: reservation.check_in,
        check_out: reservation.check_out,
        nights,
        room_number: roomResult.data?.room_number ?? null,
      },
      customer: {
        name: guestResult.data?.name ?? reservation.guest_name,
        email: guestResult.data?.email ?? reservation.guest_email,
        phone: guestResult.data?.phone ?? reservation.guest_phone,
        address: guestResult.data?.address ?? null,
      },
      currency: "CLP",
      line_items: lineItems,
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
    })
  } catch (error) {
    console.error("[invoices/preview] preflight failed", error)
    return NextResponse.json({ error: "No se pudo validar la factura antes de generarla" }, { status: 500 })
  }
}

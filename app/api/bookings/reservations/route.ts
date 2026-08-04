import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export async function POST(request: Request) {
  const supabase = await createClient()

  try {
    const body = await request.json()
    const { bed_id, guest_name, check_in, check_out, num_guests, total_amount } = body

    if (!bed_id || !guest_name || !check_in || !check_out) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios: cama, huésped, check-in o check-out" },
        { status: 400 },
      )
    }

    if (!isValidDate(check_in) || !isValidDate(check_out) || check_out <= check_in) {
      return NextResponse.json(
        { error: "El rango de fechas no es válido" },
        { status: 400 },
      )
    }

    const { data, error } = await supabase.rpc("create_reservation_atomic", {
      p_bed_id: bed_id,
      p_guest_name: guest_name,
      p_guest_email: body.guest_email || null,
      p_guest_phone: body.guest_phone || null,
      p_check_in: check_in,
      p_check_out: check_out,
      p_num_guests: num_guests || 1,
      p_total_amount: total_amount || 0,
      p_status: body.status || "confirmed",
      p_special_requests: body.special_requests || null,
      p_invoice_due_date: body.invoice_due_date || null,
    })

    if (error) {
      console.error("[reservations] RPC error:", error)
      return NextResponse.json(
        { error: error.message || "No fue posible crear la reserva", code: error.code },
        { status: 409 },
      )
    }

    if (!data?.success) {
      return NextResponse.json(
        { error: data?.error || "No fue posible crear la reserva", code: data?.error_code },
        { status: 409 },
      )
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("[reservations] POST error:", error)
    const message = error instanceof Error ? error.message : "Error interno"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const bedId = searchParams.get("bed_id")
  const checkIn = searchParams.get("check_in")
  const checkOut = searchParams.get("check_out")

  if ((checkIn && !checkOut) || (!checkIn && checkOut)) {
    return NextResponse.json(
      { error: "check_in y check_out deben enviarse juntos" },
      { status: 400 },
    )
  }

  if (checkIn && checkOut && (!isValidDate(checkIn) || !isValidDate(checkOut) || checkOut <= checkIn)) {
    return NextResponse.json(
      { error: "El rango de fechas no es válido" },
      { status: 400 },
    )
  }

  try {
    let query = supabase
      .from("reservations")
      .select(
        `
        *,
        bed:beds(id, bed_number, room_id, room:rooms(id, room_number, location)),
        guest:guests(id, name, email, phone)
      `,
      )
      .order("check_in", { ascending: true })

    if (bedId) query = query.eq("bed_id", bedId)

    // Interval overlap: existing check-in is before requested checkout and
    // existing checkout is after requested check-in.
    if (checkIn && checkOut) {
      query = query.lt("check_in", checkOut).gt("check_out", checkIn)
    }

    query = query.not("status", "in", "(cancelled,canceled,void,voided)")

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("[reservations] GET error:", error)
    const message = error instanceof Error ? error.message : "No fue posible cargar las reservas"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

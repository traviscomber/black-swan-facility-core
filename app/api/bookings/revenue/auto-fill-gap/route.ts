import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { differenceInCalendarDays } from "date-fns"

interface ReservationRpcResult {
  success?: boolean
  reservation_id?: string
  error?: string
  error_code?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      room_id,
      gap_start,
      gap_end,
      rate_per_night,
      guest_name,
      guest_email,
      guest_phone,
      num_guests = 1,
    } = body

    if (!room_id || typeof room_id !== "string") {
      return NextResponse.json({ error: "room_id es obligatorio" }, { status: 400 })
    }
    if (!gap_start || !gap_end) {
      return NextResponse.json({ error: "gap_start y gap_end son obligatorios" }, { status: 400 })
    }
    if (!guest_name || typeof guest_name !== "string" || !guest_name.trim()) {
      return NextResponse.json({ error: "guest_name es obligatorio" }, { status: 400 })
    }

    const checkIn = new Date(`${gap_start}T00:00:00Z`)
    const checkOut = new Date(`${gap_end}T00:00:00Z`)
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
      return NextResponse.json({ error: "Fechas inválidas" }, { status: 400 })
    }
    if (checkOut <= checkIn) {
      return NextResponse.json({ error: "check_out debe ser posterior a check_in" }, { status: 400 })
    }

    const nights = differenceInCalendarDays(checkOut, checkIn)
    const nightlyRate = Number(rate_per_night ?? 0)
    const guests = Number(num_guests)

    if (!Number.isFinite(nightlyRate) || nightlyRate < 0) {
      return NextResponse.json({ error: "rate_per_night no es válido" }, { status: 400 })
    }
    if (!Number.isInteger(guests) || guests < 1) {
      return NextResponse.json({ error: "num_guests debe ser al menos 1" }, { status: 400 })
    }

    const totalAmount = nightlyRate * nights
    const supabase = await createClient()

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, room_number, location_id")
      .eq("id", room_id)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Habitación no encontrada" }, { status: 404 })
    }

    const { data: beds, error: bedsError } = await supabase
      .from("beds")
      .select("id, bed_number")
      .eq("room_id", room_id)
      .eq("is_available", true)
      .order("bed_number", { ascending: true })

    if (bedsError) {
      return NextResponse.json({ error: bedsError.message }, { status: 500 })
    }

    let availableBed: { id: string; bed_number: string } | null = null

    for (const bed of beds ?? []) {
      const { data: available, error: availabilityError } = await supabase.rpc(
        "is_booking_inventory_available",
        {
          p_bed_id: bed.id,
          p_room_id: room_id,
          p_location_id: room.location_id,
          p_check_in: gap_start,
          p_check_out: gap_end,
          p_exclude_reservation_id: null,
        },
      )

      if (availabilityError) {
        return NextResponse.json(
          { error: `No fue posible validar disponibilidad: ${availabilityError.message}` },
          { status: 500 },
        )
      }

      if (available === true) {
        availableBed = bed
        break
      }
    }

    if (!availableBed) {
      return NextResponse.json(
        { error: "No existe una cama disponible para todo el intervalo solicitado" },
        { status: 409 },
      )
    }

    const { data, error: rpcError } = await supabase.rpc("create_reservation_atomic", {
      p_bed_id: availableBed.id,
      p_guest_name: guest_name.trim(),
      p_guest_email: typeof guest_email === "string" && guest_email.trim() ? guest_email.trim() : null,
      p_guest_phone: typeof guest_phone === "string" && guest_phone.trim() ? guest_phone.trim() : null,
      p_check_in: gap_start,
      p_check_out: gap_end,
      p_num_guests: guests,
      p_total_amount: totalAmount,
      p_status: "confirmed",
      p_special_requests: "Creada desde optimización de disponibilidad.",
      p_invoice_due_date: null,
    })

    if (rpcError) {
      return NextResponse.json(
        { error: rpcError.message || "Error al crear la reserva" },
        { status: 409 },
      )
    }

    const result = data as ReservationRpcResult | null
    if (!result?.success || !result.reservation_id) {
      return NextResponse.json(
        { error: result?.error || "La reserva no pudo ser creada", code: result?.error_code },
        { status: 409 },
      )
    }

    return NextResponse.json({
      success: true,
      reservation_id: result.reservation_id,
      room_number: room.room_number,
      bed_number: availableBed.bed_number,
      check_in: gap_start,
      check_out: gap_end,
      nights,
      total_amount: totalAmount,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

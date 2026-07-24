import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { differenceInCalendarDays } from "date-fns"

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
      num_guests = 1,
    } = body

    // ── Input validation ──────────────────────────────────────────────────
    if (!room_id || typeof room_id !== "string") {
      return NextResponse.json({ error: "room_id es obligatorio" }, { status: 400 })
    }
    if (!gap_start || !gap_end) {
      return NextResponse.json({ error: "gap_start y gap_end son obligatorios" }, { status: 400 })
    }
    if (!guest_name || typeof guest_name !== "string" || !guest_name.trim()) {
      return NextResponse.json({ error: "guest_name es obligatorio" }, { status: 400 })
    }

    const checkIn  = new Date(gap_start)
    const checkOut = new Date(gap_end)
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return NextResponse.json({ error: "Fechas invalidas" }, { status: 400 })
    }
    if (checkOut <= checkIn) {
      return NextResponse.json(
        { error: "check_out debe ser posterior a check_in" },
        { status: 400 },
      )
    }

    const nights      = differenceInCalendarDays(checkOut, checkIn)
    const totalAmount = Number(rate_per_night ?? 0) * nights

    const supabase = await createClient()

    // ── Verify room exists ────────────────────────────────────────────────
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("id, room_number")
      .eq("id", room_id)
      .single()

    if (roomErr || !room) {
      return NextResponse.json({ error: "Habitacion no encontrada" }, { status: 404 })
    }

    // ── Find first available bed for this room ────────────────────────────
    const { data: bed } = await supabase
      .from("beds")
      .select("id")
      .eq("room_id", room_id)
      .eq("is_available", true)
      .limit(1)
      .maybeSingle()

    if (!bed) {
      return NextResponse.json(
        { error: "Sin camas disponibles para esta habitacion" },
        { status: 409 },
      )
    }

    // ── Delegate to create_reservation_atomic ────────────────────────────
    // The RPC enforces double-booking prevention and all DB constraints.
    // Signature: p_bed_id, p_guest_name, p_guest_email, p_guest_phone,
    //            p_check_in, p_check_out, p_num_guests, p_total_amount,
    //            p_status, p_special_requests, p_invoice_due_date
    const { data: reservationId, error: rpcErr } = await supabase.rpc(
      "create_reservation_atomic",
      {
        p_bed_id:       bed.id,
        p_guest_name:   guest_name.trim(),
        p_guest_email:  guest_email?.trim() ?? null,
        p_check_in:     gap_start,
        p_check_out:    gap_end,
        p_num_guests:   Math.max(1, Number(num_guests)),
        p_total_amount: totalAmount,
        p_status:       "confirmed",
      },
    )

    if (rpcErr) {
      return NextResponse.json(
        { error: rpcErr.message ?? "Error al crear la reserva" },
        { status: 409 },
      )
    }

    return NextResponse.json({
      success:        true,
      reservation_id: reservationId,
      room_number:    room.room_number,
      check_in:       gap_start,
      check_out:      gap_end,
      total_amount:   totalAmount,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

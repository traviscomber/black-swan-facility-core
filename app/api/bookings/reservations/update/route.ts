import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH(request: Request) {
  const supabase = await createClient()

  try {
    const body = await request.json()
    const { reservation_id, check_in, check_out } = body

    if (!reservation_id || !check_in || !check_out) {
      return NextResponse.json(
        { error: "Missing required fields: reservation_id, check_in, check_out" },
        { status: 400 }
      )
    }

    // Validate dates
    if (check_out <= check_in) {
      return NextResponse.json(
        { error: "check_out must be after check_in" },
        { status: 400 }
      )
    }

    // Get the reservation to check bed and current dates
    const { data: reservation, error: fetchError } = await supabase
      .from("reservations")
      .select("id, bed_id, status")
      .eq("id", reservation_id)
      .single()

    if (fetchError || !reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 })
    }

    // Don't allow updating cancelled reservations
    if (["cancelled", "canceled", "void", "voided"].includes(reservation.status)) {
      return NextResponse.json(
        { error: "Cannot modify cancelled or void reservations" },
        { status: 409 }
      )
    }

    // Check for conflicts with other reservations on the same bed
    const { data: conflicts, error: conflictError } = await supabase
      .from("reservations")
      .select("id, guest_name, check_in, check_out")
      .eq("bed_id", reservation.bed_id)
      .neq("id", reservation_id)
      .not("status", "in", "(cancelled, canceled, void, voided)")

    if (conflictError) throw conflictError

    // Check if new dates overlap with any existing reservations
    const hasConflict = conflicts?.some((existing) => {
      const existingStart = new Date(existing.check_in)
      const existingEnd = new Date(existing.check_out)
      const newStart = new Date(check_in)
      const newEnd = new Date(check_out)
      return newStart < existingEnd && newEnd > existingStart
    })

    if (hasConflict) {
      return NextResponse.json(
        { error: "New dates conflict with an existing reservation" },
        { status: 409 }
      )
    }

    // Check for room blocks
    const { data: roomData } = await supabase
      .from("beds")
      .select("room_id")
      .eq("id", reservation.bed_id)
      .single()

    if (roomData) {
      const { data: blocks } = await supabase
        .from("room_blocks")
        .select("id, start_date, end_date")
        .eq("room_id", roomData.room_id)
        .eq("status", "active")

      const blockConflict = blocks?.some((block) => {
        const blockStart = new Date(block.start_date)
        const blockEnd = new Date(block.end_date)
        const newStart = new Date(check_in)
        const newEnd = new Date(check_out)
        return newStart < blockEnd && newEnd > blockStart
      })

      if (blockConflict) {
        return NextResponse.json(
          { error: "New dates conflict with an active room block" },
          { status: 409 }
        )
      }
    }

    // Update reservation with new dates
    const { data: updated, error: updateError } = await supabase
      .from("reservations")
      .update({
        check_in,
        check_out,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reservation_id)
      .select("*")
      .single()

    if (updateError) throw updateError

    return NextResponse.json(
      {
        success: true,
        message: "Reservation dates updated successfully",
        reservation: updated,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[reservations/update] error:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

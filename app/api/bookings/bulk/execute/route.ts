import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { reservation_ids, days_delta, days_extend } = await req.json()

  if (!Array.isArray(reservation_ids) || reservation_ids.length === 0) {
    return NextResponse.json({ error: "No reservations selected" }, { status: 400 })
  }

  try {
    // Pre-flight check: get all reservations
    const { data: reservations, error: fetchError } = await supabase
      .from("reservations")
      .select("id, check_in, check_out, bed_id, status")
      .in("id", reservation_ids)

    if (fetchError) throw fetchError
    if (!reservations || reservations.length === 0) {
      return NextResponse.json({ error: "Reservations not found" }, { status: 404 })
    }

    // Calculate new dates for each reservation
    const updates = reservations.map((res: any) => {
      const checkIn = new Date(res.check_in)
      const checkOut = new Date(res.check_out)
      
      checkIn.setDate(checkIn.getDate() + days_delta)
      checkOut.setDate(checkOut.getDate() + days_delta + days_extend)

      return {
        id: res.id,
        check_in: checkIn.toISOString().split("T")[0],
        check_out: checkOut.toISOString().split("T")[0],
        bed_id: res.bed_id,
      }
    })

    // Check for conflicts via RPC
    const { data: conflicts, error: conflictError } = await supabase.rpc("check_bulk_conflicts", {
      p_updates: updates,
    })

    if (conflictError) throw conflictError

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json(
        {
          error: `${conflicts.length} conflictos detectados`,
          conflicts: conflicts.map((c: any) => ({ id: c.reservation_id, reason: c.reason })),
          success: false,
        },
        { status: 409 }
      )
    }

    // Execute bulk update atomically
    const { error: updateError } = await supabase.rpc("execute_bulk_update", {
      p_updates: updates,
      p_operation_id: crypto.randomUUID(),
    })

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      updated_count: updates.length,
    })
  } catch (error: any) {
    console.error("[bulk/execute] Error:", error)
    return NextResponse.json(
      { error: error.message || "Bulk operation failed" },
      { status: 500 }
    )
  }
}

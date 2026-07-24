import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await createClient()

  try {
    const body = await request.json()

    // Validate required fields
    const { bed_id, guest_name, check_in, check_out, num_guests, total_amount } = body

    if (!bed_id || !guest_name || !check_in || !check_out) {
      return NextResponse.json(
        { error: "Missing required fields: bed_id, guest_name, check_in, check_out" },
        { status: 400 }
      )
    }

    // Call atomic RPC function
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
        {
          error: error.message || "Failed to create reservation",
          code: error.code,
        },
        { status: 409 } // 409 Conflict for double-booking
      )
    }

    if (!data?.success) {
      return NextResponse.json(
        {
          error: data?.error || "Reservation creation failed",
          code: data?.error_code,
        },
        { status: 409 }
      )
    }

    // Return 201 Created with the reservation data
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("[reservations] POST error:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const bedId = searchParams.get("bed_id")
  const checkIn = searchParams.get("check_in")
  const checkOut = searchParams.get("check_out")

  try {
    let query = supabase
      .from("reservations")
      .select(
        `
        *,
        bed:beds(id, bed_number, room_id, room:rooms(id, room_number, location)),
        guest:guests(id, name, email, phone)
      `
      )
      .order("check_in", { ascending: true })

    // Filter by bed if provided
    if (bedId) {
      query = query.eq("bed_id", bedId)
    }

    // Filter by date range if provided
    if (checkIn && checkOut) {
      query = query
        .gte("check_in", checkIn)
        .lte("check_out", checkOut)
    }

    // Exclude cancelled reservations
    query = query.not("status", "in", "(cancelled, canceled, void, voided)")

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("[reservations] GET error:", error)
    const message = error instanceof Error ? error.message : "Failed to fetch reservations"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

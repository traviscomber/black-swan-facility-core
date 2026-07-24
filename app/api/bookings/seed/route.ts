/**
 * DEV-ONLY seed endpoint for calendar test data.
 * Creates 5 test reservations across visible beds using today as anchor.
 * DELETE /api/bookings/seed  → removes all TEST_* reservations
 * POST   /api/bookings/seed  → creates fresh test reservations
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { addDays, format } from "date-fns"

const TEST_MARKER = "TEST_"

const SEED_GUESTS = [
  { name: "TEST_García Morales", days: 3, offset: 1, status: "confirmed", amount: 150000 },
  { name: "TEST_Silva Torres", days: 2, offset: 2, status: "checked_in", amount: 90000 },
  { name: "TEST_López Vargas", days: 4, offset: 5, status: "confirmed", amount: 220000 },
  { name: "TEST_Muñoz Pinto", days: 2, offset: 8, status: "pending", amount: 80000 },
  { name: "TEST_Rojas Fuentes", days: 3, offset: 3, status: "confirmed", amount: 135000 },
]

export async function POST() {
  const supabase = await createClient()
  const today = new Date()

  // 1. Get first 5 available beds (any)
  const { data: beds, error: bedErr } = await supabase
    .from("beds")
    .select("id, bed_number, room:rooms!inner(id, room_number)")
    .limit(5)
    .order("bed_number")

  if (bedErr) {
    return NextResponse.json({ error: `Could not fetch beds: ${bedErr.message}` }, { status: 500 })
  }
  if (!beds || beds.length === 0) {
    return NextResponse.json({ error: "No beds found. Add rooms and beds first." }, { status: 422 })
  }

  const created: any[] = []
  const errors: string[] = []

  for (let i = 0; i < Math.min(SEED_GUESTS.length, beds.length); i++) {
    const seed = SEED_GUESTS[i]
    const bed = beds[i]
    const checkIn = format(addDays(today, seed.offset), "yyyy-MM-dd")
    const checkOut = format(addDays(today, seed.offset + seed.days), "yyyy-MM-dd")

    const { data, error } = await supabase
      .from("reservations")
      .insert({
        bed_id: bed.id,
        guest_name: seed.name,
        guest_email: `test${i + 1}@blackswan-dev.test`,
        guest_phone: `+56900000${String(i + 1).padStart(3, "0")}`,
        check_in: checkIn,
        check_out: checkOut,
        num_guests: i + 1,
        total_amount: seed.amount,
        status: seed.status,
        special_requests: "Reserva de prueba — eliminar después",
        source: "seed",
      })
      .select("id, guest_name, check_in, check_out, status")
      .single()

    if (error) {
      // If conflict, skip gracefully
      errors.push(`${seed.name}: ${error.message}`)
    } else if (data) {
      created.push(data)
    }
  }

  return NextResponse.json({
    message: `Seed complete: ${created.length} created, ${errors.length} skipped`,
    created,
    skipped: errors,
    cleanup: "DELETE /api/bookings/seed to remove all TEST_ reservations",
  })
}

export async function DELETE() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("reservations")
    .delete()
    .like("guest_name", `${TEST_MARKER}%`)
    .select("id, guest_name")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    message: `Cleaned up ${data?.length ?? 0} test reservation(s)`,
    removed: data,
  })
}

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("reservations")
    .select("id, guest_name, check_in, check_out, status, bed_id")
    .like("guest_name", `${TEST_MARKER}%`)
    .order("check_in")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    count: data?.length ?? 0,
    reservations: data,
  })
}

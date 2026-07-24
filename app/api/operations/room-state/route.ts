import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  // Fetch rooms with their current active reservation and latest housekeeping task
  const today = new Date().toISOString().substring(0, 10)

  const [roomsResult, reservResult, hkResult] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, room_number, room_type, location, location_id, status, capacity")
      .order("room_number"),
    supabase
      .from("reservations")
      .select("room_id, guest_name, check_out, status")
      .lte("check_in", today)
      .gte("check_out", today)
      .in("status", ["confirmed", "checked_in", "checked-in"]),
    supabase
      .from("housekeeping_schedules")
      .select("bed_id, status")
      .gte("checkout_time", `${today}T00:00:00`)
      .lte("checkout_time", `${today}T23:59:59`),
  ])

  if (roomsResult.error) {
    return NextResponse.json({ error: roomsResult.error.message }, { status: 500 })
  }

  const rooms = roomsResult.data ?? []
  const reservations = reservResult.data ?? []
  const hkTasks = hkResult.data ?? []

  // Map bed_ids from hk tasks to room ids via beds
  const { data: bedsData } = await supabase
    .from("beds")
    .select("id, room_id")
    .in("id", hkTasks.map((t) => t.bed_id).filter(Boolean) as string[])

  const bedToRoom = Object.fromEntries(
    (bedsData ?? []).map((b) => [b.id, b.room_id]),
  )

  const enriched = rooms.map((room) => {
    const activeRes = reservations.find((r) => r.room_id === room.id) ?? null
    const hkTask = hkTasks.find((t) => bedToRoom[t.bed_id ?? ""] === room.id) ?? null

    return {
      ...room,
      reservation_status: activeRes?.status ?? null,
      guest_name: activeRes?.guest_name ?? null,
      check_out: activeRes?.check_out ?? null,
      housekeeping_status: hkTask?.status ?? null,
    }
  })

  return NextResponse.json({ data: enriched })
}

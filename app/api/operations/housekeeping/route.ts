import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("housekeeping_schedules")
    .select(`
      *,
      bed:beds (
        bed_number,
        room:rooms ( room_number, location )
      ),
      reservation:reservations (
        guest_name,
        check_out
      )
    `)
    .order("checkout_time", { ascending: true })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { id, status } = await req.json()
  if (!id || !status) {
    return NextResponse.json({ error: "id y status son obligatorios" }, { status: 400 })
  }
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === "completed") update.completed_at = new Date().toISOString()
  const { error } = await supabase
    .from("housekeeping_schedules")
    .update(update)
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

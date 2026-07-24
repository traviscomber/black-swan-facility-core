import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("maintenance_schedules")
    .select(`
      *,
      bed:beds (
        bed_number,
        room:rooms ( room_number, location )
      )
    `)
    .order("scheduled_date", { ascending: true })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { bed_id, maintenance_type, scheduled_date, duration_minutes, priority } = await req.json()
  if (!maintenance_type) {
    return NextResponse.json({ error: "maintenance_type es obligatorio" }, { status: 400 })
  }
  const { data, error } = await supabase
    .from("maintenance_schedules")
    .insert([{ bed_id, maintenance_type, scheduled_date, duration_minutes, priority }])
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { id, status } = await req.json()
  if (!id || !status) {
    return NextResponse.json({ error: "id y status son obligatorios" }, { status: 400 })
  }
  const { error } = await supabase
    .from("maintenance_schedules")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("maintenance_schedules")
    .select("*, beds(bed_number)")
    .order("scheduled_date", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { bed_id, maintenance_type, scheduled_date, duration_minutes, priority } = await req.json()
  const { error } = await supabase.from("maintenance_schedules").insert([{
    bed_id, maintenance_type, scheduled_date, duration_minutes, priority
  }])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("housekeeping_schedules")
    .select("*, beds(bed_number), profiles(full_name)")
    .order("checkout_time", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { id, status } = await req.json()
  const { error } = await supabase.from("housekeeping_schedules").update({ status }).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

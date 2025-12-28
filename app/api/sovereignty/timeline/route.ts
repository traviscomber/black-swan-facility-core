import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("sovereignty_timeline")
      .select("*")
      .order("event_date", { ascending: false })
      .limit(10)

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error) {
    console.error("Error fetching timeline:", error)
    return NextResponse.json({ error: "Failed to fetch timeline" }, { status: 500 })
  }
}

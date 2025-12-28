import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from("sovereignty_dependencies").select("*").order("criticality")

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error) {
    console.error("Error fetching dependencies:", error)
    return NextResponse.json({ error: "Failed to fetch dependencies" }, { status: 500 })
  }
}

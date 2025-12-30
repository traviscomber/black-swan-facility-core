import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("sovereignty_objectives")
      .select("*")
      .order("priority", { ascending: true })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching objectives:", error)
    return NextResponse.json({ error: "Failed to fetch objectives" }, { status: 500 })
  }
}

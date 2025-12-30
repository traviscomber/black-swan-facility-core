import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("sovereignty_layers")
      .select("*")
      .order("layer_number", { ascending: true })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching layers:", error)
    return NextResponse.json({ error: "Failed to fetch layers" }, { status: 500 })
  }
}

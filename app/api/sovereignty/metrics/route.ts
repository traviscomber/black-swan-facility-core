import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from("sovereignty_metrics").select("*").order("category")

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error) {
    console.error("Error fetching metrics:", error)
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { data, error } = await supabase.from("sovereignty_metrics").insert([body]).select()

    if (error) throw error
    return NextResponse.json(data?.[0])
  } catch (error) {
    console.error("Error creating metric:", error)
    return NextResponse.json({ error: "Failed to create metric" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { id, ...updates } = body

    const { data, error } = await supabase.from("sovereignty_metrics").update(updates).eq("id", id).select()

    if (error) throw error
    return NextResponse.json(data?.[0])
  } catch (error) {
    console.error("Error updating metric:", error)
    return NextResponse.json({ error: "Failed to update metric" }, { status: 500 })
  }
}

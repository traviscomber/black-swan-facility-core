import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { data, error } = await supabase.storage
      .from("vineyard")
      .list("vines/photos", {
        limit: 100,
        offset: 0,
        sortBy: { column: "updated_at", order: "desc" },
      })

    if (error) throw error

    console.log("[v0] Listed photos:", data?.length || 0)
    return NextResponse.json(data || [])
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error listing photos"
    console.error("[v0] Error listing photos:", message)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

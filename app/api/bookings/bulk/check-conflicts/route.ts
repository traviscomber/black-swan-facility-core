import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { updates } = await req.json()

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 })
  }

  const result = await supabase.rpc("check_bulk_conflicts", { p_updates: updates })
  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 })
  }

  const conflicts = result.data as Array<{ reservation_id: string; reason: string }> | null
  return NextResponse.json({ conflicts: conflicts ?? [], has_conflicts: (conflicts?.length ?? 0) > 0 })
}

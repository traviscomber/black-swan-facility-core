import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { reservation_ids, status } = await req.json() as { reservation_ids: string[]; status: string }

  if (!Array.isArray(reservation_ids) || reservation_ids.length === 0 || !status) {
    return NextResponse.json({ error: "Missing reservation_ids or status" }, { status: 400 })
  }

  const updates = reservation_ids.map((id) => ({ id, status }))

  const result = await supabase.rpc("execute_bulk_update", {
    p_updates: updates,
    p_operation_type: "status_change",
    p_operation_id: crypto.randomUUID(),
  })
  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 })
  }

  const data = result.data as { success: boolean; operation_id: string; updated_count: number; error?: string }
  if (!data?.success) {
    return NextResponse.json({ error: data?.error ?? "Status update failed" }, { status: 500 })
  }

  return NextResponse.json({ success: true, operation_id: data.operation_id, updated_count: data.updated_count })
}

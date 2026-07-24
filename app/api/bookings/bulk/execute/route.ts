import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export interface BulkUpdate {
  id: string
  check_in?: string
  check_out?: string
  status?: string
  bed_id?: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  const { reservation_ids, updates, operation_type = "move" } = body as {
    reservation_ids: string[]
    updates: BulkUpdate[]
    operation_type?: string
  }

  if (!Array.isArray(reservation_ids) || reservation_ids.length === 0) {
    return NextResponse.json({ error: "No reservations selected" }, { status: 400 })
  }
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 })
  }

  // Pre-flight conflict check
  const conflictsResult = await supabase.rpc("check_bulk_conflicts", {
    p_updates: updates,
  })
  if (conflictsResult.error) {
    return NextResponse.json({ error: conflictsResult.error.message }, { status: 500 })
  }
  const conflicts = conflictsResult.data as Array<{ reservation_id: string; reason: string }> | null
  if (conflicts && conflicts.length > 0) {
    return NextResponse.json(
      { error: `${conflicts.length} conflicto${conflicts.length !== 1 ? "s" : ""} detectado${conflicts.length !== 1 ? "s" : ""}`, conflicts, success: false },
      { status: 409 }
    )
  }

  // Atomic execution via RPC
  const executeResult = await supabase.rpc("execute_bulk_update", {
    p_updates: updates,
    p_operation_type: operation_type,
    p_operation_id: crypto.randomUUID(),
  })
  if (executeResult.error) {
    return NextResponse.json({ error: executeResult.error.message }, { status: 500 })
  }

  const result = executeResult.data as { success: boolean; operation_id: string; updated_count: number; error?: string }
  if (!result?.success) {
    return NextResponse.json({ error: result?.error ?? "Bulk operation failed" }, { status: 500 })
  }

  return NextResponse.json({ success: true, operation_id: result.operation_id, updated_count: result.updated_count })
}

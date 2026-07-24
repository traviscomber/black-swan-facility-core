import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { operation_id } = await req.json() as { operation_id: string }

  if (!operation_id) {
    return NextResponse.json({ error: "Missing operation_id" }, { status: 400 })
  }

  const result = await supabase.rpc("restore_bulk_operation_state", {
    p_operation_id: operation_id,
  })
  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 })
  }

  const data = result.data as { success: boolean; restored_count?: number; error?: string }
  if (!data?.success) {
    return NextResponse.json({ error: data?.error ?? "Undo failed" }, { status: 400 })
  }

  return NextResponse.json({ success: true, restored_count: data.restored_count })
}

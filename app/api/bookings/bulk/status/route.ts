import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  if (user.app_metadata?.procurement_role !== "admin") {
    return NextResponse.json({ error: "Administrator role required" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const reservationIds =
    typeof body === "object" && body !== null && Array.isArray((body as { reservation_ids?: unknown }).reservation_ids)
      ? (body as { reservation_ids: unknown[] }).reservation_ids
      : []
  const status =
    typeof body === "object" && body !== null && typeof (body as { status?: unknown }).status === "string"
      ? (body as { status: string }).status.trim()
      : ""
  const validIds = [...new Set(reservationIds.filter((id): id is string => typeof id === "string" && UUID_PATTERN.test(id)))]

  if (validIds.length === 0 || validIds.length !== reservationIds.length || !status || status.length > 40) {
    return NextResponse.json({ error: "Invalid reservation_ids or status" }, { status: 400 })
  }

  const result = await supabase.rpc("execute_bulk_update", {
    p_updates: validIds.map((id) => ({ id, status })),
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

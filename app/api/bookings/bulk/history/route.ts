import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200)
  const offset = Number(searchParams.get("offset") ?? "0")
  const operation_type = searchParams.get("operation_type") ?? null

  const status = searchParams.get("status") ?? null

  let query = supabase
    .from("bulk_operations")
    .select("id, operation_type, reservation_ids, status, created_at, expires_at, applied_state", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (operation_type) query = query.eq("operation_type", operation_type)
  if (status)         query = query.eq("status",         status)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, total: count ?? 0, limit, offset })
}

import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const ALLOWED_OPERATION_TYPES = new Set(["move", "resize", "status_change", "delete"])
const ALLOWED_STATUSES = new Set(["completed", "undone"])

function parseBoundedInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 })
  }

  if (user.app_metadata?.procurement_role !== "admin") {
    return NextResponse.json({ error: "Se requiere rol administrador" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const limit = parseBoundedInteger(searchParams.get("limit"), 50, 1, 200)
  const offset = parseBoundedInteger(searchParams.get("offset"), 0, 0, 100000)
  const operationType = searchParams.get("operation_type")
  const status = searchParams.get("status")

  if (operationType && !ALLOWED_OPERATION_TYPES.has(operationType)) {
    return NextResponse.json({ error: "Tipo de operación inválido" }, { status: 400 })
  }

  if (status && !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 })
  }

  let query = supabase
    .from("bulk_operations")
    .select("id, operation_type, reservation_ids, status, created_at, expires_at, applied_state", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (operationType) query = query.eq("operation_type", operationType)
  if (status) query = query.eq("status", status)

  const { data, error, count } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const enriched = (data ?? []).map((row) => ({
    ...row,
    reservation_count: Array.isArray(row.reservation_ids) ? row.reservation_ids.length : 0,
  }))

  return NextResponse.json({ data: enriched, total: count ?? 0, limit, offset })
}

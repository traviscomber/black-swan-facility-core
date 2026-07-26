import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_OPERATION_TYPES = new Set(["move", "resize", "status_change", "delete"])
const ALLOWED_STATUSES = new Set(["pending", "confirmed", "checked_in", "checked_out", "cancelled", "no_show"])

export interface BulkUpdate {
  id: string
  check_in?: string
  check_out?: string
  status?: string
  bed_id?: string
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

function isValidUpdate(value: unknown): value is BulkUpdate {
  if (typeof value !== "object" || value === null) return false
  const update = value as Record<string, unknown>
  if (typeof update.id !== "string" || !UUID_PATTERN.test(update.id)) return false
  if (update.bed_id !== undefined && (typeof update.bed_id !== "string" || !UUID_PATTERN.test(update.bed_id))) return false
  if (update.check_in !== undefined && !isIsoDate(update.check_in)) return false
  if (update.check_out !== undefined && !isIsoDate(update.check_out)) return false
  if (update.status !== undefined && (typeof update.status !== "string" || !ALLOWED_STATUSES.has(update.status))) return false
  return update.check_in !== undefined || update.check_out !== undefined || update.status !== undefined || update.bed_id !== undefined
}

export async function POST(req: NextRequest) {
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 })
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 })
  }

  const raw = body as Record<string, unknown>
  const reservationIds = Array.isArray(raw.reservation_ids) ? raw.reservation_ids : []
  const updates = Array.isArray(raw.updates) ? raw.updates : []
  const operationType = typeof raw.operation_type === "string" ? raw.operation_type : "move"
  const validReservationIds = reservationIds.filter((id): id is string => typeof id === "string" && UUID_PATTERN.test(id))

  if (
    validReservationIds.length === 0 ||
    validReservationIds.length !== reservationIds.length ||
    updates.length === 0 ||
    !updates.every(isValidUpdate) ||
    !ALLOWED_OPERATION_TYPES.has(operationType)
  ) {
    return NextResponse.json({ error: "Reservas, actualizaciones o tipo de operación inválidos" }, { status: 400 })
  }

  const updateIds = new Set(updates.map((update) => update.id))
  if (updateIds.size !== updates.length || validReservationIds.some((id) => !updateIds.has(id))) {
    return NextResponse.json({ error: "Las reservas seleccionadas no coinciden con las actualizaciones" }, { status: 400 })
  }

  const conflictsResult = await supabase.rpc("check_bulk_conflicts", { p_updates: updates })
  if (conflictsResult.error) {
    return NextResponse.json({ error: conflictsResult.error.message }, { status: 500 })
  }

  const conflicts = conflictsResult.data as Array<{ reservation_id: string; reason: string }> | null
  if (conflicts && conflicts.length > 0) {
    const count = conflicts.length
    return NextResponse.json(
      {
        error: `${count} conflicto${count === 1 ? "" : "s"} detectado${count === 1 ? "" : "s"}`,
        conflicts,
        success: false,
      },
      { status: 409 },
    )
  }

  const executeResult = await supabase.rpc("execute_bulk_update", {
    p_updates: updates,
    p_operation_type: operationType,
    p_operation_id: crypto.randomUUID(),
  })
  if (executeResult.error) {
    return NextResponse.json({ error: executeResult.error.message }, { status: 500 })
  }

  const result = executeResult.data as { success: boolean; operation_id: string; updated_count: number; error?: string }
  if (!result?.success) {
    return NextResponse.json({ error: result?.error ?? "No fue posible completar la operación masiva" }, { status: 500 })
  }

  return NextResponse.json({ success: true, operation_id: result.operation_id, updated_count: result.updated_count })
}

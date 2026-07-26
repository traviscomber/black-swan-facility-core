import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidUpdate(value: unknown) {
  if (typeof value !== "object" || value === null) return false
  const update = value as Record<string, unknown>
  return typeof update.id === "string" && UUID_PATTERN.test(update.id)
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

  const updates =
    typeof body === "object" && body !== null && Array.isArray((body as { updates?: unknown }).updates)
      ? (body as { updates: unknown[] }).updates
      : []

  if (updates.length === 0 || !updates.every(isValidUpdate)) {
    return NextResponse.json({ error: "Actualizaciones inválidas" }, { status: 400 })
  }

  const result = await supabase.rpc("check_bulk_conflicts", { p_updates: updates })
  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 })
  }

  const conflicts = result.data as Array<{ reservation_id: string; reason: string }> | null
  return NextResponse.json({ conflicts: conflicts ?? [], has_conflicts: (conflicts?.length ?? 0) > 0 })
}

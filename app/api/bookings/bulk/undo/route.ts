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

  const operationId =
    typeof body === "object" && body !== null && typeof (body as { operation_id?: unknown }).operation_id === "string"
      ? (body as { operation_id: string }).operation_id
      : ""

  if (!UUID_PATTERN.test(operationId)) {
    return NextResponse.json({ error: "Identificador de operación inválido" }, { status: 400 })
  }

  const result = await supabase.rpc("restore_bulk_operation_state", {
    p_operation_id: operationId,
  })
  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 })
  }

  const data = result.data as { success: boolean; restored_count?: number; error?: string }
  if (!data?.success) {
    return NextResponse.json({ error: data?.error ?? "No fue posible deshacer la operación" }, { status: 400 })
  }

  return NextResponse.json({ success: true, restored_count: data.restored_count ?? 0 })
}

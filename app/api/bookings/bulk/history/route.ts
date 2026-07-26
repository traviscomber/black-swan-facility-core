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

  if (user
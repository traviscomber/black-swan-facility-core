import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const FINANCE_ROLES = new Set(["admin", "approver"])

function isValidUuid(value: string | null): value is string {
  return Boolean(value && UUID_PATTERN.test(value))
}

function isValidDate(value: string | null): value is string {
  if (!value || !DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  return { supabase, user: error ? null : user }
}

export async function GET(request: Request) {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const reservationId = searchParams.get("reservationId")
  const invoiceId = searchParams.get("invoiceId")

  if (invoiceId && !isValidUuid(invoiceId)) {
    return NextResponse.json({ error: "invoiceId inválido" }, { status: 400 })
  }
  if (reservationId && !isValidUuid(reservationId)) {
    return NextResponse.json({ error: "reservationId inválido" }, { status: 400 })
  }

  try {
    if (invoiceId) {
      const { data, error } = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle()
      if (error) throw error
      if (!data) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
      return NextResponse.json(data)
    }

    if (reservationId) {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("reservation_id", reservationId)
        .order("created_at", { ascending: false })

      if (error) throw error
      return NextResponse.json(data ?? [])
    }

    const { data, error } = await supabase
      .from("invoices")
      .select("id, reservation_id, invoice_number, invoice_date, due_date, status, customer_name, customer_email, total_amount, payment_status, amount_paid, created_at")
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500)

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error("[invoices] fetch failed", error)
    return NextResponse.json({ error: "No se pudieron consultar las facturas" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 })
  if (!FINANCE_ROLES.has(String(user.app_metadata?.procurement_role ?? ""))) {
    return NextResponse.json({ error: "Se requiere rol administrador o aprobador" }, { status: 403 })
  }

  try {
    const body = (await request.json()) as Record<string, unknown>
    const reservationId = String(body.reservation_id ?? "").trim()
    const dueDate = body.due_date ? String(body.due_date).trim() : null
    const notes = body.notes ? String(body.notes).trim() : null

    if (!isValidUuid(reservationId)) {
      return NextResponse.json({ error: "reservation_id inválido" }, { status: 400 })
    }
    if (dueDate && !isValidDate(dueDate)) {
      return NextResponse.json({ error: "due_date debe usar formato YYYY-MM-DD" }, { status: 400 })
    }
    if (notes && notes.length > 2000) {
      return NextResponse.json({ error: "Las observaciones no pueden superar 2.000 caracteres" }, { status: 400 })
    }

    const { data, error } = await supabase.rpc("create_reservation_invoice", {
      p_reservation_id: reservationId,
      p_due_date: dueDate,
      p_notes: notes,
    })

    if (error) throw error

    const payload = data as { created?: boolean; invoice?: Record<string, unknown> } | null
    if (!payload?.invoice) throw new Error("El RPC no devolvió una factura válida")

    return NextResponse.json(payload.invoice, { status: payload.created ? 201 : 200 })
  } catch (error) {
    console.error("[invoices] atomic creation failed", error)
    const message = error instanceof Error ? error.message : "No se pudo crear la factura"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

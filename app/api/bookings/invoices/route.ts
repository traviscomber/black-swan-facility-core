import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const reservationId = searchParams.get("reservationId")
  const invoiceId = searchParams.get("invoiceId")

  const supabase = await createClient()

  try {
    if (invoiceId) {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single()

      if (error) throw error
      return NextResponse.json(data)
    }

    if (reservationId) {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("reservation_id", reservationId)
        .order("created_at", { ascending: false })

      if (error) throw error
      return NextResponse.json(data)
    }

    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("invoice_date", { ascending: false })

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error("[invoices] fetch failed", error)
    return NextResponse.json({ error: "No se pudieron consultar las facturas" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()

  try {
    const body = await request.json()
    const reservationId = String(body?.reservation_id ?? "").trim()
    const dueDate = body?.due_date ? String(body.due_date) : null
    const notes = body?.notes ? String(body.notes) : null

    if (!reservationId) {
      return NextResponse.json({ error: "reservation_id es obligatorio" }, { status: 400 })
    }

    const { data, error } = await supabase.rpc("create_reservation_invoice", {
      p_reservation_id: reservationId,
      p_due_date: dueDate,
      p_notes: notes,
    })

    if (error) throw error

    const payload = data as { created?: boolean; invoice?: Record<string, unknown> } | null
    if (!payload?.invoice) {
      throw new Error("El RPC no devolvió una factura válida")
    }

    return NextResponse.json(payload.invoice, { status: payload.created ? 201 : 200 })
  } catch (error) {
    console.error("[invoices] atomic creation failed", error)
    const message = error instanceof Error ? error.message : "No se pudo crear la factura"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

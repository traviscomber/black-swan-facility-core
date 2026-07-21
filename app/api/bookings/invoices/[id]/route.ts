import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  try {
    const body = await request.json()
    const status = body?.status ? String(body.status) : null
    const dueDate = body?.due_date ? String(body.due_date) : null
    const notes = body?.notes === undefined ? null : String(body.notes)

    const { data, error } = await supabase.rpc("set_invoice_lifecycle", {
      p_invoice_id: params.id,
      p_status: status,
      p_due_date: dueDate,
      p_notes: notes,
    })

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error("[invoices] lifecycle update failed", error)
    const message = error instanceof Error ? error.message : "No se pudo actualizar la factura"
    return NextResponse.json({ error: message }, { status: 409 })
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase.rpc("set_invoice_lifecycle", {
      p_invoice_id: params.id,
      p_status: "void",
      p_due_date: null,
      p_notes: null,
    })

    if (error) throw error
    return NextResponse.json({ success: true, invoice: data })
  } catch (error) {
    console.error("[invoices] void failed", error)
    const message = error instanceof Error ? error.message : "No se pudo anular la factura"
    return NextResponse.json({ error: message }, { status: 409 })
  }
}

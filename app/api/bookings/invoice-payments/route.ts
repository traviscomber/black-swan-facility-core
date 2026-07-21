import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await createClient()

  try {
    const body = await request.json()
    const invoiceId = String(body?.invoice_id ?? "").trim()
    const amount = Number(body?.amount)
    const paymentMethod = String(body?.payment_method ?? "").trim()
    const transactionId = body?.transaction_id ? String(body.transaction_id) : null
    const notes = body?.notes ? String(body.notes) : null
    const paymentDate = body?.payment_date ? String(body.payment_date) : null
    const idempotencyKey = String(body?.idempotency_key ?? "").trim()

    if (!invoiceId) {
      return NextResponse.json({ error: "invoice_id es obligatorio" }, { status: 400 })
    }

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: "El monto debe ser un entero CLP positivo" }, { status: 400 })
    }

    if (!paymentMethod) {
      return NextResponse.json({ error: "payment_method es obligatorio" }, { status: 400 })
    }

    if (!idempotencyKey) {
      return NextResponse.json({ error: "idempotency_key es obligatorio" }, { status: 400 })
    }

    const { data, error } = await supabase.rpc("register_invoice_payment", {
      p_invoice_id: invoiceId,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_idempotency_key: idempotencyKey,
      p_transaction_id: transactionId,
      p_notes: notes,
      p_payment_date: paymentDate,
    })

    if (error) throw error

    const payload = data as {
      created?: boolean
      payment?: Record<string, unknown>
      invoice?: Record<string, unknown>
      balance?: number
    } | null

    if (!payload?.payment || !payload.invoice) {
      throw new Error("El RPC no devolvió un pago reconciliado válido")
    }

    return NextResponse.json(payload, { status: payload.created ? 201 : 200 })
  } catch (error) {
    console.error("[invoice-payments] atomic registration failed", error)
    const message = error instanceof Error ? error.message : "No se pudo registrar el pago"
    const status = message.includes("exceeds outstanding balance") ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

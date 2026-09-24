import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidUuid(value: string | null): value is string {
  return Boolean(value && UUID_PATTERN.test(value))
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 })

  try {
    const body = (await request.json()) as Record<string, unknown>
    const reservationId = String(body.reservation_id ?? "").trim()
    const amount = Number(body.amount)
    const paymentMethod = String(body.payment_method ?? "").trim()
    const transactionId = body.transaction_id ? String(body.transaction_id).trim() : null
    const notes = body.notes ? String(body.notes).trim() : null

    if (!isValidUuid(reservationId)) return NextResponse.json({ error: "reservation_id inválido" }, { status: 400 })
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Monto inválido" }, { status: 400 })
    if (!paymentMethod) return NextResponse.json({ error: "Método de pago requerido" }, { status: 400 })
    if (transactionId && transactionId.length > 200) return NextResponse.json({ error: "Referencia de pago demasiado larga" }, { status: 400 })
    if (notes && notes.length > 1000) return NextResponse.json({ error: "Las observaciones no pueden superar 1.000 caracteres" }, { status: 400 })

    const { data, error } = await supabase.rpc("record_reservation_payment", {
      p_reservation_id: reservationId,
      p_amount: Math.round(amount),
      p_payment_method: paymentMethod,
      p_transaction_id: transactionId,
      p_notes: notes,
    })

    if (error) throw error
    return NextResponse.json(data ?? { success: true }, { status: 201 })
  } catch (error) {
    console.error("[booking-payments] record failed", error)
    const message = error instanceof Error ? error.message : "No se pudo registrar el pago"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

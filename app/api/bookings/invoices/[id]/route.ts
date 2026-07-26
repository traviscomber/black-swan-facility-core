import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { roundClp } from "@/lib/money"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ALLOWED_STATUSES = new Set(["draft", "sent", "paid", "cancelled"])
const ALLOWED_PAYMENT_STATUSES = new Set(["pending", "partial", "paid", "overdue"])
const FINANCE_ROLES = new Set(["admin", "approver"])

type RouteContext = { params: Promise<{ id: string }> | { id: string } }
type LineItem = { description?: unknown; qty?: unknown; quantity?: unknown; unit_price?: unknown }

function isValidDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function optionalText(value: unknown, maxLength: number) {
  if (value === null || value === undefined || value === "") return null
  const text = String(value).trim()
  if (text.length > maxLength) throw new Error(`El texto no puede superar ${maxLength.toLocaleString("es-CL")} caracteres`)
  return text || null
}

function numberInRange(value: unknown, min: number, max: number, label: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new Error(`${label} inválido`)
  return parsed
}

async function getRequestContext(context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  return { invoiceId: id, supabase, user: error ? null : user }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { invoiceId, supabase, user } = await getRequestContext(context)
  if (!user) return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 })
  if (!UUID_PATTERN.test(invoiceId)) return NextResponse.json({ error: "ID de factura inválido" }, { status: 400 })
  if (!FINANCE_ROLES.has(String(user.app_metadata?.procurement_role ?? ""))) {
    return NextResponse.json({ error: "Se requiere rol administrador o aprobador" }, { status: 403 })
  }

  try {
    const body = (await request.json()) as Record<string, unknown>
    const customerName = String(body.customer_name ?? "").trim()
    if (!customerName || customerName.length > 200) throw new Error("El nombre o razón social es obligatorio y no puede superar 200 caracteres")

    const invoiceDate = String(body.invoice_date ?? "")
    const dueDate = String(body.due_date ?? "")
    if (!isValidDate(invoiceDate) || !isValidDate(dueDate)) throw new Error("Las fechas deben usar formato YYYY-MM-DD")
    if (dueDate < invoiceDate) throw new Error("La fecha de vencimiento no puede ser anterior a la emisión")

    const status = String(body.status ?? "draft")
    const paymentStatus = String(body.payment_status ?? "pending")
    if (!ALLOWED_STATUSES.has(status)) throw new Error("Estado de factura inválido")
    if (!ALLOWED_PAYMENT_STATUSES.has(paymentStatus)) throw new Error("Estado de pago inválido")

    if (!Array.isArray(body.line_items) || body.line_items.length === 0 || body.line_items.length > 100) {
      throw new Error("La factura debe contener entre 1 y 100 ítems")
    }

    const lineItems = (body.line_items as LineItem[]).map((item, index) => {
      const description = String(item.description ?? "").trim()
      if (!description || description.length > 500) throw new Error(`Descripción inválida en ítem ${index + 1}`)
      const qty = numberInRange(item.qty ?? item.quantity, 0.001, 100000, `Cantidad del ítem ${index + 1}`)
      const unitPrice = roundClp(numberInRange(item.unit_price, 0, Number.MAX_SAFE_INTEGER, `Valor unitario del ítem ${index + 1}`))
      return { ...item, description, qty, quantity: qty, unit_price: unitPrice }
    })

    const calculatedSubtotal = roundClp(
      lineItems.reduce((total, item) => total + Number(item.qty) * Number(item.unit_price), 0),
    )
    const discountPercentage = numberInRange(body.discount_percentage ?? 0, 0, 100, "Porcentaje de descuento")
    const requestedDiscount = roundClp(numberInRange(body.discount_amount ?? 0, 0, calculatedSubtotal, "Descuento"))
    const discountAmount = discountPercentage > 0 ? roundClp((calculatedSubtotal * discountPercentage) / 100) : requestedDiscount
    const taxRate = numberInRange(body.tax_rate ?? 0, 0, 100, "Tasa de impuesto")
    const taxableBase = Math.max(0, calculatedSubtotal - discountAmount)
    const taxAmount = roundClp((taxableBase * taxRate) / 100)
    const additionalFees = roundClp(numberInRange(body.additional_fees ?? 0, 0, Number.MAX_SAFE_INTEGER, "Cargos adicionales"))
    const totalAmount = roundClp(taxableBase + taxAmount + additionalFees)

    const { data, error } = await supabase
      .from("invoices")
      .update({
        customer_name: customerName,
        customer_email: optionalText(body.customer_email, 320),
        customer_phone: optionalText(body.customer_phone, 80),
        customer_address: optionalText(body.customer_address, 1000),
        invoice_date: invoiceDate,
        due_date: dueDate,
        status,
        payment_status: paymentStatus,
        line_items: lineItems,
        subtotal: calculatedSubtotal,
        discount_amount: discountAmount,
        discount_percentage: discountPercentage,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        additional_fees: additionalFees,
        total_amount: totalAmount,
        notes: optionalText(body.notes, 2000),
        terms_conditions: optionalText(body.terms_conditions, 4000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    console.error("[invoices] update failed", error)
    const message = error instanceof Error ? error.message : "No se pudo actualizar la factura"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { invoiceId, supabase, user } = await getRequestContext(context)
  if (!user) return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 })
  if (!UUID_PATTERN.test(invoiceId)) return NextResponse.json({ error: "ID de factura inválido" }, { status: 400 })
  if (user.app_metadata?.procurement_role !== "admin") {
    return NextResponse.json({ error: "Se requiere rol administrador" }, { status: 403 })
  }

  try {
    const { count, error: paymentError } = await supabase
      .from("invoice_payments")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", invoiceId)

    if (paymentError) throw paymentError
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: "No se puede eliminar una factura con pagos registrados; anúlala en su lugar" }, { status: 409 })
    }

    const { data, error } = await supabase.from("invoices").delete().eq("id", invoiceId).select("id").maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[invoices] delete failed", error)
    return NextResponse.json({ error: "No se pudo eliminar la factura" }, { status: 500 })
  }
}

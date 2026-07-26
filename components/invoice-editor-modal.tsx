"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, FileText, Loader2, Plus, Printer, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatClp, roundClp } from "@/lib/money"

type InvoiceLineItem = {
  description: string
  qty: number
  unit_price: number
}

type InvoiceRecord = {
  id: string
  reservation_id?: string | null
  invoice_number?: string | null
  invoice_date?: string | null
  due_date?: string | null
  status?: string | null
  customer_name?: string | null
  customer_email?: string | null
  customer_phone?: string | null
  customer_address?: string | null
  line_items?: InvoiceLineItem[] | null
  discount_amount?: number | null
  discount_percentage?: number | null
  tax_rate?: number | null
  additional_fees?: number | null
  payment_status?: string | null
  notes?: string | null
  terms_conditions?: string | null
}

type InvoicePreview = {
  eligible: boolean
  blockers: string[]
  existing_invoice?: { id: string; invoice_number: string; status: string; total_amount: number } | null
  reservation: {
    id: string
    status: string | null
    check_in: string
    check_out: string
    nights: number
    room_number: string | null
  }
  customer: {
    name: string
    email: string | null
    phone: string | null
    address: string | null
  }
  currency: "CLP"
  line_items: Array<InvoiceLineItem & { tax_amount?: number }>
  subtotal: number
  tax_amount: number
  total_amount: number
}

interface InvoiceEditorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice?: InvoiceRecord | null
  invoiceId?: string
  reservationId?: string
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  onSave?: () => void
}

const EMPTY_ITEM: InvoiceLineItem = { description: "", qty: 1, unit_price: 0 }

function todayInChile() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function formatChileDate(value?: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`))
}

export function InvoiceEditorModal({
  open,
  onOpenChange,
  invoice,
  invoiceId,
  reservationId,
  guestName = "",
  guestEmail = "",
  guestPhone = "",
  onSave,
}: InvoiceEditorModalProps) {
  const effectiveInvoiceId = invoice?.id ?? invoiceId
  const today = useMemo(() => todayInChile(), [])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<InvoicePreview | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoice_number ?? "")
  const [formData, setFormData] = useState({
    customer_name: invoice?.customer_name ?? guestName,
    customer_email: invoice?.customer_email ?? guestEmail,
    customer_phone: invoice?.customer_phone ?? guestPhone,
    customer_address: invoice?.customer_address ?? "",
    invoice_date: invoice?.invoice_date ?? today,
    due_date: invoice?.due_date ?? addDays(today, 30),
    status: invoice?.status ?? "draft",
    payment_status: invoice?.payment_status ?? "pending",
    discount_amount: Number(invoice?.discount_amount ?? 0),
    discount_percentage: Number(invoice?.discount_percentage ?? 0),
    tax_rate: Number(invoice?.tax_rate ?? 0),
    additional_fees: Number(invoice?.additional_fees ?? 0),
    notes: invoice?.notes ?? "",
    terms_conditions: invoice?.terms_conditions ?? "",
  })
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(invoice?.line_items?.length ? invoice.line_items : [EMPTY_ITEM])

  useEffect(() => {
    if (!open) return

    let cancelled = false

    async function loadData() {
      setLoading(true)
      setError(null)
      setPreview(null)

      try {
        if (effectiveInvoiceId) {
          const response = await fetch(`/api/bookings/invoices?invoiceId=${encodeURIComponent(effectiveInvoiceId)}`)
          const data = (await response.json()) as InvoiceRecord & { error?: string }
          if (!response.ok) throw new Error(data.error ?? "No se pudo cargar la factura")
          if (cancelled) return

          setInvoiceNumber(data.invoice_number ?? "")
          setFormData({
            customer_name: data.customer_name ?? "",
            customer_email: data.customer_email ?? "",
            customer_phone: data.customer_phone ?? "",
            customer_address: data.customer_address ?? "",
            invoice_date: data.invoice_date ?? today,
            due_date: data.due_date ?? addDays(today, 30),
            status: data.status ?? "draft",
            payment_status: data.payment_status ?? "pending",
            discount_amount: Number(data.discount_amount ?? 0),
            discount_percentage: Number(data.discount_percentage ?? 0),
            tax_rate: Number(data.tax_rate ?? 0),
            additional_fees: Number(data.additional_fees ?? 0),
            notes: data.notes ?? "",
            terms_conditions: data.terms_conditions ?? "",
          })
          setLineItems(data.line_items?.length ? data.line_items : [EMPTY_ITEM])
          return
        }

        setInvoiceNumber("")
        setFormData({
          customer_name: guestName,
          customer_email: guestEmail,
          customer_phone: guestPhone,
          customer_address: "",
          invoice_date: today,
          due_date: addDays(today, 7),
          status: "draft",
          payment_status: "pending",
          discount_amount: 0,
          discount_percentage: 0,
          tax_rate: 0,
          additional_fees: 0,
          notes: "",
          terms_conditions: "",
        })
        setLineItems([EMPTY_ITEM])

        if (!reservationId) {
          throw new Error("Las facturas nuevas deben abrirse desde una reserva")
        }

        const response = await fetch(`/api/bookings/invoices/preview?reservationId=${encodeURIComponent(reservationId)}`)
        const data = (await response.json()) as InvoicePreview & { error?: string }
        if (!response.ok) throw new Error(data.error ?? "No se pudo validar la factura")
        if (cancelled) return

        setPreview(data)
        setFormData((current) => ({
          ...current,
          customer_name: data.customer.name ?? "",
          customer_email: data.customer.email ?? "",
          customer_phone: data.customer.phone ?? "",
          customer_address: data.customer.address ?? "",
          tax_rate: 0,
        }))
        setLineItems(data.line_items.map((item) => ({
          description: item.description,
          qty: Number(item.qty),
          unit_price: roundClp(Number(item.unit_price)),
        })))
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la factura")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadData()
    return () => {
      cancelled = true
    }
  }, [effectiveInvoiceId, guestEmail, guestName, guestPhone, open, reservationId, today])

  const subtotal = useMemo(
    () => roundClp(lineItems.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.unit_price || 0), 0)),
    [lineItems],
  )
  const discountAmount = roundClp(
    formData.discount_percentage > 0
      ? (subtotal * formData.discount_percentage) / 100
      : formData.discount_amount,
  )
  const taxableBase = Math.max(0, subtotal - discountAmount)
  const taxAmount = effectiveInvoiceId
    ? roundClp((taxableBase * formData.tax_rate) / 100)
    : roundClp(preview?.tax_amount ?? 0)
  const total = effectiveInvoiceId
    ? roundClp(taxableBase + taxAmount + formData.additional_fees)
    : roundClp(preview?.total_amount ?? taxableBase + taxAmount)
  const isPreflightBlocked = !effectiveInvoiceId && (!preview || !preview.eligible)

  function updateField<K extends keyof typeof formData>(field: K, value: (typeof formData)[K]) {
    setFormData((current) => ({ ...current, [field]: value }))
  }

  function updateLineItem(index: number, field: keyof InvoiceLineItem, value: string | number) {
    setLineItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    )
  }

  async function saveInvoice() {
    if (!formData.customer_name.trim()) {
      setError("El nombre o razón social del cliente es obligatorio")
      return
    }
    if (!lineItems.some((item) => item.description.trim() && item.qty > 0)) {
      setError("Agrega al menos un ítem válido")
      return
    }
    if (isPreflightBlocked) {
      setError(preview?.blockers[0] ?? "La reserva no está lista para facturación")
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (!effectiveInvoiceId) {
        if (!reservationId) {
          throw new Error("Las facturas nuevas deben generarse desde una reserva para mantener trazabilidad")
        }
        const response = await fetch("/api/bookings/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservation_id: reservationId, due_date: formData.due_date, notes: formData.notes }),
        })
        const result = (await response.json()) as { error?: string }
        if (!response.ok) throw new Error(result.error ?? "No se pudo generar la factura")
      } else {
        const response = await fetch(`/api/bookings/invoices/${effectiveInvoiceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_name: formData.customer_name.trim(),
            customer_email: formData.customer_email.trim() || null,
            customer_phone: formData.customer_phone.trim() || null,
            customer_address: formData.customer_address.trim() || null,
            invoice_date: formData.invoice_date,
            due_date: formData.due_date,
            status: formData.status,
            payment_status: formData.payment_status,
            line_items: lineItems.map((item) => ({
              description: item.description.trim(),
              qty: Number(item.qty),
              unit_price: roundClp(Number(item.unit_price)),
            })),
            subtotal,
            discount_amount: discountAmount,
            discount_percentage: formData.discount_percentage,
            tax_rate: formData.tax_rate,
            tax_amount: taxAmount,
            additional_fees: roundClp(formData.additional_fees),
            total_amount: total,
            notes: formData.notes.trim() || null,
            terms_conditions: formData.terms_conditions.trim() || null,
          }),
        })
        const result = (await response.json()) as { error?: string }
        if (!response.ok) throw new Error(result.error ?? "No se pudo guardar la factura")
      }

      toast.success(effectiveInvoiceId ? "Factura guardada" : "Factura generada desde la reserva")
      onSave?.()
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la factura")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[96vh] w-[96vw] max-w-6xl overflow-y-auto p-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/blackswan-logo.png" alt="Black Swan" className="h-11 w-11 shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">Black Swan · Fundo Corcovado</p>
              <p className="text-xs text-muted-foreground">Factura interna · Valdivia, Chile</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="hidden sm:inline-flex">
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
            <DialogClose aria-label="Cerrar" />
          </div>
        </header>

        {loading ? (
          <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-6 p-4 sm:p-6">
            <section className="grid gap-4 rounded-xl border bg-muted/20 p-4 md:grid-cols-[1fr_auto]">
              <div>
                <div className="flex items-center gap-2"><FileText className="h-5 w-5" /><h2 className="text-xl font-semibold">Factura {invoiceNumber || "por generar"}</h2></div>
                <p className="mt-1 text-sm text-muted-foreground">Documento de gestión interna. La validez tributaria depende de la emisión en el sistema autorizado correspondiente.</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:text-right">
                <dt className="text-muted-foreground">Emisión</dt><dd>{formatChileDate(formData.invoice_date)}</dd>
                <dt className="text-muted-foreground">Vencimiento</dt><dd>{formatChileDate(formData.due_date)}</dd>
              </dl>
            </section>

            {!effectiveInvoiceId && preview && (
              <section className={`rounded-xl border p-4 text-sm ${preview.eligible ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/50 bg-amber-500/5"}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium">Prevalidación de reserva</p>
                    {preview.eligible ? (
                      <p>Reserva apta para facturar: {preview.reservation.nights} noches, {preview.reservation.room_number ?? "sin habitación asignada"}, total previsto {formatClp(preview.total_amount)}.</p>
                    ) : (
                      <ul className="space-y-1 text-muted-foreground">{preview.blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}</ul>
                    )}
                  </div>
                </div>
              </section>
            )}

            {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4 rounded-xl border p-4">
                <h3 className="font-semibold">Cliente</h3>
                <div><label className="mb-1 block text-xs text-muted-foreground">Nombre o razón social *</label><Input value={formData.customer_name} onChange={(event) => updateField("customer_name", event.target.value)} placeholder="Nombre del cliente" readOnly={!effectiveInvoiceId} /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="mb-1 block text-xs text-muted-foreground">Correo</label><Input type="email" value={formData.customer_email} onChange={(event) => updateField("customer_email", event.target.value)} placeholder="cliente@correo.cl" readOnly={!effectiveInvoiceId} /></div>
                  <div><label className="mb-1 block text-xs text-muted-foreground">Teléfono</label><Input value={formData.customer_phone} onChange={(event) => updateField("customer_phone", event.target.value)} placeholder="+56 9 1234 5678" readOnly={!effectiveInvoiceId} /></div>
                </div>
                <div><label className="mb-1 block text-xs text-muted-foreground">Dirección</label><textarea value={formData.customer_address} onChange={(event) => updateField("customer_address", event.target.value)} placeholder="Dirección, comuna y región" rows={3} readOnly={!effectiveInvoiceId} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></div>
              </div>

              <div className="space-y-4 rounded-xl border p-4">
                <h3 className="font-semibold">Emisión y estado</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="mb-1 block text-xs text-muted-foreground">Fecha de emisión</label><Input type="date" value={formData.invoice_date} onChange={(event) => updateField("invoice_date", event.target.value)} readOnly={!effectiveInvoiceId} /></div>
                  <div><label className="mb-1 block text-xs text-muted-foreground">Fecha de vencimiento</label><Input type="date" value={formData.due_date} onChange={(event) => updateField("due_date", event.target.value)} /></div>
                  <div><label className="mb-1 block text-xs text-muted-foreground">Estado del documento</label><select value={formData.status} onChange={(event) => updateField("status", event.target.value)} disabled={!effectiveInvoiceId} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="draft">Borrador</option><option value="sent">Emitida</option><option value="paid">Pagada</option><option value="cancelled">Anulada</option></select></div>
                  <div><label className="mb-1 block text-xs text-muted-foreground">Estado de pago</label><select value={formData.payment_status} onChange={(event) => updateField("payment_status", event.target.value)} disabled={!effectiveInvoiceId} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="pending">Pendiente</option><option value="partial">Pago parcial</option><option value="paid">Pagada</option><option value="overdue">Vencida</option></select></div>
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between"><div><h3 className="font-semibold">Detalle</h3>{!effectiveInvoiceId && <p className="text-xs text-muted-foreground">Calculado desde alojamiento y extras registrados en la reserva.</p>}</div>{effectiveInvoiceId && <Button type="button" variant="outline" size="sm" onClick={() => setLineItems((current) => [...current, { ...EMPTY_ITEM }])}><Plus className="mr-2 h-4 w-4" />Agregar ítem</Button>}</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead><tr className="border-b text-left"><th className="p-2">Descripción</th><th className="w-24 p-2 text-right">Cantidad</th><th className="w-40 p-2 text-right">Valor unitario</th><th className="w-40 p-2 text-right">Total</th>{effectiveInvoiceId && <th className="w-12 p-2" />}</tr></thead>
                  <tbody>{lineItems.map((item, index) => <tr key={index} className="border-b last:border-0"><td className="p-2"><Input value={item.description} onChange={(event) => updateLineItem(index, "description", event.target.value)} placeholder="Alojamiento, servicio o extra" readOnly={!effectiveInvoiceId} /></td><td className="p-2"><Input type="number" min="1" step="1" value={item.qty} onChange={(event) => updateLineItem(index, "qty", Math.max(1, Number(event.target.value) || 1))} className="text-right" readOnly={!effectiveInvoiceId} /></td><td className="p-2"><Input type="number" min="0" step="1" value={item.unit_price} onChange={(event) => updateLineItem(index, "unit_price", Math.max(0, Number(event.target.value) || 0))} className="text-right" readOnly={!effectiveInvoiceId} /></td><td className="p-2 text-right font-medium">{formatClp(item.qty * item.unit_price)}</td>{effectiveInvoiceId && <td className="p-2"><Button type="button" size="icon" variant="ghost" disabled={lineItems.length === 1} onClick={() => setLineItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Eliminar ítem"><Trash2 className="h-4 w-4" /></Button></td>}</tr>)}</tbody>
                </table>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="space-y-4 rounded-xl border p-4">
                <h3 className="font-semibold">Observaciones y condiciones</h3>
                <div><label className="mb-1 block text-xs text-muted-foreground">Observaciones</label><textarea value={formData.notes} onChange={(event) => updateField("notes", event.target.value)} rows={3} className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Información adicional para el cliente" /></div>
                <div><label className="mb-1 block text-xs text-muted-foreground">Términos y condiciones</label><textarea value={formData.terms_conditions} onChange={(event) => updateField("terms_conditions", event.target.value)} rows={3} readOnly={!effectiveInvoiceId} className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Plazo de pago, medios aceptados u otras condiciones" /></div>
              </div>

              <div className="space-y-4 rounded-xl border p-4">
                <h3 className="font-semibold">Totales en CLP</h3>
                {effectiveInvoiceId && <div className="grid grid-cols-2 gap-3">
                  <div><label className="mb-1 block text-xs text-muted-foreground">Descuento (%)</label><Input type="number" min="0" max="100" step="1" value={formData.discount_percentage} onChange={(event) => updateField("discount_percentage", Math.min(100, Math.max(0, Number(event.target.value) || 0)))} /></div>
                  <div><label className="mb-1 block text-xs text-muted-foreground">Descuento ($)</label><Input type="number" min="0" step="1" value={formData.discount_amount} onChange={(event) => updateField("discount_amount", Math.max(0, Number(event.target.value) || 0))} disabled={formData.discount_percentage > 0} /></div>
                  <div><label className="mb-1 block text-xs text-muted-foreground">IVA / impuesto (%)</label><Input type="number" min="0" max="100" step="1" value={formData.tax_rate} onChange={(event) => updateField("tax_rate", Math.min(100, Math.max(0, Number(event.target.value) || 0)))} /></div>
                  <div><label className="mb-1 block text-xs text-muted-foreground">Cargos adicionales ($)</label><Input type="number" min="0" step="1" value={formData.additional_fees} onChange={(event) => updateField("additional_fees", Math.max(0, Number(event.target.value) || 0))} /></div>
                </div>}
                <dl className="space-y-2 border-t pt-4 text-sm"><div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatClp(effectiveInvoiceId ? subtotal : preview?.subtotal ?? subtotal)}</dd></div>{discountAmount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Descuento</dt><dd>-{formatClp(discountAmount)}</dd></div>}{taxAmount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">IVA / impuesto</dt><dd>{formatClp(taxAmount)}</dd></div>}{formData.additional_fees > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Cargos adicionales</dt><dd>{formatClp(formData.additional_fees)}</dd></div>}<div className="flex justify-between border-t pt-3 text-lg font-semibold"><dt>Total</dt><dd>{formatClp(total)}</dd></div></dl>
              </div>
            </section>
          </div>
        )}

        <footer className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:flex-row sm:justify-end sm:px-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={() => void saveInvoice()} disabled={saving || loading || isPreflightBlocked}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{effectiveInvoiceId ? "Guardar cambios" : "Generar factura desde reserva"}</Button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}

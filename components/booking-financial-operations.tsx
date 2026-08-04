"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BadgeDollarSign, RefreshCw, Save, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

type Reservation = { id: string; guest_name: string; check_in: string; check_out: string }
type Extra = { id: string; name: string; category: string | null; unit: string; price: number; tax_rate: number; service_kind: string; requires_scheduling: boolean; default_duration_minutes: number | null; is_active: boolean }
type Readiness = { openServices: number; balance: number; paymentStatus: string; canFinalizeInvoice: boolean; canCheckout: boolean }

const money = (value: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value)

export function BookingFinancialOperations() {
  const supabase = useMemo(() => createClient(), [])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [extras, setExtras] = useState<Extra[]>([])
  const [reservationId, setReservationId] = useState("")
  const [readiness, setReadiness] = useState<Readiness | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [unit, setUnit] = useState("unidad")
  const [price, setPrice] = useState("")
  const [taxRate, setTaxRate] = useState("0")
  const [kind, setKind] = useState("charge")
  const [requiresScheduling, setRequiresScheduling] = useState(false)
  const [duration, setDuration] = useState("")

  const load = useCallback(async () => {
    const [{ data: auth }, reservationsResult, extrasResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("reservations").select("id, guest_name, check_in, check_out").not("status", "in", "(cancelled,canceled,void,voided,no_show)").order("check_in"),
      supabase.from("booking_extras").select("id,name,category,unit,price,tax_rate,service_kind,requires_scheduling,default_duration_minutes,is_active").order("name"),
    ])
    const error = reservationsResult.error || extrasResult.error
    if (error) return toast.error(error.message)
    setIsAdmin(String(auth.user?.app_metadata?.procurement_role ?? "") === "admin")
    setReservations((reservationsResult.data ?? []) as Reservation[])
    setExtras((extrasResult.data ?? []) as Extra[])
  }, [supabase])

  const loadReadiness = useCallback(async (id: string) => {
    if (!id) return setReadiness(null)
    const { data, error } = await supabase.rpc("get_booking_financial_readiness", { p_reservation_id: id })
    if (error) return toast.error(error.message)
    setReadiness(data as Readiness)
  }, [supabase])

  useEffect(() => { void load() }, [load])
  useEffect(() => { void loadReadiness(reservationId) }, [loadReadiness, reservationId])

  async function saveCatalogItem() {
    if (!name.trim()) return toast.error("Indica el nombre del servicio")
    if (Number(price) < 0 || !Number.isInteger(Number(price))) return toast.error("El precio CLP debe ser entero")
    if (requiresScheduling && Number(duration) <= 0) return toast.error("Indica la duración del servicio")
    setSaving(true)
    const { error } = await supabase.rpc("upsert_booking_extra", {
      p_extra_id: null,
      p_name: name.trim(), p_category: category.trim() || null, p_unit: unit.trim() || "unidad",
      p_price: Number(price), p_tax_rate: Number(taxRate), p_service_kind: kind,
      p_requires_scheduling: requiresScheduling,
      p_default_duration_minutes: requiresScheduling ? Number(duration) : null,
      p_capacity: null, p_location_id: null, p_department: null, p_operational_notes: null, p_is_active: true,
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success("Servicio creado en el catálogo")
    setName(""); setCategory(""); setPrice(""); setTaxRate("0"); setDuration(""); setRequiresScheduling(false)
    await load()
  }

  return (
    <Card className="mx-4 mb-4">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base"><BadgeDollarSign className="h-4 w-4" /> Operación financiera</CardTitle>
          <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>Validar cierre de una estadía</Label>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={reservationId} onChange={(e) => setReservationId(e.target.value)}>
            <option value="">Seleccionar reserva</option>
            {reservations.map((r) => <option key={r.id} value={r.id}>{r.guest_name} · {r.check_in} → {r.check_out}</option>)}
          </select>
        </div>

        {readiness && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Servicios abiertos</p><p className="mt-1 text-lg font-semibold">{readiness.openServices}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Saldo pendiente</p><p className="mt-1 text-lg font-semibold">{money(readiness.balance)}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Factura final</p><Badge className="mt-2" variant={readiness.canFinalizeInvoice ? "secondary" : "destructive"}>{readiness.canFinalizeInvoice ? "Habilitada" : "Bloqueada"}</Badge></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Check-out financiero</p><Badge className="mt-2" variant={readiness.canCheckout ? "secondary" : "destructive"}>{readiness.canCheckout ? "Habilitado" : "Bloqueado"}</Badge></div>
        </div>}

        <div className="rounded-lg border p-4">
          <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-medium">Catálogo de servicios</h3><p className="text-sm text-muted-foreground">{extras.length} servicios registrados. Los precios no se inventan: administración los define aquí.</p></div><ShieldCheck className="h-5 w-5 text-muted-foreground" /></div>
          {!isAdmin ? <p className="text-sm text-muted-foreground">Solo administración puede crear o modificar servicios y precios.</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5"><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Categoría</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Unidad</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Precio CLP</Label><Input type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>IVA / impuesto %</Label><Input type="number" min="0" max="100" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Tipo</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}><option value="charge">Cargo</option><option value="scheduled_service">Servicio programado</option><option value="activity">Actividad</option><option value="transport">Transporte</option><option value="food_beverage">Alimentos y bebidas</option><option value="amenity">Amenity</option></select></div>
            <label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={requiresScheduling} onChange={(e) => setRequiresScheduling(e.target.checked)} /> Requiere programación</label>
            <div className="space-y-1.5"><Label>Duración (min)</Label><Input type="number" min="1" disabled={!requiresScheduling} value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
            <div className="flex justify-end xl:col-span-4"><Button onClick={() => void saveCatalogItem()} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Guardando…" : "Crear servicio"}</Button></div>
          </div>}
        </div>
      </CardContent>
    </Card>
  )
}

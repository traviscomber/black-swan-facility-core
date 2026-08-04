"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BadgeDollarSign, Copy, Pencil, Plus, RefreshCw, Save, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

type Reservation = { id: string; guest_name: string; check_in: string; check_out: string }
type Extra = {
  id: string
  name: string
  category: string | null
  unit: string
  price: number
  tax_rate: number
  service_kind: string
  requires_scheduling: boolean
  default_duration_minutes: number | null
  capacity: number | null
  department: string | null
  operational_notes: string | null
  is_active: boolean
}
type Readiness = { openServices: number; balance: number; paymentStatus: string; canFinalizeInvoice: boolean; canCheckout: boolean }

const money = (value: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value)
const UNIT_LABELS: Record<string, string> = { unit: "Unidad", night: "Noche", person: "Persona", person_night: "Persona/noche", stay: "Estadía" }
const KIND_LABELS: Record<string, string> = { charge: "Cargo", scheduled_service: "Servicio programado", activity: "Actividad", transport: "Transporte", food_beverage: "Alimentos y bebidas", amenity: "Amenity" }

export function BookingFinancialOperations() {
  const supabase = useMemo(() => createClient(), [])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [extras, setExtras] = useState<Extra[]>([])
  const [reservationId, setReservationId] = useState("")
  const [readiness, setReadiness] = useState<Readiness | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [unit, setUnit] = useState("unit")
  const [price, setPrice] = useState("")
  const [taxRate, setTaxRate] = useState("0")
  const [kind, setKind] = useState("charge")
  const [requiresScheduling, setRequiresScheduling] = useState(false)
  const [duration, setDuration] = useState("")
  const [capacity, setCapacity] = useState("")
  const [department, setDepartment] = useState("")
  const [operationalNotes, setOperationalNotes] = useState("")
  const [isActive, setIsActive] = useState(true)

  const load = useCallback(async () => {
    const [{ data: auth }, reservationsResult, extrasResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("reservations").select("id, guest_name, check_in, check_out").not("status", "in", "(cancelled,canceled,void,voided,no_show)").order("check_in"),
      supabase.from("booking_extras").select("id,name,category,unit,price,tax_rate,service_kind,requires_scheduling,default_duration_minutes,capacity,department,operational_notes,is_active").order("category").order("name"),
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

  function clearForm() {
    setSelectedId(null); setName(""); setCategory(""); setUnit("unit"); setPrice(""); setTaxRate("0")
    setKind("charge"); setRequiresScheduling(false); setDuration(""); setCapacity(""); setDepartment("")
    setOperationalNotes("Precio referencial final CLP. Ajustable por administración."); setIsActive(true)
  }

  function editItem(item: Extra) {
    setSelectedId(item.id); setName(item.name); setCategory(item.category ?? ""); setUnit(item.unit)
    setPrice(String(Number(item.price))); setTaxRate(String(Number(item.tax_rate))); setKind(item.service_kind)
    setRequiresScheduling(item.requires_scheduling); setDuration(item.default_duration_minutes ? String(item.default_duration_minutes) : "")
    setCapacity(item.capacity ? String(item.capacity) : ""); setDepartment(item.department ?? "")
    setOperationalNotes(item.operational_notes ?? ""); setIsActive(item.is_active)
  }

  function duplicateItem(item: Extra) {
    editItem(item); setSelectedId(null); setName(`${item.name} copia`)
  }

  async function saveCatalogItem() {
    if (!name.trim()) return toast.error("Indica el nombre del servicio")
    if (Number(price) < 0 || !Number.isInteger(Number(price))) return toast.error("El precio CLP debe ser entero")
    if (requiresScheduling && Number(duration) <= 0) return toast.error("Indica la duración del servicio")
    setSaving(true)
    const { error } = await supabase.rpc("upsert_booking_extra", {
      p_extra_id: selectedId,
      p_name: name.trim(), p_category: category.trim() || null, p_unit: unit,
      p_price: Number(price), p_tax_rate: Number(taxRate), p_service_kind: kind,
      p_requires_scheduling: requiresScheduling,
      p_default_duration_minutes: requiresScheduling ? Number(duration) : null,
      p_capacity: capacity ? Number(capacity) : null, p_location_id: null,
      p_department: department.trim() || null,
      p_operational_notes: operationalNotes.trim() || null,
      p_is_active: isActive,
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success(selectedId ? "Servicio actualizado" : "Servicio creado")
    clearForm()
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="font-medium">Catálogo de servicios</h3><p className="text-sm text-muted-foreground">{extras.length} servicios. Precios referenciales editables, activables y duplicables.</p></div>
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-muted-foreground" />{isAdmin && <Button variant="outline" size="sm" onClick={clearForm}><Plus className="mr-2 h-4 w-4" />Nuevo</Button>}</div>
          </div>

          <div className="mb-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {extras.map((item) => <div key={item.id} className={`rounded-md border p-3 ${selectedId === item.id ? "ring-2 ring-ring" : ""}`}>
              <div className="flex items-start justify-between gap-3"><div><div className="font-medium">{item.name}</div><div className="text-xs text-muted-foreground">{item.category || "Sin categoría"} · {UNIT_LABELS[item.unit] ?? item.unit}</div></div><Badge variant={item.is_active ? "secondary" : "outline"}>{item.is_active ? "Activo" : "Inactivo"}</Badge></div>
              <div className="mt-2 flex items-center justify-between gap-3"><strong>{money(Number(item.price))}</strong><span className="text-xs text-muted-foreground">{KIND_LABELS[item.service_kind] ?? item.service_kind}</span></div>
              {isAdmin && <div className="mt-3 flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => duplicateItem(item)}><Copy className="mr-1 h-3.5 w-3.5" />Duplicar</Button><Button variant="outline" size="sm" onClick={() => editItem(item)}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button></div>}
            </div>)}
          </div>

          {!isAdmin ? <p className="text-sm text-muted-foreground">Solo administración puede crear o modificar servicios y precios.</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5"><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Categoría</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Unidad</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={unit} onChange={(e) => setUnit(e.target.value)}>{Object.entries(UNIT_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className="space-y-1.5"><Label>Precio CLP</Label><Input type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>IVA / impuesto %</Label><Input type="number" min="0" max="100" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Tipo</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>{Object.entries(KIND_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className="space-y-1.5"><Label>Departamento</Label><Input value={department} onChange={(e) => setDepartment(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Capacidad</Label><Input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
            <label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={requiresScheduling} onChange={(e) => setRequiresScheduling(e.target.checked)} /> Requiere programación</label>
            <div className="space-y-1.5"><Label>Duración (min)</Label><Input type="number" min="1" disabled={!requiresScheduling} value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
            <label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Servicio activo</label>
            <div className="space-y-1.5 xl:col-span-2"><Label>Notas operativas</Label><Input value={operationalNotes} onChange={(e) => setOperationalNotes(e.target.value)} /></div>
            <div className="flex justify-end xl:col-span-4"><Button onClick={() => void saveCatalogItem()} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Guardando…" : selectedId ? "Guardar cambios" : "Crear servicio"}</Button></div>
          </div>}
        </div>
      </CardContent>
    </Card>
  )
}

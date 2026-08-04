"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, ClipboardCheck, RefreshCw, ShieldAlert, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

type Arrival = {
  id: string
  guest_name: string
  guest_email: string | null
  guest_phone: string | null
  num_guests: number | null
  check_in: string
  estimated_arrival_time: string | null
  payment_status: string | null
  special_requests: string | null
  arrival_status: string
  room: { id: string; room_number: string; operational_status: string; location: { name: string } | null } | null
}

type Checklist = {
  identity: boolean
  contact: boolean
  guests: boolean
  payment: boolean
  terms: boolean
  access: boolean
  requests: boolean
}

const INITIAL: Checklist = { identity: false, contact: false, guests: false, payment: false, terms: false, access: false, requests: false }
const ITEMS: Array<{ key: keyof Checklist; label: string; help: string }> = [
  { key: "identity", label: "Identidad verificada", help: "Documento o validación equivalente." },
  { key: "contact", label: "Datos de contacto confirmados", help: "Correo y/o teléfono revisados." },
  { key: "guests", label: "Cantidad de huéspedes confirmada", help: "Coincide con ocupación real y capacidad." },
  { key: "payment", label: "Pago o garantía verificada", help: "Existe respaldo para la estadía." },
  { key: "terms", label: "Condiciones aceptadas", help: "Registro o aceptación disponible." },
  { key: "access", label: "Llaves o accesos entregados", help: "Acceso físico o digital habilitado." },
  { key: "requests", label: "Solicitudes especiales revisadas", help: "Recepción conoce pendientes y restricciones." },
]

export function GuidedCheckInPanel() {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [arrivals, setArrivals] = useState<Arrival[]>([])
  const [selected, setSelected] = useState<Arrival | null>(null)
  const [checks, setChecks] = useState<Checklist>(INITIAL)
  const [exceptionReason, setExceptionReason] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const horizon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from("reservations")
      .select("id, guest_name, guest_email, guest_phone, num_guests, check_in, estimated_arrival_time, payment_status, special_requests, arrival_status, room:rooms(id, room_number, operational_status, location:locations(name))")
      .in("status", ["confirmed", "pending"])
      .gte("check_in", today)
      .lte("check_in", horizon)
      .order("check_in")
      .order("estimated_arrival_time")
    if (error) toast.error(error.message)
    else setArrivals((data ?? []) as unknown as Arrival[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { if (open) void load() }, [load, open])

  function choose(arrival: Arrival) {
    setSelected(arrival)
    setChecks({
      identity: false,
      contact: Boolean(arrival.guest_email || arrival.guest_phone),
      guests: Boolean(arrival.num_guests && arrival.num_guests > 0),
      payment: arrival.payment_status === "paid",
      terms: false,
      access: false,
      requests: true,
    })
    setExceptionReason("")
  }

  async function complete() {
    if (!selected) return
    setSaving(true)
    const { error } = await supabase.rpc("guided_check_in", {
      p_reservation_id: selected.id,
      p_identity_verified: checks.identity,
      p_contact_verified: checks.contact,
      p_guest_count_verified: checks.guests,
      p_payment_guarantee_verified: checks.payment,
      p_terms_accepted: checks.terms,
      p_access_issued: checks.access,
      p_special_requests_reviewed: checks.requests,
      p_exception_reason: exceptionReason.trim() || null,
    })
    if (error) toast.error(error.message)
    else {
      toast.success("Check-in guiado completado")
      setSelected(null)
      setChecks(INITIAL)
      setExceptionReason("")
      await load()
    }
    setSaving(false)
  }

  const completeCount = Object.values(checks).filter(Boolean).length
  const roomReady = ["ready", "inspected"].includes(selected?.room?.operational_status ?? "")

  return <>
    <Button type="button" variant="secondary" className="fixed bottom-5 right-48 z-40 gap-2 shadow-lg" onClick={() => setOpen(true)}>
      <ClipboardCheck className="h-4 w-4" />Check-in guiado
      {arrivals.length > 0 && <Badge variant="outline">{arrivals.length}</Badge>}
    </Button>
    {open && <div className="fixed inset-0 z-[75] flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-label="Cerrar check-in guiado" />
      <aside className="relative z-10 flex h-full w-full max-w-3xl flex-col border-l bg-background shadow-2xl">
        <div className="flex items-start justify-between border-b p-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Recepción</p><h2 className="mt-1 text-xl font-semibold">Check-in guiado</h2><p className="mt-1 text-sm text-muted-foreground">La habitación debe estar lista. Las excepciones de checklist requieren administrador y motivo.</p></div>
          <div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button><Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button></div>
        </div>
        <div className="grid min-h-0 flex-1 md:grid-cols-[280px_1fr]">
          <div className="overflow-y-auto border-r p-4">
            <h3 className="mb-3 text-sm font-semibold">Llegadas próximas</h3>
            {arrivals.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No hay llegadas elegibles en los próximos siete días.</p> : <div className="space-y-2">{arrivals.map((arrival) => {
              const ready = ["ready", "inspected"].includes(arrival.room?.operational_status ?? "")
              return <button key={arrival.id} type="button" onClick={() => choose(arrival)} className={`w-full rounded-lg border p-3 text-left ${selected?.id === arrival.id ? "border-primary bg-primary/5" : ""}`}>
                <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{arrival.guest_name}</p><Badge variant={ready ? "default" : "outline"}>{ready ? "Lista" : "No lista"}</Badge></div>
                <p className="mt-1 text-xs text-muted-foreground">{arrival.check_in} {arrival.estimated_arrival_time ? `· ${arrival.estimated_arrival_time.slice(0,5)}` : ""}</p>
                <p className="mt-1 text-xs text-muted-foreground">{arrival.room?.location?.name ?? "Sin propiedad"} · {arrival.room?.room_number ?? "Sin habitación"}</p>
              </button>
            })}</div>}
          </div>
          <div className="overflow-y-auto p-5">
            {!selected ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Selecciona una llegada para comenzar.</div> : <div className="space-y-5">
              <div className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{selected.guest_name}</h3><p className="mt-1 text-sm text-muted-foreground">{selected.room?.location?.name ?? "Sin propiedad"} · {selected.room?.room_number ?? "Sin habitación"}</p></div><Badge variant={roomReady ? "default" : "destructive"}>{roomReady ? "Habitación lista" : "Habitación no disponible"}</Badge></div></div>
              <div><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Checklist operacional</h3><Badge variant="outline">{completeCount}/7</Badge></div><div className="space-y-2">{ITEMS.map((item) => <label key={item.key} className="flex cursor-pointer gap-3 rounded-lg border p-3"><input type="checkbox" checked={checks[item.key]} onChange={(event) => setChecks((current) => ({ ...current, [item.key]: event.target.checked }))} className="mt-1 h-4 w-4" /><span><span className="block text-sm font-medium">{item.label}</span><span className="block text-xs text-muted-foreground">{item.help}</span></span></label>)}</div></div>
              {completeCount < 7 && <div className="rounded-lg border border-amber-300 bg-amber-50 p-4"><div className="flex gap-2"><ShieldAlert className="mt-0.5 h-4 w-4 text-amber-700" /><div className="flex-1"><p className="text-sm font-medium text-amber-900">Checklist incompleto</p><p className="mt-1 text-xs text-amber-800">Solo un administrador puede continuar con una excepción documentada.</p><Input className="mt-3 bg-background" value={exceptionReason} onChange={(event) => setExceptionReason(event.target.value)} placeholder="Motivo obligatorio de la excepción" /></div></div></div>}
              <Button className="w-full" onClick={() => void complete()} disabled={saving || !roomReady || (completeCount < 7 && exceptionReason.trim().length < 8)}><CheckCircle2 className="mr-2 h-4 w-4" />{saving ? "Registrando…" : "Completar check-in"}</Button>
            </div>}
          </div>
        </div>
      </aside>
    </div>}
  </>
}

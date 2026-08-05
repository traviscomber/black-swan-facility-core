"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, MapPin, Users, WalletCards } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type EventRow = { id:string; name:string; start_date:string; end_date:string; location_name:string|null; status:string; participant_count:number; person_days:number; estimated_total_clp:number; notes:string|null }
type Participant = { id:string; participant_name:string; accommodation_name:string|null; room_name:string|null; arrival_date:string|null; arrival_time:string|null; arrival_transport:string|null; departure_date:string|null; departure_time:string|null; departure_transport:string|null; planned_stay_days:number|null; confirmation_status:string; notes:string|null }
type BudgetItem = { id:string; category:string; item_name:string; unit:string|null; quantity:number|null; estimated_unit_price_clp:number|null; estimated_subtotal_clp:number|null; procurement_status:string }

const money = new Intl.NumberFormat("es-CL", { style:"currency", currency:"CLP", maximumFractionDigits:0 })
const date = new Intl.DateTimeFormat("es-CL", { dateStyle:"medium" })

export default function PaseoBlackSwanPage() {
  const supabase = useMemo(() => createClient(), [])
  const [event, setEvent] = useState<EventRow|null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [items, setItems] = useState<BudgetItem[]>([])
  const [error, setError] = useState<string|null>(null)

  useEffect(() => {
    void (async () => {
      const eventResult = await supabase.from("operational_events").select("id,name,start_date,end_date,location_name,status,participant_count,person_days,estimated_total_clp,notes").eq("event_code","BSFC-EVENT-2026-08-10-PASEO-BLACK-SWAN").single()
      if (eventResult.error || !eventResult.data) { setError(eventResult.error?.message ?? "Evento no encontrado"); return }
      setEvent(eventResult.data as EventRow)
      const [p,b] = await Promise.all([
        supabase.from("operational_event_participants").select("id,participant_name,accommodation_name,room_name,arrival_date,arrival_time,arrival_transport,departure_date,departure_time,departure_transport,planned_stay_days,confirmation_status,notes").eq("event_id",eventResult.data.id).order("arrival_date").order("participant_name"),
        supabase.from("operational_event_budget_items").select("id,category,item_name,unit,quantity,estimated_unit_price_clp,estimated_subtotal_clp,procurement_status").eq("event_id",eventResult.data.id).order("category").order("item_name")
      ])
      if (p.error || b.error) setError(p.error?.message ?? b.error?.message ?? "No se pudo cargar el detalle")
      setParticipants((p.data ?? []) as Participant[])
      setItems((b.data ?? []) as BudgetItem[])
    })()
  }, [supabase])

  const totals = items.reduce<Record<string,number>>((acc,item) => { acc[item.category] = (acc[item.category] ?? 0) + Number(item.estimated_subtotal_clp ?? 0); return acc }, {})
  const pending = participants.filter((p) => p.confirmation_status !== "confirmed").length

  if (error) return <div className="p-6 text-sm text-destructive">{error}</div>
  if (!event) return <div className="p-6 text-sm text-muted-foreground">Cargando evento canónico…</div>

  return <main className="space-y-6 p-4 md:p-6">
    <section>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Evento canónico</p>
      <h1 className="mt-1 text-2xl font-semibold">{event.name}</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Datos importados desde el XLS canónico. Los valores se mantienen como estimados hasta conciliación con compras, boletas y confirmaciones reales.</p>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={CalendarDays} label="Fechas" value={`${date.format(new Date(event.start_date + "T12:00:00"))} — ${date.format(new Date(event.end_date + "T12:00:00"))}`} />
      <Metric icon={Users} label="Participantes" value={`${event.participant_count} · ${pending} pendientes`} />
      <Metric icon={MapPin} label="Ubicación" value={event.location_name ?? "Sin ubicación"} />
      <Metric icon={WalletCards} label="Presupuesto estimado" value={money.format(event.estimated_total_clp)} />
    </section>

    <Card>
      <CardHeader><CardTitle>Participantes y alojamiento</CardTitle><CardDescription>Las salidas no informadas permanecen marcadas como pendientes; no se inventaron fechas ni habitaciones.</CardDescription></CardHeader>
      <CardContent className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">Participante</th><th>Alojamiento</th><th>Llegada</th><th>Salida</th><th>Transporte</th><th>Estado</th></tr></thead><tbody>{participants.map((p) => <tr key={p.id} className="border-b align-top"><td className="py-3 font-medium">{p.participant_name}<div className="text-xs font-normal text-muted-foreground">{p.notes}</div></td><td>{p.accommodation_name}<div className="text-xs text-muted-foreground">{p.room_name}</div></td><td>{p.arrival_date ? date.format(new Date(p.arrival_date+"T12:00:00")) : "—"}<div className="text-xs text-muted-foreground">{p.arrival_time?.slice(0,5)} · {p.arrival_transport}</div></td><td>{p.departure_date ? date.format(new Date(p.departure_date+"T12:00:00")) : "Pendiente"}<div className="text-xs text-muted-foreground">{p.departure_time?.slice(0,5)} {p.departure_transport ? `· ${p.departure_transport}` : ""}</div></td><td>{p.arrival_transport ?? "—"}</td><td><Badge variant={p.confirmation_status === "confirmed" ? "secondary" : "outline"}>{p.confirmation_status === "confirmed" ? "Confirmado" : "Pendiente"}</Badge></td></tr>)}</tbody></table></CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Presupuesto por categoría</CardTitle><CardDescription>{items.length} partidas importadas; total conciliado con el XLS.</CardDescription></CardHeader>
      <CardContent className="space-y-5">{Object.entries(totals).map(([category,total]) => <section key={category}><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">{category}</h3><span className="text-sm font-medium">{money.format(total)}</span></div><div className="divide-y rounded-lg border">{items.filter((item) => item.category === category).map((item) => <div key={item.id} className="grid gap-2 p-3 text-sm sm:grid-cols-[1fr_120px_140px]"><div>{item.item_name}<div className="text-xs text-muted-foreground">{item.quantity ?? "—"} {item.unit ?? ""}</div></div><div className="text-muted-foreground">{money.format(Number(item.estimated_unit_price_clp ?? 0))}</div><div className="font-medium sm:text-right">{money.format(Number(item.estimated_subtotal_clp ?? 0))}</div></div>)}</div></section>)}</CardContent>
    </Card>
  </main>
}

function Metric({ icon:Icon,label,value }:{ icon:typeof CalendarDays; label:string; value:string }) { return <Card><CardContent className="p-4"><Icon className="h-4 w-4 text-primary"/><p className="mt-4 text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></CardContent></Card> }

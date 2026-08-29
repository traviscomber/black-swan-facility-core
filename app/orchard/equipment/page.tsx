"use client"

import { useEffect, useMemo, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, CheckCircle2, Clock3, MapPin, ShieldCheck, Wrench } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

interface Equipment {
  id: string
  equipment_name: string
  equipment_type: string
  condition: string
  purchase_date: string
  last_maintenance_date: string | null
  next_maintenance_date: string | null
  storage_location: string
  description: string
}

const hero = "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=2200&q=92"
const equipmentPhoto = "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1800&q=92"
const workshopPhoto = "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1800&q=92"

function dateKey(value: string | null) { return value ? new Date(`${value}T12:00:00`) : null }
function dueState(next: string | null) {
  const d = dateKey(next)
  if (!d) return "unscheduled"
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const delta = Math.ceil((d.getTime() - today.getTime()) / 86400000)
  if (delta < 0) return "overdue"
  if (delta <= 14) return "due_soon"
  return "scheduled"
}

export default function OrchardEquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createBrowserClient(), [])
  const { t } = useLanguage()

  useEffect(() => { void fetchData() }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data } = await supabase.from("orchard_equipment").select("*").order("purchase_date", { ascending: false })
      setEquipment((data || []) as Equipment[])
    } finally { setLoading(false) }
  }

  const active = equipment.filter((item) => item.condition !== "broken")
  const overdue = equipment.filter((item) => dueState(item.next_maintenance_date) === "overdue")
  const dueSoon = equipment.filter((item) => dueState(item.next_maintenance_date) === "due_soon")
  const unscheduled = equipment.filter((item) => !item.next_maintenance_date)
  const typeCount = new Set(equipment.map((item) => item.equipment_type)).size
  const locations = [...new Set(equipment.map((item) => item.storage_location).filter(Boolean))]
  const readiness = equipment.length ? Math.round((equipment.filter((item) => item.condition !== "broken" && dueState(item.next_maintenance_date) !== "overdue").length / equipment.length) * 100) : 0
  const ordered = [...equipment].sort((a, b) => {
    const rank = (item: Equipment) => ({ overdue: 0, due_soon: 1, scheduled: 2, unscheduled: 3 }[dueState(item.next_maintenance_date)] ?? 4)
    return rank(a) - rank(b)
  })

  if (loading) return <AppLayout><OrchardNavigation /><div className="flex min-h-[60vh] items-center justify-center"><p className="text-muted-foreground">{t("orchard.loading")}</p></div></AppLayout>

  return <AppLayout><OrchardNavigation /><main className="mx-auto w-full max-w-[1560px] space-y-10 px-4 pb-16 pt-4 sm:px-6 lg:px-8">
    <section className="relative min-h-[390px] overflow-hidden bg-neutral-950">
      <img src={hero} alt="Agricultural equipment ready for field work" className="absolute inset-0 h-full w-full object-cover opacity-100 [filter:none]" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg,rgba(4,6,5,.94),rgba(4,6,5,.60) 55%,rgba(4,6,5,.18)),linear-gradient(0deg,rgba(4,6,5,.72),transparent 65%)" }} />
      <div className="relative flex min-h-[390px] max-w-3xl flex-col justify-end p-6 text-white sm:p-10">
        <p className="text-xs uppercase tracking-[.2em] text-emerald-200">Orchard · Equipment readiness</p>
        <h1 className="mt-3 text-4xl font-medium tracking-[-.035em] text-white! sm:text-5xl">{t("orchard.equipment")}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-white/72">{t("orchard.equipment_description")}</p>
        <div className="mt-6 flex flex-wrap gap-2"><Badge className="border-white/15 bg-black/30 px-3 py-2 text-white">{active.length} active</Badge><Badge className="border-white/15 bg-black/30 px-3 py-2 text-white">{overdue.length} overdue maintenance</Badge><Badge className="border-white/15 bg-black/30 px-3 py-2 text-white">{readiness}% ready</Badge></div>
      </div>
      <div className="absolute bottom-6 right-6 hidden grid-cols-2 gap-px bg-white/10 lg:grid"><HeroMetric icon={<Wrench className="h-4 w-4" />} label="Assets" value={String(equipment.length)} /><HeroMetric icon={<AlertTriangle className="h-4 w-4" />} label="Due" value={String(overdue.length + dueSoon.length)} /><HeroMetric icon={<ShieldCheck className="h-4 w-4" />} label="Ready" value={`${readiness}%`} /><HeroMetric icon={<MapPin className="h-4 w-4" />} label="Locations" value={String(locations.length)} /></div>
    </section>

    <section className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <div><p className="text-xs uppercase tracking-[.18em] text-muted-foreground">01</p><h2 className="mt-2">Maintenance readiness board</h2><p className="mt-1 text-sm text-muted-foreground">Equipment is prioritized by maintenance urgency so field risk is visible before work starts.</p></div>
        {ordered.length === 0 ? <div className="border border-dashed p-8 text-sm text-muted-foreground">{t("orchard.no_equipment")}</div> : <div className="grid gap-4 md:grid-cols-2">{ordered.map((item, index) => { const state = dueState(item.next_maintenance_date); const urgent = state === "overdue" || item.condition === "broken"; return <article key={item.id} className="overflow-hidden border bg-background"><div className="relative h-44 overflow-hidden"><img src={index % 2 ? workshopPhoto : equipmentPhoto} alt="Orchard equipment" className="h-full w-full object-cover opacity-100 [filter:none]" /><div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,.78),rgba(0,0,0,.08)_70%)]" /><div className="absolute inset-x-4 bottom-4 text-white"><div className="flex flex-wrap gap-2"><Badge className="border-white/15 bg-black/35 text-white">{item.equipment_type}</Badge><Badge variant={urgent ? "destructive" : "outline"} className={urgent ? "" : "border-white/20 bg-black/25 text-white"}>{item.condition}</Badge>{state === "overdue" && <Badge variant="destructive">Maintenance overdue</Badge>}{state === "due_soon" && <Badge className="bg-amber-500/90 text-black">Due soon</Badge>}</div><h3 className="mt-2 text-xl text-white!">{item.equipment_name}</h3><p className="mt-1 text-xs text-white/70">{item.storage_location || "No storage location"}</p></div></div><div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4"><Datum label="Purchased" value={dateKey(item.purchase_date)?.toLocaleDateString() || "—"} /><Datum label="Last service" value={dateKey(item.last_maintenance_date)?.toLocaleDateString() || "Never"} /><Datum label="Next service" value={dateKey(item.next_maintenance_date)?.toLocaleDateString() || "Unscheduled"} /><Datum label="Status" value={state.replaceAll("_", " ")} /></div>{item.description && <p className="p-4 text-sm leading-6 text-muted-foreground">{item.description}</p>}</article> })}</div>}
      </div>

      <div className="space-y-6">
        <Card><CardHeader><CardTitle>Readiness signals</CardTitle><CardDescription>Operational maintenance exposure from the records already in Orchard.</CardDescription></CardHeader><CardContent className="space-y-3"><Signal icon={<AlertTriangle className="h-4 w-4" />} label="Overdue maintenance" value={overdue.length} tone="risk" /><Signal icon={<Clock3 className="h-4 w-4" />} label="Due within 14 days" value={dueSoon.length} /><Signal icon={<CheckCircle2 className="h-4 w-4" />} label="Active equipment" value={active.length} /><Signal icon={<Wrench className="h-4 w-4" />} label="No service scheduled" value={unscheduled.length} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Storage footprint</CardTitle><CardDescription>Where orchard assets are currently recorded.</CardDescription></CardHeader><CardContent className="space-y-3">{locations.length === 0 ? <p className="text-sm text-muted-foreground">No storage locations recorded.</p> : locations.map((location) => { const count = equipment.filter((item) => item.storage_location === location).length; return <div key={location} className="flex items-center justify-between border-b pb-3 last:border-b-0 last:pb-0"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{location}</span></div><Badge variant="outline">{count}</Badge></div> })}</CardContent></Card>
        <Card className="overflow-hidden"><div className="relative h-48"><img src={workshopPhoto} alt="Equipment maintenance workspace" className="h-full w-full object-cover opacity-100 [filter:none]" /><div className="absolute inset-0 bg-black/38" /><div className="absolute bottom-4 left-4 right-4 text-white"><ShieldCheck className="mb-2 h-5 w-5" /><p className="font-medium">Readiness before assignment</p><p className="mt-1 text-xs text-white/70">This cockpit exposes maintenance risk without inventing utilization or service history that is not recorded.</p></div></div></Card>
      </div>
    </section>
  </main></AppLayout>
}

function Datum({ label, value }: { label: string; value: string }) { return <div className="bg-background p-3"><p className="text-[10px] uppercase tracking-[.13em] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium capitalize">{value}</p></div> }
function Signal({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: "risk" }) { return <div className={`flex items-center justify-between border p-4 ${tone === "risk" && value > 0 ? "border-destructive/40 bg-destructive/5" : ""}`}><div className="flex items-center gap-2 text-sm">{icon}{label}</div><span className="text-xl font-medium tabular-nums">{value}</span></div> }
function HeroMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="min-w-36 bg-black/45 px-5 py-4 text-white"><div className="flex items-center gap-2 text-[10px] uppercase tracking-[.14em] text-white/55">{icon}{label}</div><p className="mt-1 text-2xl font-medium text-white">{value}</p></div> }

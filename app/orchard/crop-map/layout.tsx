"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, MapPin, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type FocusedAllocation = {
  id: string
  bed_id: string
  crop_succession_id: string
  planned_start_date: string
  planned_end_date: string
  allocated_area_sqm: number | null
  planned_plants: number | null
}
type Bed = { id: string; plot_id: string; name: string; code: string | null }
type Plot = { id: string; name: string }
type Succession = { id: string; crop_cycle_id: string; sequence_no: number }
type Cycle = { id: string; crop_name: string; variety: string | null }

export default function CropMapLayout({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const [entityId, setEntityId] = useState<string | null>(null)
  const [allocation, setAllocation] = useState<FocusedAllocation | null>(null)
  const [bed, setBed] = useState<Bed | null>(null)
  const [plot, setPlot] = useState<Plot | null>(null)
  const [succession, setSuccession] = useState<Succession | null>(null)
  const [cycle, setCycle] = useState<Cycle | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("from") === "orchard-ai") setEntityId(params.get("entity"))
  }, [])

  useEffect(() => {
    if (!entityId) return
    let cancelled = false
    async function loadFocus() {
      const allocationResult = await supabase.from("orchard_bed_allocations").select("id,bed_id,crop_succession_id,planned_start_date,planned_end_date,allocated_area_sqm,planned_plants").eq("id", entityId).maybeSingle()
      if (cancelled || allocationResult.error || !allocationResult.data) return
      const nextAllocation = allocationResult.data as FocusedAllocation
      const [bedResult, successionResult] = await Promise.all([
        supabase.from("orchard_beds").select("id,plot_id,name,code").eq("id", nextAllocation.bed_id).maybeSingle(),
        supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no").eq("id", nextAllocation.crop_succession_id).maybeSingle(),
      ])
      if (cancelled) return
      const nextBed = (bedResult.data ?? null) as Bed | null
      const nextSuccession = (successionResult.data ?? null) as Succession | null
      setAllocation(nextAllocation)
      setBed(nextBed)
      setSuccession(nextSuccession)
      const [plotResult, cycleResult] = await Promise.all([
        nextBed ? supabase.from("orchard_plots").select("id,name").eq("id", nextBed.plot_id).maybeSingle() : Promise.resolve({ data: null }),
        nextSuccession ? supabase.from("orchard_crop_cycles").select("id,crop_name,variety").eq("id", nextSuccession.crop_cycle_id).maybeSingle() : Promise.resolve({ data: null }),
      ])
      if (cancelled) return
      setPlot((plotResult.data ?? null) as Plot | null)
      setCycle((cycleResult.data ?? null) as Cycle | null)
    }
    void loadFocus()
    return () => { cancelled = true }
  }, [entityId, supabase])

  const isEs = language === "es"
  const cropLabel = cycle ? `${cycle.crop_name}${cycle.variety ? ` · ${cycle.variety}` : ""}${succession ? ` #${succession.sequence_no}` : ""}` : (isEs ? "Sucesión asignada" : "Allocated succession")
  const bedLabel = bed ? `${plot?.name ? `${plot.name} · ` : ""}${bed.name}${bed.code ? ` · ${bed.code}` : ""}` : "—"

  return <>
    {allocation && <div className="sticky top-0 z-[45] border-b border-primary/40 bg-background/95 px-4 py-3 backdrop-blur sm:px-8">
      <Card className="mx-auto max-w-[1500px] border-primary/40 bg-primary/5 shadow-lg">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex h-10 w-10 items-center justify-center border border-primary/30 bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{isEs ? "Asignación creada por Orchard AI" : "Allocation created by Orchard AI"}</p><Badge><CheckCircle2 className="mr-1 h-3.5 w-3.5" />{isEs ? "Creada" : "Created"}</Badge></div>
            <p className="mt-1 text-sm text-muted-foreground">{cropLabel} · {bedLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">{allocation.planned_start_date} → {allocation.planned_end_date}{allocation.allocated_area_sqm != null ? ` · ${allocation.allocated_area_sqm} m²` : ""}{allocation.planned_plants != null ? ` · ${allocation.planned_plants} ${isEs ? "plantas" : "plants"}` : ""}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-4 w-4" />ID: {allocation.id}</div>
        </CardContent>
      </Card>
    </div>}
    {children}
  </>
}

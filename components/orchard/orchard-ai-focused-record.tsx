"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Kind = "care" | "health" | "harvest" | "commercial"
type FocusRow = Record<string, unknown>

const configs: Record<Kind, { table: string; select: string }> = {
  care: { table: "orchard_care_logs", select: "id,crop_id,activity_date,activity_type,hours_spent,description,observations" },
  health: { table: "orchard_pest_logs", select: "id,crop_id,observation_date,pest_type,disease_name,severity_level,affected_percentage,notes" },
  harvest: { table: "orchard_harvest_records", select: "id,crop_id,harvest_date,quantity_harvested,harvest_unit,quality_rating,harvest_lot_code,notes" },
  commercial: { table: "orchard_sales_commitments", select: "id,sales_channel_id,crop_succession_id,crop_name,variety,delivery_start,delivery_end,quantity,unit,price_per_unit,currency,status,customer_reference,notes" },
}

export function OrchardAiFocusedRecord({ kind, children }: { kind: Kind; children: ReactNode }) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const [entityId, setEntityId] = useState<string | null>(null)
  const [row, setRow] = useState<FocusRow | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("from") === "orchard-ai") setEntityId(params.get("entity"))
  }, [])

  useEffect(() => {
    if (!entityId) return
    let cancelled = false
    const config = configs[kind]
    async function load() {
      const result = await supabase.from(config.table).select(config.select).eq("id", entityId).maybeSingle()
      if (!cancelled && !result.error && result.data) setRow(result.data as unknown as FocusRow)
    }
    void load()
    return () => { cancelled = true }
  }, [entityId, kind, supabase])

  const isEs = language === "es"
  return <>
    {row && <div className="sticky top-0 z-[45] border-b border-primary/40 bg-background/95 px-4 py-3 backdrop-blur sm:px-8">
      <Card className="mx-auto max-w-[1560px] border-primary/40 bg-primary/5 shadow-lg">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex h-10 w-10 items-center justify-center border border-primary/30 bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{titleFor(kind, isEs)}</p><Badge><CheckCircle2 className="mr-1 h-3.5 w-3.5" />{isEs ? "Creado" : "Created"}</Badge></div>
            <p className="mt-1 text-sm text-muted-foreground">{summaryFor(kind, row, isEs)}</p>
            <p className="mt-1 break-all text-[11px] text-muted-foreground">ID: {String(row.id ?? entityId)}</p>
          </div>
        </CardContent>
      </Card>
    </div>}
    {children}
  </>
}

function titleFor(kind: Kind, es: boolean) {
  if (kind === "care") return es ? "Cuidado creado por Orchard AI" : "Care record created by Orchard AI"
  if (kind === "health") return es ? "Observación sanitaria creada por Orchard AI" : "Health observation created by Orchard AI"
  if (kind === "harvest") return es ? "Cosecha registrada por Orchard AI" : "Harvest recorded by Orchard AI"
  return es ? "Compromiso comercial creado por Orchard AI" : "Sales commitment created by Orchard AI"
}

function summaryFor(kind: Kind, row: FocusRow, es: boolean) {
  if (kind === "care") return [row.activity_date, human(row.activity_type), row.hours_spent != null ? `${row.hours_spent}h` : null, row.description ?? row.observations].filter(Boolean).join(" · ")
  if (kind === "health") return [row.observation_date, row.pest_type ?? row.disease_name, human(row.severity_level), row.affected_percentage != null ? `${row.affected_percentage}% ${es ? "afectado" : "affected"}` : null].filter(Boolean).join(" · ")
  if (kind === "harvest") return [row.harvest_date, row.quantity_harvested != null ? `${row.quantity_harvested} ${row.harvest_unit ?? ""}`.trim() : null, row.harvest_lot_code].filter(Boolean).join(" · ")
  return [row.crop_name, row.variety, `${row.delivery_start ?? ""} → ${row.delivery_end ?? ""}`, row.quantity != null ? `${row.quantity} ${row.unit ?? ""}`.trim() : null, human(row.status)].filter(Boolean).join(" · ")
}

function human(value: unknown) { return typeof value === "string" ? value.replaceAll("_", " ") : null }

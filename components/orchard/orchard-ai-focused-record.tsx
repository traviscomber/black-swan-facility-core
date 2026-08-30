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
type OrchardLocale = "en" | "es" | "de"

const configs: Record<Kind, { table: string; select: string }> = {
  care: { table: "orchard_care_logs", select: "id,crop_id,activity_date,activity_type,hours_spent,description,observations" },
  health: { table: "orchard_pest_logs", select: "id,crop_id,observation_date,pest_type,disease_name,severity_level,affected_percentage,notes" },
  harvest: { table: "orchard_harvest_records", select: "id,crop_id,harvest_date,quantity_harvested,harvest_unit,quality_rating,harvest_lot_code,notes" },
  commercial: { table: "orchard_sales_commitments", select: "id,sales_channel_id,crop_succession_id,crop_name,variety,delivery_start,delivery_end,quantity,unit,price_per_unit,currency,status,customer_reference,notes" },
}

const copy: Record<OrchardLocale, { created: string; affected: string; titles: Record<Kind, string> }> = {
  en: { created: "Created", affected: "affected", titles: { care: "Care record created by Orchard AI", health: "Health observation created by Orchard AI", harvest: "Harvest recorded by Orchard AI", commercial: "Sales commitment created by Orchard AI" } },
  es: { created: "Creado", affected: "afectado", titles: { care: "Cuidado creado por Orchard AI", health: "Observación sanitaria creada por Orchard AI", harvest: "Cosecha registrada por Orchard AI", commercial: "Compromiso comercial creado por Orchard AI" } },
  de: { created: "Erstellt", affected: "betroffen", titles: { care: "Pflegeeintrag von Orchard AI erstellt", health: "Gesundheitsbeobachtung von Orchard AI erstellt", harvest: "Ernte von Orchard AI erfasst", commercial: "Verkaufszusage von Orchard AI erstellt" } },
}

const valueLabels: Record<OrchardLocale, Record<string, string>> = {
  en: { watering: "Watering", feeding: "Feeding", weeding: "Weeding", pruning: "Pruning", cultivation: "Cultivation", inspection: "Inspection", other: "Other", low: "Low", medium: "Medium", high: "High", critical: "Critical", forecast: "Forecast", committed: "Committed", fulfilled: "Fulfilled", cancelled: "Cancelled" },
  es: { watering: "Riego", feeding: "Fertilización", weeding: "Desmalezado", pruning: "Poda", cultivation: "Labranza", inspection: "Inspección", other: "Otro", low: "Baja", medium: "Media", high: "Alta", critical: "Crítica", forecast: "Proyección", committed: "Comprometido", fulfilled: "Cumplido", cancelled: "Cancelado" },
  de: { watering: "Bewässerung", feeding: "Düngung", weeding: "Unkrautpflege", pruning: "Schnitt", cultivation: "Bodenbearbeitung", inspection: "Kontrolle", other: "Sonstiges", low: "Niedrig", medium: "Mittel", high: "Hoch", critical: "Kritisch", forecast: "Prognose", committed: "Zugesagt", fulfilled: "Erfüllt", cancelled: "Storniert" },
}

export function OrchardAiFocusedRecord({ kind, children }: { kind: Kind; children: ReactNode }) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const locale: OrchardLocale = language
  const text = copy[locale]
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

  return <>
    {row && <div className="sticky top-0 z-[45] border-b border-primary/40 bg-background/95 px-4 py-3 backdrop-blur sm:px-8">
      <Card className="mx-auto max-w-[1560px] border-primary/40 bg-primary/5 shadow-lg">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex h-10 w-10 items-center justify-center border border-primary/30 bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{text.titles[kind]}</p><Badge><CheckCircle2 className="mr-1 h-3.5 w-3.5" />{text.created}</Badge></div>
            <p className="mt-1 text-sm text-muted-foreground">{summaryFor(kind, row, locale)}</p>
            <p className="mt-1 break-all text-[11px] text-muted-foreground">ID: {String(row.id ?? entityId)}</p>
          </div>
        </CardContent>
      </Card>
    </div>}
    {children}
  </>
}

function summaryFor(kind: Kind, row: FocusRow, locale: OrchardLocale) {
  const text = copy[locale]
  if (kind === "care") return [row.activity_date, human(row.activity_type, locale), row.hours_spent != null ? `${row.hours_spent}h` : null, row.description ?? row.observations].filter(Boolean).join(" · ")
  if (kind === "health") return [row.observation_date, row.pest_type ?? row.disease_name, human(row.severity_level, locale), row.affected_percentage != null ? `${row.affected_percentage}% ${text.affected}` : null].filter(Boolean).join(" · ")
  if (kind === "harvest") return [row.harvest_date, row.quantity_harvested != null ? `${row.quantity_harvested} ${row.harvest_unit ?? ""}`.trim() : null, row.harvest_lot_code].filter(Boolean).join(" · ")
  return [row.crop_name, row.variety, `${row.delivery_start ?? ""} → ${row.delivery_end ?? ""}`, row.quantity != null ? `${row.quantity} ${row.unit ?? ""}`.trim() : null, human(row.status, locale)].filter(Boolean).join(" · ")
}

function human(value: unknown, locale: OrchardLocale) {
  if (typeof value !== "string") return null
  return valueLabels[locale][value] ?? value.replaceAll("_", " ")
}

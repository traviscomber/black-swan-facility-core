"use client"

import { useEffect, useMemo, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Grape, Calendar, AlertCircle, Trash2, Pencil } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"

interface HarvestRecord {
  id: string
  plot_id: string
  harvest_date: string
  quantity_kg: number
  quantity_tons: number
  sugar_level_brix: number
  acidity_ph: number
  alcohol_potential: number
  color_analysis: string
  maturity_assessment: string
  yield_per_hectare: number
  quality_rating: number
}

const localeMap: Record<Locale, string> = { en: "en-US", es: "es-CL", de: "de-DE" }
const copy = {
  en: { title: "Harvest management", description: "Record grape harvests and quality metrics.", add: "Record harvest", totalYield: "Total yield", tons: "metric tons", records: "Harvest records", totalHarvests: "total harvests", avgBrix: "Average Brix", sugar: "sugar content", avgQuality: "Average quality", outOf100: "out of 100", section: "Harvest records", sectionDescription: "Recorded harvests with quality analysis.", empty: "No harvest records yet.", loading: "Loading harvests…", sugarLabel: "Sugar (Brix)", acidity: "Acidity (pH)", alcohol: "Alcohol potential", yieldHa: "Yield/hectare", color: "Color", quality: "Quality", edit: "Edit harvest", delete: "Delete harvest" },
  es: { title: "Gestión de cosecha", description: "Registra cosechas de uva y métricas de calidad.", add: "Registrar cosecha", totalYield: "Rendimiento total", tons: "toneladas métricas", records: "Registros de cosecha", totalHarvests: "cosechas registradas", avgBrix: "Brix promedio", sugar: "contenido de azúcar", avgQuality: "Calidad promedio", outOf100: "de 100", section: "Registros de cosecha", sectionDescription: "Cosechas registradas con análisis de calidad.", empty: "Aún no hay cosechas registradas.", loading: "Cargando cosechas…", sugarLabel: "Azúcar (Brix)", acidity: "Acidez (pH)", alcohol: "Alcohol potencial", yieldHa: "Rendimiento/hectárea", color: "Color", quality: "Calidad", edit: "Editar cosecha", delete: "Eliminar cosecha" },
  de: { title: "Erntemanagement", description: "Traubenernten und Qualitätskennzahlen erfassen.", add: "Ernte erfassen", totalYield: "Gesamtertrag", tons: "Tonnen", records: "Ernteeinträge", totalHarvests: "erfasste Ernten", avgBrix: "Ø Brix", sugar: "Zuckergehalt", avgQuality: "Ø Qualität", outOf100: "von 100", section: "Ernteeinträge", sectionDescription: "Erfasste Ernten mit Qualitätsanalyse.", empty: "Noch keine Ernten erfasst.", loading: "Ernten werden geladen…", sugarLabel: "Zucker (Brix)", acidity: "Säure (pH)", alcohol: "Alkoholpotenzial", yieldHa: "Ertrag/Hektar", color: "Farbe", quality: "Qualität", edit: "Ernte bearbeiten", delete: "Ernte löschen" },
} as const

export default function VineyardHarvestPage() {
  const [harvests, setHarvests] = useState<HarvestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language as Locale
  const text = copy[lang]
  const locale = localeMap[lang]
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" })

  useEffect(() => {
    const fetchHarvests = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase.from("vineyard_harvest_records").select("*").order("harvest_date", { ascending: false })
        if (error) throw error
        setHarvests(data || [])
      } catch (error) {
        console.error("[v0] Error fetching harvest records:", error)
      } finally {
        setLoading(false)
      }
    }
    void fetchHarvests()
  }, [supabase])

  const qualityColor = (rating: number) => rating >= 90 ? "bg-emerald-100 text-emerald-800" : rating >= 80 ? "bg-green-100 text-green-800" : rating >= 70 ? "bg-yellow-100 text-yellow-800" : "bg-orange-100 text-orange-800"
  const totalYield = harvests.reduce((sum, harvest) => sum + (harvest.quantity_tons || 0), 0)
  const avgBrix = harvests.length ? harvests.reduce((sum, harvest) => sum + (harvest.sugar_level_brix || 0), 0) / harvests.length : 0
  const avgQuality = harvests.length ? Math.round(harvests.reduce((sum, harvest) => sum + (harvest.quality_rating || 0), 0) / harvests.length) : 0

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">{text.loading}</p></div>

  return <div className="space-y-6">
    <PageHeader title={text.title} description={text.description} action={<Button className="gap-2"><Plus className="h-4 w-4" />{text.add}</Button>} />
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <Metric title={text.totalYield} value={number.format(totalYield)} detail={text.tons} />
      <Metric title={text.records} value={harvests.length.toLocaleString(locale)} detail={text.totalHarvests} />
      <Metric title={text.avgBrix} value={`${number.format(avgBrix)}°`} detail={text.sugar} />
      <Metric title={text.avgQuality} value={avgQuality.toLocaleString(locale)} detail={text.outOf100} />
    </div>
    <Card><CardHeader><CardTitle>{text.section}</CardTitle><CardDescription>{text.sectionDescription}</CardDescription></CardHeader><CardContent>
      {harvests.length === 0 ? <div className="py-8 text-center"><Grape className="mx-auto mb-2 h-12 w-12 text-muted-foreground" /><p className="text-muted-foreground">{text.empty}</p></div> : <div className="space-y-4">{harvests.map((harvest) => <div key={harvest.id} className="flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"><div className="flex-1 space-y-2">
        <div className="flex items-center gap-3"><span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><strong>{date.format(new Date(harvest.harvest_date))}</strong></span><span className="rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">{number.format(harvest.quantity_tons)} {text.tons}</span></div>
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4"><Info label={text.sugarLabel} value={`${number.format(harvest.sugar_level_brix)}°`} /><Info label={text.acidity} value={number.format(harvest.acidity_ph)} /><Info label={text.alcohol} value={`${number.format(harvest.alcohol_potential)}%`} /><Info label={text.yieldHa} value={`${number.format(harvest.yield_per_hectare)} kg`} /></div>
        <div className="flex gap-4 pt-2 text-sm">{harvest.color_analysis ? <span className="flex items-center gap-1"><Grape className="h-4 w-4" />{text.color}: {harvest.color_analysis}</span> : null}<span className={`rounded px-2 py-1 text-xs font-medium ${qualityColor(harvest.quality_rating)}`}>{text.quality}: {number.format(harvest.quality_rating)}</span></div>
        {harvest.maturity_assessment ? <div className="flex items-center gap-1 pt-1 text-sm text-muted-foreground"><AlertCircle className="h-4 w-4" />{harvest.maturity_assessment}</div> : null}
      </div><div className="flex gap-2"><Button size="sm" variant="outline" aria-label={text.edit}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="outline" className="text-destructive" aria-label={text.delete}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>}
    </CardContent></Card>
  </div>
}

function Metric({ title, value, detail }: { title: string; value: string; detail: string }) { return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div><p className="text-xs text-muted-foreground">{detail}</p></CardContent></Card> }
function Info({ label, value }: { label: string; value: string }) { return <div><span className="text-xs text-muted-foreground">{label}</span><p className="font-semibold">{value}</p></div> }

"use client"

import { useEffect, useMemo, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Droplet, Leaf, Beaker, Calendar, DollarSign, Trash2, Pencil } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"

interface SoilAmendment {
  id: string
  plot_id: string
  amendment_type: string
  application_date: string
  material_name: string
  quantity_kg: number
  cost: number
  nitrogen_percent: number
  phosphorus_percent: number
  potassium_percent: number
  organic_matter_percent: number
  ph_adjustment: number
  application_method: string
  labor_hours: number
}

const localeMap: Record<Locale, string> = { en: "en-US", es: "es-CL", de: "de-DE" }
const copy = {
  en: { title: "Soil management", description: "Track soil amendments and nutrient applications.", add: "Add amendment", amendments: "Amendments", applications: "total applications", amount: "Total amount", tons: "metric tons", cost: "Cost", spent: "total spent", nitrogenAdded: "Nitrogen added", kg: "kg", section: "Soil amendments", sectionDescription: "Recorded soil amendments and nutrient applications.", empty: "No soil amendments recorded yet.", loading: "Loading soil amendments…", nitrogen: "Nitrogen", phosphorus: "Phosphorus", potassium: "Potassium", organicMatter: "Organic matter", phAdjustment: "pH adjustment", fertilizer: "Fertilizer", organic: "Organic matter", ph: "pH adjustment", mulch: "Mulch", other: "Other", edit: "Edit amendment", delete: "Delete amendment" },
  es: { title: "Manejo de suelo", description: "Registra enmiendas de suelo y aplicaciones de nutrientes.", add: "Agregar enmienda", amendments: "Enmiendas", applications: "aplicaciones registradas", amount: "Cantidad total", tons: "toneladas métricas", cost: "Costo", spent: "gasto total", nitrogenAdded: "Nitrógeno incorporado", kg: "kg", section: "Enmiendas de suelo", sectionDescription: "Enmiendas y aplicaciones de nutrientes registradas.", empty: "Aún no hay enmiendas de suelo registradas.", loading: "Cargando enmiendas…", nitrogen: "Nitrógeno", phosphorus: "Fósforo", potassium: "Potasio", organicMatter: "Materia orgánica", phAdjustment: "Ajuste de pH", fertilizer: "Fertilizante", organic: "Materia orgánica", ph: "Ajuste de pH", mulch: "Acolchado", other: "Otro", edit: "Editar enmienda", delete: "Eliminar enmienda" },
  de: { title: "Bodenmanagement", description: "Bodenverbesserungen und Nährstoffgaben erfassen.", add: "Bodenverbesserung hinzufügen", amendments: "Bodenverbesserungen", applications: "erfasste Anwendungen", amount: "Gesamtmenge", tons: "Tonnen", cost: "Kosten", spent: "Gesamtausgaben", nitrogenAdded: "Zugeführter Stickstoff", kg: "kg", section: "Bodenverbesserungen", sectionDescription: "Erfasste Bodenverbesserungen und Nährstoffgaben.", empty: "Noch keine Bodenverbesserungen erfasst.", loading: "Bodenverbesserungen werden geladen…", nitrogen: "Stickstoff", phosphorus: "Phosphor", potassium: "Kalium", organicMatter: "Organische Substanz", phAdjustment: "pH-Anpassung", fertilizer: "Dünger", organic: "Organische Substanz", ph: "pH-Anpassung", mulch: "Mulch", other: "Sonstiges", edit: "Bodenverbesserung bearbeiten", delete: "Bodenverbesserung löschen" },
} as const

export default function VineyardSoilPage() {
  const [amendments, setAmendments] = useState<SoilAmendment[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language as Locale
  const text = copy[lang]
  const locale = localeMap[lang]
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
  const currency = new Intl.NumberFormat(locale, { style: "currency", currency: "CLP", maximumFractionDigits: 0 })
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" })

  useEffect(() => {
    const fetchAmendments = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase.from("vineyard_soil_amendments").select("*").order("application_date", { ascending: false })
        if (error) throw error
        setAmendments(data || [])
      } catch (error) {
        console.error("[v0] Error fetching soil amendments:", error)
      } finally {
        setLoading(false)
      }
    }
    void fetchAmendments()
  }, [supabase])

  const typeColor = (type: string) => type === "fertilizer" ? "bg-green-100 text-green-800" : type === "organic_matter" ? "bg-amber-100 text-amber-800" : type === "ph_adjustment" ? "bg-blue-100 text-blue-800" : type === "mulch" ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-800"
  const typeLabel = (type: string) => type === "fertilizer" ? text.fertilizer : type === "organic_matter" ? text.organic : type === "ph_adjustment" ? text.ph : type === "mulch" ? text.mulch : text.other
  const totalCost = amendments.reduce((sum, item) => sum + (item.cost || 0), 0)
  const totalQuantity = amendments.reduce((sum, item) => sum + (item.quantity_kg || 0), 0)
  const totalNitrogen = amendments.reduce((sum, item) => sum + ((item.quantity_kg || 0) * (item.nitrogen_percent || 0) / 100), 0)

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">{text.loading}</p></div>

  return <div className="space-y-6">
    <PageHeader title={text.title} description={text.description} action={<Button className="gap-2"><Plus className="h-4 w-4" />{text.add}</Button>} />
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <Metric title={text.amendments} value={amendments.length.toLocaleString(locale)} detail={text.applications} />
      <Metric title={text.amount} value={number.format(totalQuantity / 1000)} detail={text.tons} />
      <Metric title={text.cost} value={currency.format(totalCost)} detail={text.spent} />
      <Metric title={text.nitrogenAdded} value={number.format(totalNitrogen)} detail={text.kg} />
    </div>
    <Card><CardHeader><CardTitle>{text.section}</CardTitle><CardDescription>{text.sectionDescription}</CardDescription></CardHeader><CardContent>
      {amendments.length === 0 ? <div className="py-8 text-center"><Leaf className="mx-auto mb-2 h-12 w-12 text-muted-foreground" /><p className="text-muted-foreground">{text.empty}</p></div> : <div className="space-y-4">{amendments.map((item) => <div key={item.id} className="flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"><div className="flex-1 space-y-2">
        <div className="flex items-center gap-3"><span className={`rounded px-2 py-1 text-xs font-medium ${typeColor(item.amendment_type)}`}>{typeLabel(item.amendment_type)}</span><span className="font-semibold">{item.material_name}</span></div>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground"><span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{date.format(new Date(item.application_date))}</span><span className="flex items-center gap-1"><Beaker className="h-4 w-4" />{number.format(item.quantity_kg)} kg</span>{item.application_method ? <span className="flex items-center gap-1"><Droplet className="h-4 w-4" />{item.application_method}</span> : null}</div>
        <div className="grid grid-cols-2 gap-3 pt-2 text-sm md:grid-cols-6">{item.nitrogen_percent > 0 ? <Info label={text.nitrogen} value={`${number.format(item.nitrogen_percent)}%`} /> : null}{item.phosphorus_percent > 0 ? <Info label={text.phosphorus} value={`${number.format(item.phosphorus_percent)}%`} /> : null}{item.potassium_percent > 0 ? <Info label={text.potassium} value={`${number.format(item.potassium_percent)}%`} /> : null}{item.organic_matter_percent > 0 ? <Info label={text.organicMatter} value={`${number.format(item.organic_matter_percent)}%`} /> : null}{item.ph_adjustment !== 0 ? <Info label={text.phAdjustment} value={`${item.ph_adjustment > 0 ? "+" : ""}${number.format(item.ph_adjustment)}`} /> : null}<Info label={text.cost} value={currency.format(item.cost || 0)} /></div>
      </div><div className="flex gap-2"><Button size="sm" variant="outline" aria-label={text.edit}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="outline" className="text-destructive" aria-label={text.delete}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>}
    </CardContent></Card>
  </div>
}

function Metric({ title, value, detail }: { title: string; value: string; detail: string }) { return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div><p className="text-xs text-muted-foreground">{detail}</p></CardContent></Card> }
function Info({ label, value }: { label: string; value: string }) { return <div><span className="text-xs text-muted-foreground">{label}</span><p className="font-semibold">{value}</p></div> }

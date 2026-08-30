"use client"

import { useEffect, useMemo, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Leaf, Droplet, Scissors, DollarSign, Clock, Trash2, Pencil } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"

interface CareLog {
  id: string
  plot_id: string
  care_type: string
  activity_date: string
  description: string
  pruning_method: string
  fertilizer_type: string
  fertilizer_amount_kg: number
  irrigation_mm: number
  labor_hours: number
  cost: number
  effectiveness_rating: number
}

const localeMap: Record<Locale, string> = { en: "en-US", es: "es-CL", de: "de-DE" }
const copy = {
  en: { title: "Vineyard care", description: "Track pruning, fertilizing and irrigation activities.", logActivity: "Log activity", activities: "Activities", careLogs: "care logs recorded", totalCost: "Total cost", allActivities: "all activities", laborHours: "Labor hours", totalLabor: "total labor", fertilizer: "Fertilizer", applied: "kg applied", activityTitle: "Care activities", activityDescription: "Pruning, fertilizing and maintenance records.", empty: "No care activities logged yet.", loading: "Loading vineyard care…", method: "Method", amount: "Amount", irrigation: "Irrigation", effectiveness: "Effectiveness", hours: "hours", pruning: "Pruning", fertilizing: "Fertilizing", other: "Other", edit: "Edit care activity", delete: "Delete care activity" },
  es: { title: "Manejo del viñedo", description: "Registra poda, fertilización y riego del viñedo.", logActivity: "Registrar actividad", activities: "Actividades", careLogs: "registros de manejo", totalCost: "Costo total", allActivities: "todas las actividades", laborHours: "Horas de trabajo", totalLabor: "trabajo total", fertilizer: "Fertilizante", applied: "kg aplicados", activityTitle: "Actividades de manejo", activityDescription: "Registros de poda, fertilización y mantenimiento.", empty: "Aún no hay actividades de manejo registradas.", loading: "Cargando manejo del viñedo…", method: "Método", amount: "Cantidad", irrigation: "Riego", effectiveness: "Efectividad", hours: "horas", pruning: "Poda", fertilizing: "Fertilización", other: "Otro", edit: "Editar actividad de manejo", delete: "Eliminar actividad de manejo" },
  de: { title: "Weinbergpflege", description: "Schnitt, Düngung und Bewässerung des Weinbergs erfassen.", logActivity: "Aktivität erfassen", activities: "Aktivitäten", careLogs: "Pflegeeinträge", totalCost: "Gesamtkosten", allActivities: "alle Aktivitäten", laborHours: "Arbeitsstunden", totalLabor: "gesamter Arbeitsaufwand", fertilizer: "Düngemittel", applied: "kg ausgebracht", activityTitle: "Pflegeaktivitäten", activityDescription: "Einträge zu Schnitt, Düngung und Instandhaltung.", empty: "Noch keine Pflegeaktivitäten erfasst.", loading: "Weinbergpflege wird geladen…", method: "Methode", amount: "Menge", irrigation: "Bewässerung", effectiveness: "Wirksamkeit", hours: "Stunden", pruning: "Schnitt", fertilizing: "Düngung", other: "Sonstiges", edit: "Pflegeaktivität bearbeiten", delete: "Pflegeaktivität löschen" },
} as const

export default function VineyardCarePage() {
  const [careLogs, setCareLogs] = useState<CareLog[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language as Locale
  const text = copy[lang]
  const locale = localeMap[lang]

  useEffect(() => {
    const fetchCareLogs = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase.from("vineyard_care_logs").select("*").order("activity_date", { ascending: false })
        if (error) throw error
        setCareLogs(data || [])
      } catch (error) {
        console.error("[v0] Error fetching care logs:", error)
      } finally {
        setLoading(false)
      }
    }
    void fetchCareLogs()
  }, [supabase])

  const getCareTypeIcon = (type: string) => type === "pruning" ? <Scissors className="h-4 w-4" /> : type === "irrigation" ? <Droplet className="h-4 w-4" /> : <Leaf className="h-4 w-4" />
  const getCareTypeColor = (type: string) => type === "pruning" ? "bg-blue-100 text-blue-800" : type === "fertilizing" ? "bg-green-100 text-green-800" : type === "irrigation" ? "bg-cyan-100 text-cyan-800" : "bg-gray-100 text-gray-800"
  const careTypeLabel = (type: string) => type === "pruning" ? text.pruning : type === "fertilizing" ? text.fertilizing : type === "irrigation" ? text.irrigation : text.other
  const totalCost = careLogs.reduce((sum, log) => sum + (log.cost || 0), 0)
  const totalLaborHours = careLogs.reduce((sum, log) => sum + (log.labor_hours || 0), 0)
  const totalFertilizer = careLogs.reduce((sum, log) => sum + (log.fertilizer_amount_kg || 0), 0)
  const currency = new Intl.NumberFormat(locale, { style: "currency", currency: "CLP", maximumFractionDigits: 0 })
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" })

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">{text.loading}</p></div>

  return <div className="space-y-6">
    <PageHeader title={text.title} description={text.description} action={<Button className="gap-2"><Plus className="h-4 w-4" />{text.logActivity}</Button>} />
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <Metric title={text.activities} value={careLogs.length.toLocaleString(locale)} detail={text.careLogs} />
      <Metric title={text.totalCost} value={currency.format(totalCost)} detail={text.allActivities} />
      <Metric title={text.laborHours} value={number.format(totalLaborHours)} detail={text.totalLabor} />
      <Metric title={text.fertilizer} value={number.format(totalFertilizer)} detail={text.applied} />
    </div>
    <Card><CardHeader><CardTitle>{text.activityTitle}</CardTitle><CardDescription>{text.activityDescription}</CardDescription></CardHeader><CardContent>
      {careLogs.length === 0 ? <div className="py-8 text-center"><Leaf className="mx-auto mb-2 h-12 w-12 text-muted-foreground" /><p className="text-muted-foreground">{text.empty}</p></div> : <div className="space-y-4">{careLogs.map((log) => <div key={log.id} className="flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"><div className="flex-1 space-y-2">
        <div className="flex items-center gap-3"><Badge className={getCareTypeColor(log.care_type)}><span className="flex items-center gap-1">{getCareTypeIcon(log.care_type)}{careTypeLabel(log.care_type)}</span></Badge><span className="text-sm font-medium">{date.format(new Date(log.activity_date))}</span></div>
        {log.description ? <p className="text-sm text-muted-foreground">{log.description}</p> : null}
        <div className="grid grid-cols-2 gap-3 pt-2 text-sm md:grid-cols-5">
          {log.pruning_method ? <Info label={text.method} value={log.pruning_method} /> : null}
          {log.fertilizer_type ? <Info label={text.fertilizer} value={log.fertilizer_type} /> : null}
          {log.fertilizer_amount_kg > 0 ? <Info label={text.amount} value={`${number.format(log.fertilizer_amount_kg)} kg`} /> : null}
          {log.irrigation_mm > 0 ? <Info label={text.irrigation} value={`${number.format(log.irrigation_mm)} mm`} /> : null}
          <Info label={text.effectiveness} value={`${number.format(log.effectiveness_rating)}/10`} />
        </div>
        <div className="flex gap-4 pt-2 text-sm text-muted-foreground"><span className="flex items-center gap-1"><Clock className="h-4 w-4" />{number.format(log.labor_hours)} {text.hours}</span><span className="flex items-center gap-1"><DollarSign className="h-4 w-4" />{currency.format(log.cost || 0)}</span></div>
      </div><div className="flex gap-2"><Button size="sm" variant="outline" aria-label={text.edit}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="outline" className="text-destructive" aria-label={text.delete}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>}
    </CardContent></Card>
  </div>
}

function Metric({ title, value, detail }: { title: string; value: string; detail: string }) { return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div><p className="text-xs text-muted-foreground">{detail}</p></CardContent></Card> }
function Info({ label, value }: { label: string; value: string }) { return <div><span className="text-xs text-muted-foreground">{label}</span><p className="font-semibold">{value}</p></div> }

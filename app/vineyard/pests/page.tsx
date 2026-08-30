"use client"

import { useEffect, useMemo, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Bug, AlertTriangle, Calendar, DollarSign, Trash2, Pencil } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"

interface PestLog {
  id: string
  plot_id: string
  pest_disease_name: string
  detection_date: string
  severity_level: string
  affected_area_percent: number
  treatment_applied: string
  treatment_date: string
  active_ingredient: string
  dosage: string
  effectiveness_rating: number
  cost: number
  labor_hours: number
}

const localeMap: Record<Locale, string> = { en: "en-US", es: "es-CL", de: "de-DE" }
const copy = {
  en: { title: "Pest and disease management", description: "Track pest and disease incidents and treatments.", add: "Log issue", incidents: "Incidents", recorded: "recorded issues", active: "Active issues", last30: "last 30 days", cost: "Treatment cost", spent: "total spent", critical: "Critical", severe: "severe cases", section: "Pest and disease records", sectionDescription: "Recorded incidents and treatments.", empty: "No pest or disease records yet.", loading: "Loading pest records…", detected: "Detected", affected: "affected", treatment: "Treatment applied", method: "Method", ingredient: "Active ingredient", dosage: "Dosage", effectiveness: "Effectiveness", treated: "Treated", edit: "Edit incident", delete: "Delete incident", low: "Low", medium: "Medium", high: "High", unknown: "Unknown" },
  es: { title: "Manejo de plagas y enfermedades", description: "Registra incidencias fitosanitarias y sus tratamientos.", add: "Registrar incidencia", incidents: "Incidencias", recorded: "incidencias registradas", active: "Incidencias activas", last30: "últimos 30 días", cost: "Costo de tratamientos", spent: "gasto total", critical: "Críticas", severe: "casos graves", section: "Registro fitosanitario", sectionDescription: "Incidencias y tratamientos registrados.", empty: "Aún no hay incidencias fitosanitarias registradas.", loading: "Cargando incidencias…", detected: "Detectada", affected: "afectado", treatment: "Tratamiento aplicado", method: "Método", ingredient: "Ingrediente activo", dosage: "Dosis", effectiveness: "Efectividad", treated: "Tratada", edit: "Editar incidencia", delete: "Eliminar incidencia", low: "Baja", medium: "Media", high: "Alta", unknown: "Desconocida" },
  de: { title: "Schädlings- und Krankheitsmanagement", description: "Schädlings- und Krankheitsfälle sowie Behandlungen erfassen.", add: "Fall erfassen", incidents: "Fälle", recorded: "erfasste Fälle", active: "Aktive Fälle", last30: "letzte 30 Tage", cost: "Behandlungskosten", spent: "Gesamtausgaben", critical: "Kritisch", severe: "schwere Fälle", section: "Schädlings- und Krankheitsfälle", sectionDescription: "Erfasste Fälle und Behandlungen.", empty: "Noch keine Schädlings- oder Krankheitsfälle erfasst.", loading: "Fälle werden geladen…", detected: "Erkannt", affected: "betroffen", treatment: "Behandlung", method: "Methode", ingredient: "Wirkstoff", dosage: "Dosierung", effectiveness: "Wirksamkeit", treated: "Behandelt", edit: "Fall bearbeiten", delete: "Fall löschen", low: "Niedrig", medium: "Mittel", high: "Hoch", unknown: "Unbekannt" },
} as const

export default function VineyardPestsPage() {
  const [pestLogs, setPestLogs] = useState<PestLog[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language as Locale
  const text = copy[lang]
  const locale = localeMap[lang]
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" })
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const currency = new Intl.NumberFormat(locale, { style: "currency", currency: "CLP", maximumFractionDigits: 0 })

  useEffect(() => {
    const fetchPestLogs = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase.from("vineyard_pest_logs").select("*").order("detection_date", { ascending: false })
        if (error) throw error
        setPestLogs(data || [])
      } catch (error) {
        console.error("[v0] Error fetching pest logs:", error)
      } finally {
        setLoading(false)
      }
    }
    void fetchPestLogs()
  }, [supabase])

  const severityColor = (severity: string) => severity === "critical" ? "bg-red-100 text-red-800" : severity === "high" ? "bg-orange-100 text-orange-800" : severity === "medium" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"
  const severityLabel = (severity: string) => severity === "critical" ? text.critical : severity === "high" ? text.high : severity === "medium" ? text.medium : severity === "low" ? text.low : text.unknown
  const totalCost = pestLogs.reduce((sum, log) => sum + (log.cost || 0), 0)
  const activePests = pestLogs.filter((log) => !log.treatment_date || new Date(log.treatment_date) > new Date(Date.now() - 30 * 86400000)).length

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">{text.loading}</p></div>

  return <div className="space-y-6">
    <PageHeader title={text.title} description={text.description} action={<Button className="gap-2"><Plus className="h-4 w-4" />{text.add}</Button>} />
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <Metric title={text.incidents} value={pestLogs.length.toLocaleString(locale)} detail={text.recorded} />
      <Metric title={text.active} value={activePests.toLocaleString(locale)} detail={text.last30} />
      <Metric title={text.cost} value={currency.format(totalCost)} detail={text.spent} />
      <Metric title={text.critical} value={pestLogs.filter((log) => log.severity_level === "critical").length.toLocaleString(locale)} detail={text.severe} />
    </div>
    <Card><CardHeader><CardTitle>{text.section}</CardTitle><CardDescription>{text.sectionDescription}</CardDescription></CardHeader><CardContent>
      {pestLogs.length === 0 ? <div className="py-8 text-center"><Bug className="mx-auto mb-2 h-12 w-12 text-muted-foreground" /><p className="text-muted-foreground">{text.empty}</p></div> : <div className="space-y-4">{pestLogs.map((log) => <div key={log.id} className="flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"><div className="flex-1 space-y-2">
        <div className="flex items-center gap-3"><h3 className="font-semibold">{log.pest_disease_name}</h3><Badge className={severityColor(log.severity_level)}>{severityLabel(log.severity_level)}</Badge></div>
        <div className="flex gap-4 text-sm text-muted-foreground"><span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{text.detected}: {date.format(new Date(log.detection_date))}</span><span className="flex items-center gap-1"><AlertTriangle className="h-4 w-4" />{number.format(log.affected_area_percent)}% {text.affected}</span></div>
        {log.treatment_applied ? <div className="border-t pt-2"><p className="mb-1 text-xs font-medium text-muted-foreground">{text.treatment}</p><div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4"><Info label={text.method} value={log.treatment_applied} />{log.active_ingredient ? <Info label={text.ingredient} value={log.active_ingredient} /> : null}{log.dosage ? <Info label={text.dosage} value={log.dosage} /> : null}<Info label={text.effectiveness} value={`${number.format(log.effectiveness_rating)}/10`} /></div></div> : null}
        <div className="flex gap-4 pt-2 text-sm text-muted-foreground">{log.treatment_date ? <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{text.treated}: {date.format(new Date(log.treatment_date))}</span> : null}{log.cost > 0 ? <span className="flex items-center gap-1"><DollarSign className="h-4 w-4" />{currency.format(log.cost)}</span> : null}</div>
      </div><div className="flex gap-2"><Button size="sm" variant="outline" aria-label={text.edit}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="outline" className="text-destructive" aria-label={text.delete}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>}
    </CardContent></Card>
  </div>
}

function Metric({ title, value, detail }: { title: string; value: string; detail: string }) { return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div><p className="text-xs text-muted-foreground">{detail}</p></CardContent></Card> }
function Info({ label, value }: { label: string; value: string }) { return <div><span className="text-xs text-muted-foreground">{label}</span><p className="font-semibold">{value}</p></div> }

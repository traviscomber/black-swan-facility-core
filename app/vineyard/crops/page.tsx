"use client"

import { useEffect, useMemo, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Grape, TrendingUp, Trash2, Pencil, Search, Calendar } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"

interface Vine {
  id: string
  plot_id: string
  vine_number: string
  variety: string
  rootstock: string
  age_years: number
  health_status: string
  disease_history: string
  last_pruned_date: string
  grafted_year: number
  photo_url: string
  position_row: number
  position_col: number
  notes: string
}

interface Plot { id: string; name: string }

const localeMap: Record<Locale, string> = { en: "en-US", es: "es-CL", de: "de-DE" }
const copy = {
  en: { title: "Vine management", description: "Track individual vines, varieties and health.", add: "Add vine", total: "Total vines", all: "all vines", productive: "Productive", productiveHelp: "over 3 years old", healthy: "Healthy", healthyHelp: "in good condition", attention: "Needs attention", attentionHelp: "maintenance required", search: "Search vines…", filterPlot: "Filter by plot", allPlots: "All plots", section: "Vines", of: "of", empty: "No vines found.", unknownPlot: "Unknown plot", plot: "Plot", age: "Age", years: "years", grafted: "Grafted", lastPruned: "Last pruned", variety: "Variety", rootstock: "Rootstock", disease: "Disease history", none: "None", position: "Position", row: "Row", col: "Col", never: "Never", today: "Today", daysAgo: (days: number) => `${days} days ago`, loading: "Loading vines…", edit: "Edit vine", delete: "Delete vine", stressed: "Stressed", diseased: "Diseased", recovering: "Recovering", other: "Other" },
  es: { title: "Manejo de vides", description: "Controla vides individuales, variedades y estado sanitario.", add: "Agregar vid", total: "Total de vides", all: "vides registradas", productive: "Productivas", productiveHelp: "más de 3 años", healthy: "Sanas", healthyHelp: "en buen estado", attention: "Requieren atención", attentionHelp: "requieren manejo", search: "Buscar vides…", filterPlot: "Filtrar por cuartel", allPlots: "Todos los cuarteles", section: "Vides", of: "de", empty: "No se encontraron vides.", unknownPlot: "Cuartel desconocido", plot: "Cuartel", age: "Edad", years: "años", grafted: "Injertada", lastPruned: "Última poda", variety: "Variedad", rootstock: "Portainjerto", disease: "Historial sanitario", none: "Sin registros", position: "Posición", row: "Fila", col: "Col.", never: "Nunca", today: "Hoy", daysAgo: (days: number) => `hace ${days} días`, loading: "Cargando vides…", edit: "Editar vid", delete: "Eliminar vid", stressed: "Estresada", diseased: "Enferma", recovering: "En recuperación", other: "Otro" },
  de: { title: "Rebenmanagement", description: "Einzelne Reben, Sorten und Gesundheitszustand verwalten.", add: "Rebe hinzufügen", total: "Reben gesamt", all: "erfasste Reben", productive: "Ertragsfähig", productiveHelp: "älter als 3 Jahre", healthy: "Gesund", healthyHelp: "in gutem Zustand", attention: "Handlungsbedarf", attentionHelp: "Pflege erforderlich", search: "Reben suchen…", filterPlot: "Nach Parzelle filtern", allPlots: "Alle Parzellen", section: "Reben", of: "von", empty: "Keine Reben gefunden.", unknownPlot: "Unbekannte Parzelle", plot: "Parzelle", age: "Alter", years: "Jahre", grafted: "Veredelt", lastPruned: "Letzter Schnitt", variety: "Sorte", rootstock: "Unterlage", disease: "Krankheitshistorie", none: "Keine Einträge", position: "Position", row: "Reihe", col: "Spalte", never: "Nie", today: "Heute", daysAgo: (days: number) => `vor ${days} Tagen`, loading: "Reben werden geladen…", edit: "Rebe bearbeiten", delete: "Rebe löschen", stressed: "Gestresst", diseased: "Erkrankt", recovering: "In Erholung", other: "Sonstiges" },
} as const

export default function VineyardVinesPage() {
  const [vines, setVines] = useState<Vine[]>([])
  const [plots, setPlots] = useState<Plot[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterPlot, setFilterPlot] = useState("all")
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language as Locale
  const text = copy[lang]
  const locale = localeMap[lang]

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [plotsResult, vinesResult] = await Promise.all([
          supabase.from("vineyard_plots").select("id, name").order("name", { ascending: true }),
          supabase.from("vineyard_vines").select("*").order("created_at", { ascending: false }),
        ])
        if (plotsResult.error) throw plotsResult.error
        if (vinesResult.error) throw vinesResult.error
        setPlots(plotsResult.data || [])
        setVines(vinesResult.data || [])
      } catch (error) {
        console.error("[v0] Error fetching vines data:", error)
      } finally {
        setLoading(false)
      }
    }
    void fetchData()
  }, [supabase])

  const filteredVines = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return vines.filter((vine) => {
      const matchesSearch = !term || vine.vine_number.toLowerCase().includes(term) || vine.variety.toLowerCase().includes(term) || vine.rootstock.toLowerCase().includes(term)
      return matchesSearch && (filterPlot === "all" || vine.plot_id === filterPlot)
    })
  }, [filterPlot, searchTerm, vines])

  const statusColor = (health: string) => ({ healthy: "bg-green-100 text-green-800", stressed: "bg-yellow-100 text-yellow-800", diseased: "bg-red-100 text-red-800", recovering: "bg-blue-100 text-blue-800" }[health] || "bg-gray-100 text-gray-800")
  const statusLabel = (health: string) => health === "healthy" ? text.healthy : health === "stressed" ? text.stressed : health === "diseased" ? text.diseased : health === "recovering" ? text.recovering : text.other
  const plotName = (plotId: string) => plots.find((plot) => plot.id === plotId)?.name || text.unknownPlot
  const daysSincePruning = (value: string) => {
    if (!value) return text.never
    const diff = Math.floor((Date.now() - new Date(value).getTime()) / 86400000)
    return diff > 0 ? text.daysAgo(diff) : text.today
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">{text.loading}</p></div>

  return <div className="space-y-6">
    <PageHeader title={text.title} description={text.description} actions={<Button><Plus className="mr-2 h-4 w-4" />{text.add}</Button>} />
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <Metric icon={<Grape className="h-4 w-4" />} title={text.total} value={vines.length.toLocaleString(locale)} detail={text.all} />
      <Metric icon={<TrendingUp className="h-4 w-4" />} title={text.productive} value={vines.filter((vine) => vine.age_years > 3).length.toLocaleString(locale)} detail={text.productiveHelp} />
      <Metric icon={<Grape className="h-4 w-4" />} title={text.healthy} value={vines.filter((vine) => vine.health_status === "healthy").length.toLocaleString(locale)} detail={text.healthyHelp} />
      <Metric icon={<Calendar className="h-4 w-4" />} title={text.attention} value={vines.filter((vine) => vine.health_status !== "healthy").length.toLocaleString(locale)} detail={text.attentionHelp} />
    </div>
    <div className="space-y-4 rounded-lg border border-secondary bg-card p-4"><div className="grid gap-4 md:grid-cols-3"><Input placeholder={text.search} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="bg-background" icon={<Search className="h-4 w-4" />} /><Select value={filterPlot} onValueChange={setFilterPlot}><SelectTrigger className="bg-background"><SelectValue placeholder={text.filterPlot} /></SelectTrigger><SelectContent><SelectItem value="all">{text.allPlots}</SelectItem>{plots.map((plot) => <SelectItem key={plot.id} value={plot.id}>{plot.name}</SelectItem>)}</SelectContent></Select></div></div>
    <Card><CardHeader><CardTitle>{text.section}</CardTitle><CardDescription>{filteredVines.length.toLocaleString(locale)} {text.of} {vines.length.toLocaleString(locale)}</CardDescription></CardHeader><CardContent>
      {filteredVines.length === 0 ? <div className="py-8 text-center text-muted-foreground">{text.empty}</div> : <div className="space-y-3">{filteredVines.map((vine) => <div key={vine.id} className="rounded-lg border p-4 transition-colors hover:bg-accent/5"><div className="flex items-start justify-between"><div className="flex-1"><div className="mb-2 flex items-center gap-3"><div><h3 className="text-lg font-semibold">{vine.vine_number}</h3><p className="text-sm text-muted-foreground">{vine.variety} • {vine.rootstock}</p></div><Badge className={statusColor(vine.health_status)}>{statusLabel(vine.health_status)}</Badge></div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4"><Info label={text.plot} value={plotName(vine.plot_id)} /><Info label={text.age} value={`${vine.age_years.toLocaleString(locale)} ${text.years}`} /><Info label={text.grafted} value={String(vine.grafted_year)} /><Info label={text.lastPruned} value={daysSincePruning(vine.last_pruned_date)} /></div>
        <div className="mt-2 grid grid-cols-2 gap-3 text-sm md:grid-cols-4"><Info label={text.variety} value={vine.variety} /><Info label={text.rootstock} value={vine.rootstock} /><Info label={text.disease} value={vine.disease_history || text.none} /><Info label={text.position} value={`${text.row} ${vine.position_row.toLocaleString(locale)}, ${text.col} ${vine.position_col.toLocaleString(locale)}`} /></div>
      </div><div className="ml-4 flex gap-2"><Button variant="ghost" size="sm" aria-label={text.edit}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="sm" aria-label={text.delete}><Trash2 className="h-4 w-4" /></Button></div></div></div>)}</div>}
    </CardContent></Card>
  </div>
}

function Metric({ icon, title, value, detail }: { icon: React.ReactNode; title: string; value: string; detail: string }) { return <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">{icon}{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{value}</div><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card> }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value}</p></div> }

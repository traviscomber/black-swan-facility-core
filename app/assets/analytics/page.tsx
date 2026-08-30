"use client"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import type { Asset } from "@/lib/types"
import { useEffect, useMemo, useState } from "react"
import { AlertCircle, CheckCircle, Clock, Zap } from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"
const localeMap: Record<Locale, string> = { en: "en-US", es: "es-CL", de: "de-DE" }
const copy = {
  en: { title: "Asset analytics", description: "Operational asset distribution, audit exposure and upcoming maintenance.", total: "Total assets", active: "active facilities", critical: "Critical assets", ofTotal: "of total", overdue: "Audits overdue", overdueAssets: "overdue assets", maintenanceDue: "Maintenance due", pending: "pending tasks", byType: "Assets by type", distribution: "Distribution of registered assets.", upcoming: "Upcoming maintenance tasks", upcomingDescription: "Next scheduled maintenance activities.", status: "Status", empty: "No maintenance tasks scheduled." },
  es: { title: "Analítica de activos", description: "Distribución operativa de activos, exposición de auditoría y próximas mantenciones.", total: "Total de activos", active: "instalaciones activas", critical: "Activos críticos", ofTotal: "del total", overdue: "Auditorías vencidas", overdueAssets: "activos vencidos", maintenanceDue: "Mantenciones próximas", pending: "tareas pendientes", byType: "Activos por tipo", distribution: "Distribución de activos registrados.", upcoming: "Próximas mantenciones", upcomingDescription: "Siguientes actividades de mantención programadas.", status: "Estado", empty: "No hay tareas de mantención programadas." },
  de: { title: "Anlagenanalyse", description: "Betriebliche Anlagenverteilung, Audit-Risiken und anstehende Wartung.", total: "Anlagen gesamt", active: "aktive Einrichtungen", critical: "Kritische Anlagen", ofTotal: "des Gesamtbestands", overdue: "Überfällige Audits", overdueAssets: "überfällige Anlagen", maintenanceDue: "Wartung fällig", pending: "offene Aufgaben", byType: "Anlagen nach Typ", distribution: "Verteilung der erfassten Anlagen.", upcoming: "Anstehende Wartungsaufgaben", upcomingDescription: "Nächste geplante Wartungsarbeiten.", status: "Status", empty: "Keine Wartungsaufgaben geplant." },
} as const

export default function AssetsAnalyticsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [assetsByType, setAssetsByType] = useState<Record<string, number>>({})
  const [maintenanceTasks, setMaintenanceTasks] = useState<any[]>([])
  const { language } = useLanguage()
  const lang = language as Locale
  const text = copy[lang]
  const locale = localeMap[lang]
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" })

  useEffect(() => {
    const loadData = async () => {
      const supabase = createBrowserClient()
      const { data: assetsData } = await supabase.from("assets").select("*")
      if (assetsData) {
        setAssets(assetsData)
        const typeCount: Record<string, number> = {}
        assetsData.forEach((asset: Asset) => { typeCount[asset.type] = (typeCount[asset.type] || 0) + 1 })
        setAssetsByType(typeCount)
      }
      const { data: tasksData } = await supabase.from("maintenance_tasks").select("*, assets(name)").order("next_run", { ascending: true })
      if (tasksData) setMaintenanceTasks(tasksData)
      setLoading(false)
    }
    void loadData()
  }, [])

  const totalAssets = assets.length
  const criticalAssets = assets.filter((asset) => asset.is_critical).length
  const auditOverdueCount = assets.filter((asset) => !asset.last_audit_date || new Date(asset.last_audit_date).getTime() < Date.now() - 90 * 86400000).length
  const auditOverduePercentage = totalAssets > 0 ? Math.round((auditOverdueCount / totalAssets) * 100) : 0
  const upcomingMaintenanceCount = maintenanceTasks.filter((task) => task.status === "pending").length
  const typeRows = useMemo(() => Object.entries(assetsByType).sort(([, a], [, b]) => b - a), [assetsByType])

  return <AppLayout><PageHeader title={text.title} description={text.description} /><div className="space-y-6 p-8">
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Metric icon={<Zap className="h-4 w-4" />} title={text.total} value={totalAssets.toLocaleString(locale)} detail={text.active} />
      <Metric icon={<AlertCircle className="h-4 w-4 text-red-500" />} title={text.critical} value={criticalAssets.toLocaleString(locale)} detail={`${totalAssets > 0 ? Math.round((criticalAssets / totalAssets) * 100).toLocaleString(locale) : "0"}% ${text.ofTotal}`} />
      <Metric icon={<Clock className="h-4 w-4 text-yellow-500" />} title={text.overdue} value={`${auditOverduePercentage.toLocaleString(locale)}%`} detail={`${auditOverdueCount.toLocaleString(locale)} ${text.overdueAssets}`} />
      <Metric icon={<CheckCircle className="h-4 w-4 text-blue-500" />} title={text.maintenanceDue} value={upcomingMaintenanceCount.toLocaleString(locale)} detail={text.pending} />
    </div>
    <Card><CardHeader><CardTitle>{text.byType}</CardTitle><CardDescription>{text.distribution}</CardDescription></CardHeader><CardContent><div className="space-y-4">{typeRows.map(([type, count]) => <div key={type} className="flex items-center justify-between"><span className="text-sm font-medium">{type}</span><div className="flex items-center gap-2"><div className="h-2 w-48 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: `${totalAssets ? (count / totalAssets) * 100 : 0}%` }} /></div><span className="w-16 text-right text-sm text-muted-foreground">{count.toLocaleString(locale)} ({totalAssets ? Math.round((count / totalAssets) * 100).toLocaleString(locale) : "0"}%)</span></div></div>)}</div></CardContent></Card>
    <Card><CardHeader><CardTitle>{text.upcoming}</CardTitle><CardDescription>{text.upcomingDescription}</CardDescription></CardHeader><CardContent>{maintenanceTasks.length ? <div className="space-y-3">{maintenanceTasks.slice(0, 10).map((task) => <div key={task.id} className="flex items-start justify-between rounded-lg bg-secondary/50 p-3"><div><p className="text-sm font-medium">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.assets?.name || "—"} • {text.status}: {task.status}</p></div><p className="text-sm font-medium">{task.next_run ? date.format(new Date(task.next_run)) : "—"}</p></div>)}</div> : <p className="text-sm text-muted-foreground">{loading ? "…" : text.empty}</p>}</CardContent></Card>
  </div></AppLayout>
}

function Metric({ icon, title, value, detail }: { icon: React.ReactNode; title: string; value: string; detail: string }) { return <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">{icon}{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{value}</div><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card> }

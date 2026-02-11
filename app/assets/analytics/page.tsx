"use client"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import type { Asset } from "@/lib/types"
import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle, Clock, Zap } from "lucide-react"
import { useLanguage } from "@/lib/language-context-client"

export default function AssetsAnalyticsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [assetsByType, setAssetsByType] = useState<Record<string, number>>({})
  const [maintenanceTasks, setMaintenanceTasks] = useState<any[]>([])
  const { t } = useLanguage()

  const loadData = async () => {
    const supabase = createBrowserClient()

    // Load assets
    const { data: assetsData } = await supabase.from("assets").select("*")
    if (assetsData) {
      setAssets(assetsData)

      // Calculate assets by type
      const typeCount: Record<string, number> = {}
      assetsData.forEach((asset: Asset) => {
        typeCount[asset.type] = (typeCount[asset.type] || 0) + 1
      })
      setAssetsByType(typeCount)
    }

    // Load maintenance tasks
    const { data: tasksData } = await supabase
      .from("maintenance_tasks")
      .select("*, assets(name)")
      .order("next_run", { ascending: true })

    if (tasksData) {
      setMaintenanceTasks(tasksData)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  // Calculate KPIs
  const totalAssets = assets.length
  const criticalAssets = assets.filter((a) => a.is_critical).length
  const auditOverdueCount = assets.filter(
    (a) =>
      !a.last_audit_date ||
      new Date(a.last_audit_date).getTime() < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).getTime(),
  ).length
  const auditOverduePercentage = totalAssets > 0 ? Math.round((auditOverdueCount / totalAssets) * 100) : 0
  const upcomingMaintenanceCount = maintenanceTasks.filter((t) => t.status === "pending").length

  return (
    <AppLayout>
      <PageHeader
        title={t("assets.analytics_title")}
        description={t("assets.analytics_description")}
      />

      <div className="p-8 space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4" />
                {t("assets.total_assets")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalAssets}</div>
              <p className="text-xs text-muted-foreground mt-1">{t("assets.active_facilities")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                {t("assets.critical_assets")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{criticalAssets}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalAssets > 0 ? ((criticalAssets / totalAssets) * 100).toFixed(0) : 0}% {t("assets.of_total")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                {t("assets.audits_overdue")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{auditOverduePercentage}%</div>
              <p className="text-xs text-muted-foreground mt-1">{auditOverdueCount} {t("assets.overdue_assets")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-500" />
                {t("assets.maintenance_due")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{upcomingMaintenanceCount}</div>
              <p className="text-xs text-muted-foreground mt-1">{t("assets.pending_tasks")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Assets by Type */}
        <Card>
          <CardHeader>
            <CardTitle>{t("assets.by_type")}</CardTitle>
            <CardDescription>{t("assets.type_distribution")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(assetsByType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{type}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-48 h-2 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${(count / totalAssets) * 100}%` }} />
                      </div>
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {count} ({((count / totalAssets) * 100).toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Maintenance */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Maintenance Tasks</CardTitle>
            <CardDescription>Next scheduled maintenance activities</CardDescription>
          </CardHeader>
          <CardContent>
            {maintenanceTasks.length > 0 ? (
              <div className="space-y-3">
                {maintenanceTasks.slice(0, 10).map((task) => (
                  <div key={task.id} className="flex items-start justify-between p-3 bg-secondary/50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {task.assets?.name} • Status: {task.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {task.next_run ? new Date(task.next_run).toLocaleDateString() : "-"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No maintenance tasks scheduled</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

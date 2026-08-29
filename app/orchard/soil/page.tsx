"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Droplet } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

interface SoilAmendment {
  id: string
  plot_id: string
  amendment_type: string
  product_name: string
  quantity_kg: number
  application_date: string
  npk_ratio: string
  application_method: string
  description: string
}

interface Plot {
  id: string
  name: string
}

export default function OrchardSoilPage() {
  const [amendments, setAmendments] = useState<SoilAmendment[]>([])
  const [plots, setPlots] = useState<Plot[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()
  const { t } = useLanguage()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data: amendmentData } = await supabase
        .from("orchard_soil_amendments")
        .select("*")
        .order("application_date", { ascending: false })

      const { data: plotsData } = await supabase
        .from("orchard_plots")
        .select("id, name")

      setAmendments(amendmentData || [])
      setPlots(plotsData || [])
    } catch (error) {
      console.error("[v0] Error fetching soil data:", error)
    } finally {
      setLoading(false)
    }
  }

  const getPlotName = (plotId: string) => {
    return plots.find((p) => p.id === plotId)?.name || t("orchard.unknown")
  }

  const totalKg = amendments.reduce((sum, a) => sum + a.quantity_kg, 0)

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">{t("orchard.loading")}</p>
      </div>
    </AppLayout>
  )
}

  return (
    <AppLayout>
      <OrchardNavigation />
      <div className="space-y-6">
        <PageHeader
          title={t("orchard.soil_amendments")}
          description={t("orchard.soil_description")}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("orchard.total_amendments")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{amendments.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("orchard.total_applied")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalKg.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">{t("orchard.unit_kg")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("orchard.amendment_types")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {new Set(amendments.map((a) => a.amendment_type)).size}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("orchard.soil_amendments")}</CardTitle>
            <CardDescription>{t("orchard.soil_enhancement")}</CardDescription>
          </CardHeader>
          <CardContent>
            {amendments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">{t("orchard.no_amendments")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {amendments.map((amendment) => (
                  <div
                    key={amendment.id}
                    className="border rounded-lg p-4 hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{amendment.product_name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {amendment.amendment_type}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Plot</p>
                          <p className="font-semibold">{getPlotName(amendment.plot_id)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Applied</p>
                          <p className="font-semibold">
                            {new Date(amendment.application_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Quantity</p>
                          <p className="font-semibold">{amendment.quantity_kg} kg</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">NPK Ratio</p>
                          <p className="font-semibold">{amendment.npk_ratio}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Method</p>
                          <p className="font-semibold text-xs">{amendment.application_method}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Heart, AlertCircle, Leaf, Calendar, Trash2, Pencil, Image as ImageIcon } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

interface Vine {
  id: string
  plot_id: string
  vine_number: string
  variety: string
  age_years: number
  health_status: string
  last_pruned_date: string
  rootstock: string
  grafted_year: number
  disease_history: string
  photo_url: string
}

export default function VineyardCropsPage() {
  const [vines, setVines] = useState<Vine[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()
  const { t } = useLanguage()

  useEffect(() => {
    fetchVines()
  }, [])

  const fetchVines = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("vineyard_vines")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      setVines(data || [])
    } catch (error) {
      console.error("[v0] Error fetching vines:", error)
    } finally {
      setLoading(false)
    }
  }

  const getHealthColor = (status: string) => {
    if (status === "healthy") return "bg-green-100 text-green-800"
    if (status === "diseased") return "bg-red-100 text-red-800"
    if (status === "stressed") return "bg-yellow-100 text-yellow-800"
    return "bg-gray-100 text-gray-800"
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">{t("vineyard.loading")}</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title={t("vineyard.vines") || "Vine Management"}
          description={t("vineyard.vines_description") || "Monitor individual vine health and properties"}
          action={
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              {t("vineyard.add_vine") || "Add Vine"}
            </Button>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.total_vines") || "Total Vines"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vines.length}</div>
              <p className="text-xs text-muted-foreground">Across all plots</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.healthy") || "Healthy"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {vines.filter(v => v.health_status === "healthy").length}
              </div>
              <p className="text-xs text-muted-foreground">In good condition</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.diseased") || "Diseased"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {vines.filter(v => v.health_status === "diseased").length}
              </div>
              <p className="text-xs text-muted-foreground">Needs treatment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.avg_age") || "Average Age"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {vines.length > 0 ? (vines.reduce((sum, v) => sum + (v.age_years || 0), 0) / vines.length).toFixed(1) : 0}
              </div>
              <p className="text-xs text-muted-foreground">years</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("vineyard.vines_list") || "All Vines"}</CardTitle>
            <CardDescription>{t("vineyard.vines_list_description") || "Track health status and maintenance history"}</CardDescription>
          </CardHeader>
          <CardContent>
            {vines.length === 0 ? (
              <div className="text-center py-8">
                <Leaf className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">{t("vineyard.no_vines") || "No vines recorded yet"}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {vines.map((vine) => (
                  <div
                    key={vine.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex gap-4 flex-1">
                      {vine.photo_url ? (
                        <img
                          src={vine.photo_url}
                          alt={vine.vine_number}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{vine.vine_number}</h3>
                          <Badge className={getHealthColor(vine.health_status)}>
                            {vine.health_status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{vine.variety}</p>
                        <div className="flex gap-4 text-sm text-muted-foreground pt-2">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {vine.age_years} years old
                          </div>
                          <div className="flex items-center gap-1">
                            <Leaf className="w-4 h-4" />
                            Rootstock: {vine.rootstock}
                          </div>
                          {vine.last_pruned_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              Last pruned: {new Date(vine.last_pruned_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        {vine.disease_history && (
                          <div className="flex items-center gap-1 pt-2 text-sm text-orange-600">
                            <AlertCircle className="w-4 h-4" />
                            {vine.disease_history}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
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

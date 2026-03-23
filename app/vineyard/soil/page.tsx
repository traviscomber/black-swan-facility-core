"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Droplet, Leaf, Beaker, Calendar, DollarSign, TrendingUp, Trash2, Pencil } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

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

export default function VineyardSoilPage() {
  const [amendments, setAmendments] = useState<SoilAmendment[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()
  const { t } = useLanguage()

  useEffect(() => {
    fetchAmendments()
  }, [])

  const fetchAmendments = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("vineyard_soil_amendments")
        .select("*")
        .order("application_date", { ascending: false })

      if (error) throw error
      setAmendments(data || [])
    } catch (error) {
      console.error("[v0] Error fetching soil amendments:", error)
    } finally {
      setLoading(false)
    }
  }

  const getAmendmentTypeColor = (type: string) => {
    if (type === "fertilizer") return "bg-green-100 text-green-800"
    if (type === "organic_matter") return "bg-amber-100 text-amber-800"
    if (type === "ph_adjustment") return "bg-blue-100 text-blue-800"
    if (type === "mulch") return "bg-orange-100 text-orange-800"
    return "bg-gray-100 text-gray-800"
  }

  const totalCost = amendments.reduce((sum, a) => sum + (a.cost || 0), 0)
  const totalQuantity = amendments.reduce((sum, a) => sum + (a.quantity_kg || 0), 0)
  const totalNitrogen = amendments.reduce((sum, a) => sum + ((a.quantity_kg || 0) * (a.nitrogen_percent || 0) / 100), 0)
  const avgPhAdjustment = amendments.length > 0 ? (amendments.reduce((sum, a) => sum + (a.ph_adjustment || 0), 0) / amendments.length).toFixed(2) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">{t("vineyard.loading")}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
        <PageHeader
          title={t("vineyard.soil") || "Soil Management"}
          description={t("vineyard.soil_description") || "Track soil amendments and nutrient management"}
          action={
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              {t("vineyard.add_amendment") || "Add Amendment"}
            </Button>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.amendments") || "Amendments"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{amendments.length}</div>
              <p className="text-xs text-muted-foreground">Total applications</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.total_amount") || "Total Amount"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(totalQuantity / 1000).toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">metric tons</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.amendment_cost") || "Cost"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalCost.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground">Total spent</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.nitrogen") || "Nitrogen Added"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalNitrogen.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground">kg</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("vineyard.amendments_log") || "Soil Amendments"}</CardTitle>
            <CardDescription>{t("vineyard.amendments_log_description") || "View all soil amendments and nutrient applications"}</CardDescription>
          </CardHeader>
          <CardContent>
            {amendments.length === 0 ? (
              <div className="text-center py-8">
                <Leaf className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">{t("vineyard.no_amendments") || "No soil amendments recorded yet"}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {amendments.map((amendment) => (
                  <div
                    key={amendment.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="px-2 py-1 rounded text-xs font-medium"
                          style={{
                            backgroundColor: amendment.amendment_type === "fertilizer" ? "#d1fae5" : 
                                           amendment.amendment_type === "organic_matter" ? "#fed7aa" :
                                           amendment.amendment_type === "ph_adjustment" ? "#bfdbfe" : "#f3f4f6",
                            color: amendment.amendment_type === "fertilizer" ? "#065f46" :
                                   amendment.amendment_type === "organic_matter" ? "#92400e" :
                                   amendment.amendment_type === "ph_adjustment" ? "#1e40af" : "#374151"
                          }}>
                          {amendment.amendment_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </div>
                        <span className="font-semibold">{amendment.material_name}</span>
                      </div>

                      <div className="flex gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(amendment.application_date).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Beaker className="w-4 h-4" />
                          {amendment.quantity_kg} kg
                        </div>
                        {amendment.application_method && (
                          <div className="flex items-center gap-1">
                            <Droplet className="w-4 h-4" />
                            {amendment.application_method}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm pt-2">
                        {amendment.nitrogen_percent > 0 && (
                          <div>
                            <span className="text-muted-foreground text-xs">Nitrogen</span>
                            <p className="font-semibold">{amendment.nitrogen_percent}%</p>
                          </div>
                        )}
                        {amendment.phosphorus_percent > 0 && (
                          <div>
                            <span className="text-muted-foreground text-xs">Phosphorus</span>
                            <p className="font-semibold">{amendment.phosphorus_percent}%</p>
                          </div>
                        )}
                        {amendment.potassium_percent > 0 && (
                          <div>
                            <span className="text-muted-foreground text-xs">Potassium</span>
                            <p className="font-semibold">{amendment.potassium_percent}%</p>
                          </div>
                        )}
                        {amendment.organic_matter_percent > 0 && (
                          <div>
                            <span className="text-muted-foreground text-xs">Organic Matter</span>
                            <p className="font-semibold">{amendment.organic_matter_percent}%</p>
                          </div>
                        )}
                        {amendment.ph_adjustment !== 0 && (
                          <div>
                            <span className="text-muted-foreground text-xs">pH Adjustment</span>
                            <p className="font-semibold">{amendment.ph_adjustment > 0 ? '+' : ''}{amendment.ph_adjustment}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground text-xs">Cost</span>
                          <p className="font-semibold">${amendment.cost}</p>
                        </div>
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
    )
  }
}

"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, TrendingUp } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

interface HarvestRecord {
  id: string
  crop_id: string
  harvest_date: string
  harvest_quantity: number
  quality_rating: number
  storage_method: string
  shelf_life_days: number
  market_value: number
}

interface Crop {
  id: string
  crop_name: string
}

export default function OrchardHarvestPage() {
  const [harvests, setHarvests] = useState<HarvestRecord[]>([])
  const [crops, setCrops] = useState<Crop[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()
  const { t } = useLanguage()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data: harvestData } = await supabase
        .from("orchard_harvest_records")
        .select("*")
        .order("harvest_date", { ascending: false })

      const { data: cropsData } = await supabase
        .from("orchard_crops")
        .select("id, crop_name")

      setHarvests(harvestData || [])
      setCrops(cropsData || [])
    } catch (error) {
      console.error("[v0] Error fetching harvest records:", error)
    } finally {
      setLoading(false)
    }
  }

  const getCropName = (cropId: string) => {
    return crops.find((c) => c.id === cropId)?.crop_name || t("orchard.unknown")
  }

  const getQualityColor = (rating: number) => {
    if (rating >= 4) return "bg-green-100 text-green-800"
    if (rating >= 3) return "bg-yellow-100 text-yellow-800"
    return "bg-red-100 text-red-800"
  }

  const totalYield = harvests.reduce((sum, h) => sum + h.harvest_quantity, 0)
  const totalValue = harvests.reduce((sum, h) => sum + h.market_value, 0)
  const avgQuality = harvests.length > 0 ? (harvests.reduce((sum, h) => sum + h.quality_rating, 0) / harvests.length).toFixed(1) : 0

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
      <div className="space-y-6">
        <PageHeader
          title={t("orchard.harvest_records")}
          description="Track harvests, yield, and market value"
          actions={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("orchard.harvest_quantity")}
            </Button>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {t("orchard.harvest_records")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{harvests.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("orchard.total_yield")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalYield.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">{t("orchard.unit_kg")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Market Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${totalValue.toFixed(0)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Quality</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{avgQuality}/5</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("orchard.harvest_records")}</CardTitle>
            <CardDescription>Recent harvest records and yields</CardDescription>
          </CardHeader>
          <CardContent>
            {harvests.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">{t("orchard.no_data")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {harvests.map((harvest) => (
                  <div
                    key={harvest.id}
                    className="border rounded-lg p-4 hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{getCropName(harvest.crop_id)}</h3>
                          <Badge className={getQualityColor(harvest.quality_rating)}>
                            {harvest.quality_rating}/5
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Date</p>
                            <p className="font-semibold">
                              {new Date(harvest.harvest_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Quantity</p>
                            <p className="font-semibold">{harvest.harvest_quantity} kg</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Storage</p>
                            <p className="font-semibold text-xs">{harvest.storage_method}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Shelf Life</p>
                            <p className="font-semibold">{harvest.shelf_life_days} days</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Value</p>
                            <p className="font-semibold">${harvest.market_value.toFixed(2)}</p>
                          </div>
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

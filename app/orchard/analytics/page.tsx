"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, BarChart3, PieChart, Activity } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/language-context"

interface AnalyticsData {
  totalCrops: number
  activeCrops: number
  totalYield: number
  totalValue: number
  avgQuality: number
  totalCareHours: number
  pestIncidents: number
  soilAmendmentsApplied: number
  equipment: number
  cropsStatus: Record<string, number>
  cropTypes: Record<string, number>
}

export default function OrchardAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()
  const { t } = useLanguage()

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)

      // Fetch all relevant data
      const [crops, harvests, careLogs, pests, amendments, equipment] = await Promise.all([
        supabase.from("orchard_crops").select("*"),
        supabase.from("orchard_harvest_records").select("*"),
        supabase.from("orchard_care_logs").select("*"),
        supabase.from("orchard_pest_logs").select("*"),
        supabase.from("orchard_soil_amendments").select("*"),
        supabase.from("orchard_equipment").select("*"),
      ])

      const cropsData = crops.data || []
      const harvestsData = harvests.data || []
      const careLogsData = careLogs.data || []
      const pestsData = pests.data || []
      const amendmentsData = amendments.data || []
      const equipmentData = equipment.data || []

      // Calculate analytics
      const activeCrops = cropsData.filter((c: any) => c.status !== "harvested").length
      const totalYield = harvestsData.reduce((sum: number, h: any) => sum + h.harvest_quantity, 0)
      const totalValue = harvestsData.reduce((sum: number, h: any) => sum + h.market_value, 0)
      const avgQuality =
        harvestsData.length > 0
          ? harvestsData.reduce((sum: number, h: any) => sum + h.quality_rating, 0) / harvestsData.length
          : 0
      const totalCareHours = careLogsData.reduce((sum: number, c: any) => sum + c.hours_spent, 0)

      const cropsStatus: Record<string, number> = {}
      cropsData.forEach((c: any) => {
        cropsStatus[c.status] = (cropsStatus[c.status] || 0) + 1
      })

      const cropTypes: Record<string, number> = {}
      cropsData.forEach((c: any) => {
        cropTypes[c.crop_type] = (cropTypes[c.crop_type] || 0) + 1
      })

      setAnalytics({
        totalCrops: cropsData.length,
        activeCrops,
        totalYield,
        totalValue,
        avgQuality,
        totalCareHours,
        pestIncidents: pestsData.length,
        soilAmendmentsApplied: amendmentsData.length,
        equipment: equipmentData.length,
        cropsStatus,
        cropTypes,
      })
    } catch (error) {
      console.error("[v0] Error fetching analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">{t("orchard.loading")}</p>
        </div>
      </AppLayout>
    )
  }

  if (!analytics) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">No analytics data available</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title={t("orchard.yield_analytics")}
          description="Comprehensive performance analysis and metrics"
        />

        {/* Main KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Total Crops
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{analytics.totalCrops}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.activeCrops} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Total Yield
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{analytics.totalYield.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground mt-1">kg</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Market Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${analytics.totalValue.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground mt-1">from harvests</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Avg Quality
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{analytics.avgQuality.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground mt-1">/5 rating</p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Care Hours Logged
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalCareHours.toFixed(1)}h</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pest Incidents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.pestIncidents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Soil Amendments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.soilAmendmentsApplied}</div>
            </CardContent>
          </Card>
        </div>

        {/* Status Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Crop Status Distribution</CardTitle>
              <CardDescription>Breakdown of crop status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(analytics.cropsStatus).map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center">
                    <span className="capitalize text-sm">{status}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${(count / analytics.totalCrops) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="font-semibold text-sm w-12 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Crop Types</CardTitle>
              <CardDescription>Distribution by crop type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(analytics.cropTypes).map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="capitalize text-sm">{type}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{
                            width: `${(count / analytics.totalCrops) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="font-semibold text-sm w-12 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resources */}
        <Card>
          <CardHeader>
            <CardTitle>Resources & Equipment</CardTitle>
            <CardDescription>Overview of farm resources</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Equipment Items</p>
                <p className="text-2xl font-bold mt-1">{analytics.equipment}</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Yield/Labor Hour</p>
                <p className="text-2xl font-bold mt-1">
                  {analytics.totalCareHours > 0
                    ? (analytics.totalYield / analytics.totalCareHours).toFixed(2)
                    : 0}
                  kg/h
                </p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Value/Kg</p>
                <p className="text-2xl font-bold mt-1">
                  ${analytics.totalYield > 0 ? (analytics.totalValue / analytics.totalYield).toFixed(2) : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

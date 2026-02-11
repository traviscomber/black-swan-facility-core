"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Leaf, TrendingUp, Trash2, Pencil, Search, Filter, Calendar } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/language-context-client"

interface Crop {
  id: string
  plot_id: string
  crop_name: string
  scientific_name: string
  crop_type: string
  variety: string
  planting_date: string
  expected_harvest_date: string
  actual_harvest_date: string | null
  quantity_planted: number
  planting_unit: string
  status: string
  spacing_cm: number
  depth_cm: number
  water_frequency: string
  fertilizer_schedule: string
  companion_plants: string
  pest_control_methods: string
  days_to_harvest: number
  estimated_yield: number | null
  actual_yield: number | null
}

interface Plot {
  id: string
  name: string
}

export default function OrchardCropsPage() {
  const [crops, setCrops] = useState<Crop[]>([])
  const [filteredCrops, setFilteredCrops] = useState<Crop[]>([])
  const [plots, setPlots] = useState<Plot[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterPlot, setFilterPlot] = useState("all")
  const supabase = createBrowserClient()
  const { t } = useLanguage()

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [crops, searchTerm, filterStatus, filterPlot])

  const fetchData = async () => {
    try {
      setLoading(true)
      // Fetch plots
      const { data: plotsData, error: plotsError } = await supabase
        .from("orchard_plots")
        .select("id, name")
        .order("name", { ascending: true })

      if (plotsError) throw plotsError
      setPlots(plotsData || [])

      // Fetch crops
      const { data: cropsData, error: cropsError } = await supabase
        .from("orchard_crops")
        .select("*")
        .order("planting_date", { ascending: false })

      if (cropsError) throw cropsError
      setCrops(cropsData || [])
    } catch (error) {
      console.error("[v0] Error fetching crops data:", error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = crops

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (crop) =>
          crop.crop_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          crop.variety.toLowerCase().includes(searchTerm.toLowerCase()) ||
          crop.scientific_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((crop) => crop.status === filterStatus)
    }

    // Plot filter
    if (filterPlot !== "all") {
      filtered = filtered.filter((crop) => crop.plot_id === filterPlot)
    }

    setFilteredCrops(filtered)
  }

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      seedling: "bg-blue-100 text-blue-800",
      growing: "bg-green-100 text-green-800",
      mature: "bg-emerald-100 text-emerald-800",
      harvested: "bg-gray-100 text-gray-800",
    }
    return statusColors[status] || "bg-gray-100 text-gray-800"
  }

  const getPlotName = (plotId: string) => {
    return plots.find((p) => p.id === plotId)?.name || "Unknown Plot"
  }

  const daysUntilHarvest = (expectedDate: string) => {
    const today = new Date()
    const harvest = new Date(expectedDate)
    const diff = Math.ceil((harvest.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title={t("orchard.crops")}
          description={t("orchard.description")}
          actions={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("orchard.add_crop")}
            </Button>
          }
        />

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Leaf className="h-4 w-4" />
                {t("orchard.crops")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{crops.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Growing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {crops.filter((c) => c.status === "growing").length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Active crops</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Ready Soon
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {crops.filter((c) => c.status !== "harvested" && daysUntilHarvest(c.expected_harvest_date) <= 7 && daysUntilHarvest(c.expected_harvest_date) > 0).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Within 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Leaf className="h-4 w-4" />
                Harvested
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {crops.filter((c) => c.status === "harvested").length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="rounded-lg border border-secondary bg-card p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Input
                placeholder={t("orchard.crop_name")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-background"
                icon={<Search className="h-4 w-4" />}
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="seedling">Seedling</SelectItem>
                <SelectItem value="growing">Growing</SelectItem>
                <SelectItem value="mature">Mature</SelectItem>
                <SelectItem value="harvested">Harvested</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPlot} onValueChange={setFilterPlot}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Filter by plot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plots</SelectItem>
                {plots.map((plot) => (
                  <SelectItem key={plot.id} value={plot.id}>
                    {plot.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Crops Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t("orchard.crops")}</CardTitle>
            <CardDescription>
              {filteredCrops.length} of {crops.length} crops
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredCrops.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No crops found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCrops.map((crop) => (
                  <div
                    key={crop.id}
                    className="border rounded-lg p-4 hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div>
                            <h3 className="font-semibold text-lg">{crop.crop_name}</h3>
                            <p className="text-sm text-muted-foreground italic">
                              {crop.scientific_name}
                            </p>
                          </div>
                          <Badge className={getStatusColor(crop.status)}>
                            {crop.status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mt-3">
                          <div>
                            <p className="text-muted-foreground">Plot</p>
                            <p className="font-semibold text-xs">{getPlotName(crop.plot_id)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Variety</p>
                            <p className="font-semibold">{crop.variety}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Planted</p>
                            <p className="font-semibold">
                              {new Date(crop.planting_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Harvest</p>
                            <p className="font-semibold">
                              {crop.status === "harvested"
                                ? crop.actual_harvest_date
                                  ? new Date(crop.actual_harvest_date).toLocaleDateString()
                                  : "-"
                                : `${daysUntilHarvest(crop.expected_harvest_date)} days`}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Quantity</p>
                            <p className="font-semibold">
                              {crop.quantity_planted} {crop.planting_unit}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mt-2">
                          <div>
                            <p className="text-muted-foreground">Spacing</p>
                            <p className="font-semibold">{crop.spacing_cm} cm</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Water Freq.</p>
                            <p className="font-semibold text-xs">{crop.water_frequency}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Companions</p>
                            <p className="font-semibold text-xs">{crop.companion_plants}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Est. Yield</p>
                            <p className="font-semibold">
                              {crop.estimated_yield || "-"} kg
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Actual Yield</p>
                            <p className="font-semibold">
                              {crop.actual_yield || "-"} kg
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button variant="ghost" size="sm">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
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

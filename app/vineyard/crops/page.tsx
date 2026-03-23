"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Grape, TrendingUp, Trash2, Pencil, Search, Calendar } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

interface Vine {
  id: string
  plot_id: string
  vine_name: string
  variety: string
  rootstock: string
  planting_date: string
  age_years: number
  status: string
  health_status: string
  disease_history: string
  last_pruning_date: string
  next_pruning_date: string
  phylloxera_resistant: boolean
  estimated_yield_kg: number | null
  actual_yield_kg: number | null
}

interface Plot {
  id: string
  name: string
}

export default function VineyardVinesPage() {
  const [vines, setVines] = useState<Vine[]>([])
  const [filteredVines, setFilteredVines] = useState<Vine[]>([])
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
  }, [vines, searchTerm, filterStatus, filterPlot])

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data: plotsData, error: plotsError } = await supabase
        .from("vineyard_plots")
        .select("id, name")
        .order("name", { ascending: true })

      if (plotsError) throw plotsError
      setPlots(plotsData || [])

      const { data: vinesData, error: vinesError } = await supabase
        .from("vineyard_vines")
        .select("*")
        .order("planting_date", { ascending: false })

      if (vinesError) throw vinesError
      setVines(vinesData || [])
    } catch (error) {
      console.error("[v0] Error fetching vines data:", error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = vines

    if (searchTerm) {
      filtered = filtered.filter(
        (vine) =>
          vine.vine_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vine.variety.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vine.rootstock.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((vine) => vine.status === filterStatus)
    }

    if (filterPlot !== "all") {
      filtered = filtered.filter((vine) => vine.plot_id === filterPlot)
    }

    setFilteredVines(filtered)
  }

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      young: "bg-blue-100 text-blue-800",
      productive: "bg-green-100 text-green-800",
      mature: "bg-emerald-100 text-emerald-800",
      declining: "bg-orange-100 text-orange-800",
      replanting: "bg-gray-100 text-gray-800",
    }
    return statusColors[status] || "bg-gray-100 text-gray-800"
  }

  const getHealthColor = (health: string) => {
    const healthColors: Record<string, string> = {
      healthy: "bg-green-100 text-green-800",
      stressed: "bg-yellow-100 text-yellow-800",
      diseased: "bg-red-100 text-red-800",
      recovering: "bg-blue-100 text-blue-800",
    }
    return healthColors[health] || "bg-gray-100 text-gray-800"
  }

  const getPlotName = (plotId: string) => {
    return plots.find((p) => p.id === plotId)?.name || "Unknown Plot"
  }

  const daysSincePruning = (lastPruningDate: string) => {
    const today = new Date()
    const lastPruning = new Date(lastPruningDate)
    const diff = Math.floor((today.getTime() - lastPruning.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">{t("vineyard.loading") || "Loading..."}</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title={t("vineyard.vines") || "Vine Management"}
          description={t("vineyard.vines_description") || "Track and manage individual vines and their health"}
          actions={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("vineyard.add_vine") || "Add Vine"}
            </Button>
          }
        />

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Grape className="h-4 w-4" />
                {t("vineyard.total_vines") || "Total Vines"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{vines.length}</div>
              <p className="text-xs text-muted-foreground mt-1">All vines</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Productive
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {vines.filter((v) => v.status === "productive").length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Active vines</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Grape className="h-4 w-4" />
                Healthy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {vines.filter((v) => v.health_status === "healthy").length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Good condition</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Needs Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {vines.filter((v) => v.health_status !== "healthy").length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Maintenance needed</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="rounded-lg border border-secondary bg-card p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Input
                placeholder={t("vineyard.vine_name") || "Search vines..."}
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
                <SelectItem value="young">Young</SelectItem>
                <SelectItem value="productive">Productive</SelectItem>
                <SelectItem value="mature">Mature</SelectItem>
                <SelectItem value="declining">Declining</SelectItem>
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

        {/* Vines Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t("vineyard.vines") || "Vines"}</CardTitle>
            <CardDescription>
              {filteredVines.length} of {vines.length} vines
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredVines.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No vines found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredVines.map((vine) => (
                  <div
                    key={vine.id}
                    className="border rounded-lg p-4 hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div>
                            <h3 className="font-semibold text-lg">{vine.vine_name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {vine.variety} • {vine.rootstock}
                            </p>
                          </div>
                          <Badge className={getStatusColor(vine.status)}>
                            {vine.status}
                          </Badge>
                          <Badge className={getHealthColor(vine.health_status)}>
                            {vine.health_status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mt-3">
                          <div>
                            <p className="text-muted-foreground">Plot</p>
                            <p className="font-semibold text-xs">{getPlotName(vine.plot_id)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Age</p>
                            <p className="font-semibold">{vine.age_years} years</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Planted</p>
                            <p className="font-semibold">
                              {new Date(vine.planting_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Last Pruned</p>
                            <p className="font-semibold">
                              {daysSincePruning(vine.last_pruning_date)} days ago
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Phylloxera Resistant</p>
                            <p className="font-semibold">
                              {vine.phylloxera_resistant ? "Yes" : "No"}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mt-2">
                          <div>
                            <p className="text-muted-foreground">Rootstock</p>
                            <p className="font-semibold text-xs">{vine.rootstock}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Disease History</p>
                            <p className="font-semibold text-xs">{vine.disease_history || "None"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Next Pruning</p>
                            <p className="font-semibold">
                              {new Date(vine.next_pruning_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Est. Yield</p>
                            <p className="font-semibold">
                              {vine.estimated_yield_kg || "-"} kg
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Actual Yield</p>
                            <p className="font-semibold">
                              {vine.actual_yield_kg || "-"} kg
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

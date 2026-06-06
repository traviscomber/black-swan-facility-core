"use client"

import { useState, useEffect } from "react"
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
        .order("created_at", { ascending: false })

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
          vine.vine_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vine.variety.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vine.rootstock.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (filterPlot !== "all") {
      filtered = filtered.filter((vine) => vine.plot_id === filterPlot)
    }

    setFilteredVines(filtered)
  }

  const getStatusColor = (health: string) => {
    const healthColors: Record<string, string> = {
      healthy: "bg-green-100 text-green-800",
      stressed: "bg-yellow-100 text-yellow-800",
      diseased: "bg-red-100 text-red-800",
      recovering: "bg-blue-100 text-blue-800",
    }
    return healthColors[health] || "bg-gray-100 text-gray-800"
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

  const daysSincePruning = (lastPrunedDate: string) => {
    if (!lastPrunedDate) return "Never"
    const today = new Date()
    const lastPruning = new Date(lastPrunedDate)
    const diff = Math.floor((today.getTime() - lastPruning.getTime()) / (1000 * 60 * 60 * 24))
    return diff > 0 ? `${diff} days ago` : "Today"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">{t("vineyard.loading") || "Loading..."}</p>
      </div>
    )
  }

  return (
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
                {vines.filter((v) => v.age_years > 3).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Over 3 years old</p>
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
                placeholder={t("vineyard.search") || "Search vines..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-background"
                icon={<Search className="h-4 w-4" />}
              />
            </div>
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
                            <h3 className="font-semibold text-lg">{vine.vine_number}</h3>
                            <p className="text-sm text-muted-foreground">
                              {vine.variety} • {vine.rootstock}
                            </p>
                          </div>
                          <Badge className={getHealthColor(vine.health_status)}>
                            {vine.health_status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-3">
                          <div>
                            <p className="text-muted-foreground">Plot</p>
                            <p className="font-semibold text-xs">{getPlotName(vine.plot_id)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Age</p>
                            <p className="font-semibold">{vine.age_years} years</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Grafted</p>
                            <p className="font-semibold">{vine.grafted_year}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Last Pruned</p>
                            <p className="font-semibold">{daysSincePruning(vine.last_pruned_date)}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-2">
                          <div>
                            <p className="text-muted-foreground">Variety</p>
                            <p className="font-semibold text-xs">{vine.variety}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Rootstock</p>
                            <p className="font-semibold text-xs">{vine.rootstock}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Disease History</p>
                            <p className="font-semibold text-xs">{vine.disease_history || "None"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Position</p>
                            <p className="font-semibold text-xs">
                              Row {vine.position_row}, Col {vine.position_col}
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
    )
  }

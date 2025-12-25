"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Activity, TrendingUp, Zap, Battery, Sun } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { EnergyPasswordGuard } from "@/components/energy-password-guard"

// Mock data for charts
const dailyProductionData = [
  { hour: "00:00", prairie1: 0, prairie2: 0, prairie3: 0 },
  { hour: "04:00", prairie1: 0, prairie2: 0, prairie3: 0 },
  { hour: "08:00", prairie1: 2.4, prairie2: 2.3, prairie3: 2.5 },
  { hour: "10:00", prairie1: 8.2, prairie2: 8.4, prairie3: 8.1 },
  { hour: "12:00", prairie1: 12.5, prairie2: 12.8, prairie3: 12.3 },
  { hour: "14:00", prairie1: 11.2, prairie2: 11.5, prairie3: 11.0 },
  { hour: "16:00", prairie1: 6.5, prairie2: 6.8, prairie3: 6.3 },
  { hour: "18:00", prairie1: 1.2, prairie2: 1.4, prairie3: 1.1 },
  { hour: "20:00", prairie1: 0, prairie2: 0, prairie3: 0 },
]

const monthlyEnergyData = [
  { month: "Jan", production: 1200, consumption: 950, battery: 250 },
  { month: "Feb", production: 1400, consumption: 1020, battery: 380 },
  { month: "Mar", production: 1800, consumption: 1100, battery: 700 },
  { month: "Apr", production: 2100, consumption: 1250, battery: 850 },
  { month: "May", production: 2400, consumption: 1300, battery: 1100 },
  { month: "Jun", production: 2600, consumption: 1350, battery: 1250 },
]

const batteryStateData = [
  { name: "Charged", value: 75, fill: "#10b981" },
  { name: "Available", value: 20, fill: "#f59e0b" },
  { name: "Reserve", value: 5, fill: "#ef4444" },
]

export default function EnergyDashboard() {
  const router = useRouter()
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "year">("day")
  const [selectedBuilding, setSelectedBuilding] = useState<"all" | "prairie1" | "prairie2" | "prairie3">("all")

  // Real-time stats (would be fetched from API/Victron)
  const stats = {
    currentProduction: 45.2,
    currentConsumption: 12.8,
    batterySOC: 87,
    totalGenerated: 156.4,
    gridOffset: 78,
  }

  return (
    <EnergyPasswordGuard>
      <AppLayout>
        <div className="space-y-6 p-4 sm:p-6">
          <PageHeader title="Off Grid Energy Monitoring" description="Real-time analytics and performance tracking" />
          <div className="min-h-screen bg-background">
            <div className="sticky top-0 z-50 bg-background border-b border-border p-4 md:p-6">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.back()}
                  className="text-foreground hover:bg-accent"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-foreground">Off Grid Energy Monitoring</h1>
                  <p className="text-sm text-muted-foreground">Real-time analytics and performance tracking</p>
                </div>
              </div>
            </div>

            <div className="p-4 md:p-6">
              <div className="mx-auto max-w-7xl">
                {/* Time Range Selector */}
                <div className="mb-6 flex flex-wrap gap-2">
                  {(["day", "week", "month", "year"] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-4 py-2 rounded-md font-medium transition-colors capitalize ${
                        timeRange === range
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-foreground hover:bg-accent"
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Sun className="w-4 h-4" />
                        Production
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-foreground">{stats.currentProduction} kW</div>
                      <p className="text-xs text-muted-foreground mt-1">Current output</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Consumption
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-foreground">{stats.currentConsumption} kW</div>
                      <p className="text-xs text-muted-foreground mt-1">Current usage</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Battery className="w-4 h-4" />
                        Battery SOC
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-foreground">{stats.batterySOC}%</div>
                      <p className="text-xs text-muted-foreground mt-1">State of charge</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Generated
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-foreground">{stats.totalGenerated} kWh</div>
                      <p className="text-xs text-muted-foreground mt-1">Today total</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Grid Offset
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-foreground">{stats.gridOffset}%</div>
                      <p className="text-xs text-muted-foreground mt-1">Solar powered</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  {/* Daily Production Chart */}
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle>Daily Production by Building</CardTitle>
                      <CardDescription>Solar output across all prairie houses today</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={{
                          prairie1: { label: "Prairie House 1", color: "#3b82f6" },
                          prairie2: { label: "Prairie House 2", color: "#10b981" },
                          prairie3: { label: "Prairie House 3", color: "#f59e0b" },
                        }}
                        className="h-[300px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={dailyProductionData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="hour" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Legend />
                            <Line type="monotone" dataKey="prairie1" stroke="#3b82f6" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="prairie2" stroke="#10b981" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="prairie3" stroke="#f59e0b" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  {/* Monthly Energy Balance */}
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle>Monthly Energy Balance</CardTitle>
                      <CardDescription>Production vs consumption vs battery charging</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={{
                          production: { label: "Production", color: "#fbbf24" },
                          consumption: { label: "Consumption", color: "#ef4444" },
                          battery: { label: "To Battery", color: "#3b82f6" },
                        }}
                        className="h-[300px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyEnergyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="month" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Legend />
                            <Bar dataKey="production" fill="#fbbf24" />
                            <Bar dataKey="consumption" fill="#ef4444" />
                            <Bar dataKey="battery" fill="#3b82f6" />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  {/* Battery State Pie Chart */}
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle>Battery State Distribution</CardTitle>
                      <CardDescription>Current charge allocation</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={{
                          charged: { label: "Charged", color: "#10b981" },
                          available: { label: "Available", color: "#f59e0b" },
                          reserve: { label: "Reserve", color: "#ef4444" },
                        }}
                        className="h-[300px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={batteryStateData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={(entry) => `${entry.name} ${entry.value}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {batteryStateData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <ChartTooltip content={<ChartTooltipContent />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  {/* Building Selection and Stats */}
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle>Building Performance</CardTitle>
                      <CardDescription>Select building to view detailed stats</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {["all", "prairie1", "prairie2", "prairie3"].map((building) => (
                          <button
                            key={building}
                            onClick={() => setSelectedBuilding(building as typeof selectedBuilding)}
                            className={`w-full p-3 rounded-md text-left font-medium transition-colors ${
                              selectedBuilding === building
                                ? "bg-primary text-primary-foreground"
                                : "bg-accent text-foreground hover:bg-accent/80"
                            }`}
                          >
                            {building === "all" ? "All Buildings" : building.replace("prairie", "Prairie House ")}
                          </button>
                        ))}
                      </div>
                      <div className="mt-6 space-y-2 text-sm">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Avg Production:</span>
                          <span className="font-semibold text-foreground">12.4 kW</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Avg Consumption:</span>
                          <span className="font-semibold text-foreground">4.2 kW</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Surplus to Battery:</span>
                          <span className="font-semibold text-foreground">8.2 kW</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    </EnergyPasswordGuard>
  )
}

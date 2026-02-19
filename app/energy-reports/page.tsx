"use client"

import { useState, useEffect } from "react"
import { EnergyPasswordGuard } from "@/components/energy-password-guard"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, Filter, Calendar } from "lucide-react"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/language-provider"

export default function EnergyReports() {
  const [reportType, setReportType] = useState<"monthly" | "building" | "system">("monthly")
  const [dateRange, setDateRange] = useState({ start: "2024-01-01", end: "2024-06-30" })
  const [monthlyReportData, setMonthlyReportData] = useState<any[]>([])
  const [buildingReportData, setBuildingReportData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useLanguage()

  useEffect(() => {
    const loadReportData = async () => {
      const supabase = createBrowserClient()

      try {
        // Fetch monthly report data
        const { data: monthData } = await supabase
          .from("energy_monthly_reports")
          .select("*")
          .gte("month", dateRange.start)
          .lte("month", dateRange.end)
          .order("month")

        if (monthData) setMonthlyReportData(monthData)

        // Fetch building report data
        const { data: buildingData } = await supabase.from("energy_building_reports").select("*").order("building")

        if (buildingData) setBuildingReportData(buildingData)
      } catch (err) {
        console.error("[v0] Error loading report data:", err)
      } finally {
        setLoading(false)
      }
    }

    loadReportData()
  }, [dateRange])

  const totalProduction = monthlyReportData.reduce((sum, m) => sum + (m.production || 0), 0)
  const totalConsumption = monthlyReportData.reduce((sum, m) => sum + (m.consumption || 0), 0)
  const totalSavings = monthlyReportData.reduce((sum, m) => sum + (m.savings || 0), 0)
  const totalCO2Avoided = monthlyReportData.reduce((sum, m) => sum + (m.co2_avoided || 0), 0)

  return (
    <EnergyPasswordGuard>
      <AppLayout>
        <PageHeader
          title={t("energy.reports_title")}
          description={t("energy.reports_description")}
          backHref="/"
        />
        <div className="p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            {/* Report Type Selector */}
            <div className="mb-6 flex flex-wrap gap-2">
              {["monthly", "building", "system"].map((type) => {
                const typeLabel = 
                  type === "monthly" ? t("energy.monthly_report") :
                  type === "building" ? t("energy.building_report") :
                  t("energy.system_report")
                
                return (
                  <Button
                    key={type}
                    variant={reportType === type ? "default" : "outline"}
                    onClick={() => setReportType(type as typeof reportType)}
                  >
                    {typeLabel}
                  </Button>
                )
              })}
            </div>

            {/* Date Range Filter */}
            <Card className="bg-card border-border mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {t("energy.report_period")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">{t("energy.start_date")}</label>
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">{t("energy.end_date")}</label>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button variant="default">
                      <Filter className="inline mr-2 w-4 h-4" />
                      {t("energy.apply_filter")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Metrics */}
            {reportType === "monthly" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Production</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">{totalProduction} kWh</div>
                    <p className="text-xs text-muted-foreground mt-1">6 months</p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Consumption</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">{totalConsumption} kWh</div>
                    <p className="text-xs text-muted-foreground mt-1">6 months</p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Energy Savings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-500">{totalSavings} kWh</div>
                    <p className="text-xs text-muted-foreground mt-1">To battery/export</p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">CO₂ Avoided</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{totalCO2Avoided} kg</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Equivalent trees: ~{Math.round(totalCO2Avoided / 20)}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Main Report Content */}
            <div className="space-y-6">
              {reportType === "monthly" && (
                <>
                  <Card className="bg-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>Monthly Production vs Consumption</CardTitle>
                        <CardDescription>Energy flow over time</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {["pdf", "csv", "excel"].map((format) => (
                          <Button
                            key={format}
                            variant="outline"
                            onClick={() => handleExport(format as "pdf" | "csv" | "excel")}
                            className="capitalize flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            {format.toUpperCase()}
                          </Button>
                        ))}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={{
                          production: { label: "Production", color: "#fbbf24" },
                          consumption: { label: "Consumption", color: "#ef4444" },
                        }}
                        className="h-[300px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyReportData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="month" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Legend />
                            <Bar dataKey="production" fill="#fbbf24" />
                            <Bar dataKey="consumption" fill="#ef4444" />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle>Savings & Environmental Impact</CardTitle>
                      <CardDescription>Monthly savings and CO₂ reduction</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={{
                          savings: { label: "Energy Savings", color: "#10b981" },
                          co2_avoided: { label: "CO₂ Avoided (kg)", color: "#06b6d4" },
                        }}
                        className="h-[300px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={monthlyReportData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="month" stroke="#9ca3af" />
                            <YAxis yAxisId="left" stroke="#9ca3af" />
                            <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Legend />
                            <Line
                              yAxisId="left"
                              type="monotone"
                              dataKey="savings"
                              stroke="#10b981"
                              strokeWidth={2}
                              dot={false}
                            />
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="co2_avoided"
                              stroke="#06b6d4"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </>
              )}

              {reportType === "building" && (
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle>Building Performance Summary</CardTitle>
                    <CardDescription>Detailed metrics for each prairie house</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-border">
                          <tr>
                            <th className="text-left py-2 px-3 font-semibold text-foreground">Building</th>
                            <th className="text-right py-2 px-3 font-semibold text-foreground">Production (kWh)</th>
                            <th className="text-right py-2 px-3 font-semibold text-foreground">Consumption (kWh)</th>
                            <th className="text-right py-2 px-3 font-semibold text-foreground">Efficiency</th>
                            <th className="text-right py-2 px-3 font-semibold text-foreground">Battery Cycles</th>
                            <th className="text-right py-2 px-3 font-semibold text-foreground">Peak Load (kW)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {buildingReportData.map((row) => (
                            <tr key={row.building} className="border-b border-border hover:bg-accent/50">
                              <td className="py-3 px-3 text-foreground font-medium">{row.building}</td>
                              <td className="py-3 px-3 text-right text-foreground">
                                {row.production_kwh.toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-right text-foreground">
                                {row.consumption_kwh.toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-right text-foreground">{row.efficiency}%</td>
                              <td className="py-3 px-3 text-right text-foreground">{row.battery_cycles}</td>
                              <td className="py-3 px-3 text-right text-foreground">{row.peak_load_kw}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {reportType === "system" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle>System Health</CardTitle>
                      <CardDescription>Component status and performance</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-accent rounded-md">
                        <span className="font-medium text-foreground">SmartSolar MPPT Controllers</span>
                        <span className="text-sm bg-green-500/20 text-green-300 px-2 py-1 rounded">Online</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-accent rounded-md">
                        <span className="font-medium text-foreground">Pylontech Batteries</span>
                        <span className="text-sm bg-green-500/20 text-green-300 px-2 py-1 rounded">Healthy</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-accent rounded-md">
                        <span className="font-medium text-foreground">Cerbo GX Monitors</span>
                        <span className="text-sm bg-green-500/20 text-green-300 px-2 py-1 rounded">Connected</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-accent rounded-md">
                        <span className="font-medium text-foreground">MultiPlus Inverters</span>
                        <span className="text-sm bg-green-500/20 text-green-300 px-2 py-1 rounded">Operational</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle>System KPIs</CardTitle>
                      <CardDescription>Key performance indicators</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Overall Efficiency</span>
                          <span className="font-semibold text-foreground">95.3%</span>
                        </div>
                        <div className="w-full bg-accent rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: "95.3%" }}></div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Battery Health</span>
                          <span className="font-semibold text-foreground">98%</span>
                        </div>
                        <div className="w-full bg-accent rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: "98%" }}></div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">System Uptime</span>
                          <span className="font-semibold text-foreground">99.8%</span>
                        </div>
                        <div className="w-full bg-accent rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: "99.8%" }}></div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>
      </AppLayout>
    </EnergyPasswordGuard>
  )
}

const handleExport = (format: "pdf" | "csv" | "excel") => {
  console.log(`[v0] Exporting report as ${format}`)
  // In a real app, this would trigger actual export
}

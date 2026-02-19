"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Wrench, AlertCircle, CheckCircle } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

interface Equipment {
  id: string
  equipment_name: string
  equipment_type: string
  condition: string
  purchase_date: string
  last_maintenance_date: string | null
  next_maintenance_date: string | null
  storage_location: string
  description: string
}

export default function OrchardEquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()
  const { t } = useLanguage()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data } = await supabase
        .from("orchard_equipment")
        .select("*")
        .order("purchase_date", { ascending: false })

      setEquipment(data || [])
    } catch (error) {
      console.error("[v0] Error fetching equipment:", error)
    } finally {
      setLoading(false)
    }
  }

  const getConditionColor = (condition: string) => {
    if (condition === "excellent") return "bg-green-100 text-green-800"
    if (condition === "good") return "bg-blue-100 text-blue-800"
    if (condition === "fair") return "bg-yellow-100 text-yellow-800"
    return "bg-red-100 text-red-800"
  }

  const needsMaintenance = (nextDate: string | null) => {
    if (!nextDate) return false
    return new Date(nextDate) <= new Date()
  }

  const activeEquipment = equipment.filter((e) => e.condition !== "broken")
  const needsMaintenanceCount = equipment.filter((e) => needsMaintenance(e.next_maintenance_date)).length

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
          title={t("orchard.equipment")}
          description="Manage tools and equipment inventory"
          actions={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("orchard.equipment_name")}
            </Button>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Total Equipment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{equipment.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{activeEquipment.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Needs Maintenance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{needsMaintenanceCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Equipment Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {new Set(equipment.map((e) => e.equipment_type)).size}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("orchard.equipment")}</CardTitle>
            <CardDescription>Garden tools and equipment inventory</CardDescription>
          </CardHeader>
          <CardContent>
            {equipment.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No equipment records found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {equipment.map((item) => (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-4 hover:bg-accent/5 transition-colors ${
                      needsMaintenance(item.next_maintenance_date) ? "border-red-300 bg-red-50/50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{item.equipment_name}</h3>
                          <Badge className={getConditionColor(item.condition)}>
                            {item.condition}
                          </Badge>
                          {needsMaintenance(item.next_maintenance_date) && (
                            <Badge variant="destructive">Maintenance Due</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Type</p>
                            <p className="font-semibold text-xs">{item.equipment_type}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Purchased</p>
                            <p className="font-semibold">
                              {new Date(item.purchase_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Last Maintenance</p>
                            <p className="font-semibold">
                              {item.last_maintenance_date
                                ? new Date(item.last_maintenance_date).toLocaleDateString()
                                : "Never"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Next Maintenance</p>
                            <p className="font-semibold">
                              {item.next_maintenance_date
                                ? new Date(item.next_maintenance_date).toLocaleDateString()
                                : "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Storage</p>
                            <p className="font-semibold text-xs">{item.storage_location}</p>
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

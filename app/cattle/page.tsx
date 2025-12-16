"use client"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import { Plus, Brain } from "lucide-react"
import { useEffect, useState } from "react"
import Link from "next/link"

interface CattleArea {
  id: string
  name: string
  description: string
  status: string
  priority: string
  specifications: {
    hectares: number
    capacity: number
    grass_type?: string
    breeding_type?: string
    business_unit: string
  }
  notes: string
}

export default function CattlePage() {
  const [areas, setAreas] = useState<CattleArea[]>([])
  const [loading, setLoading] = useState(true)

  const loadCattleAreas = async () => {
    const supabase = createBrowserClient()
    const { data } = await supabase.from("infrastructure_plans").select("*").eq("category", "Cattle").order("name")

    if (data) {
      setAreas(data as CattleArea[])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadCattleAreas()
  }, [])

  const totalHectares = areas.reduce((sum, area) => sum + (area.specifications?.hectares || 0), 0)
  const totalCapacity = areas.reduce((sum, area) => sum + (area.specifications?.capacity || 0), 0)
  const fatteningAreas = areas.filter((a) => a.specifications?.business_unit === "Fattening")
  const breedingAreas = areas.filter((a) => a.specifications?.business_unit === "Breeding")

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-50 text-green-700 border-green-200"
      case "inactive":
        return "bg-gray-50 text-gray-700 border-gray-200"
      default:
        return "bg-blue-50 text-blue-700 border-blue-200"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-50 text-red-700 border-red-200"
      case "medium":
        return "bg-yellow-50 text-yellow-700 border-yellow-200"
      case "low":
        return "bg-green-50 text-green-700 border-green-200"
      default:
        return "bg-gray-50 text-gray-700 border-gray-200"
    }
  }

  return (
    <AppLayout>
      <PageHeader
        title="Cattle Management"
        description="Manage cattle operations across pasture areas - Fattening (Engorda) and Breeding (Crianza)"
        actions={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Area
          </Button>
        }
      />

      <div className="p-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Hectares</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalHectares}</div>
              <p className="text-xs text-gray-500 mt-1">Pasture area</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Capacity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalCapacity}</div>
              <p className="text-xs text-gray-500 mt-1">Cattle capacity</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Fattening (Engorda)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{fatteningAreas.length}</div>
              <p className="text-xs text-gray-500 mt-1">Operations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Breeding (Crianza)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{breedingAreas.length}</div>
              <p className="text-xs text-gray-500 mt-1">Operations</p>
            </CardContent>
          </Card>
        </div>

        {/* Areas Grid */}
        {loading ? (
          <div className="text-center text-gray-500">Loading cattle areas...</div>
        ) : areas.length === 0 ? (
          <div className="text-center text-gray-500">No cattle areas found</div>
        ) : (
          <div className="space-y-6">
            {/* Fattening Section */}
            {fatteningAreas.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-semibold">Fattening (Engorda)</h2>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {fatteningAreas.length} areas
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fatteningAreas.map((area) => (
                    <Card key={area.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{area.name}</CardTitle>
                            <CardDescription className="mt-1">{area.description}</CardDescription>
                          </div>
                          <Badge variant="outline" className={getStatusColor(area.status)}>
                            {area.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-gray-500 font-medium">Hectares</p>
                              <p className="text-lg font-semibold">{area.specifications?.hectares} ha</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 font-medium">Capacity</p>
                              <p className="text-lg font-semibold">{area.specifications?.capacity} head</p>
                            </div>
                          </div>
                          {area.specifications?.grass_type && (
                            <div>
                              <p className="text-xs text-gray-500 font-medium">Grass Type</p>
                              <p className="text-sm">{area.specifications.grass_type}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-gray-500 font-medium">Notes</p>
                            <p className="text-sm">{area.notes}</p>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Badge variant="outline" className={getPriorityColor(area.priority)}>
                              {area.priority} priority
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Breeding Section */}
            {breedingAreas.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-semibold">Breeding (Crianza)</h2>
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    {breedingAreas.length} areas
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {breedingAreas.map((area) => (
                    <Card key={area.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{area.name}</CardTitle>
                            <CardDescription className="mt-1">{area.description}</CardDescription>
                          </div>
                          <Badge variant="outline" className={getStatusColor(area.status)}>
                            {area.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-gray-500 font-medium">Hectares</p>
                              <p className="text-lg font-semibold">{area.specifications?.hectares} ha</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 font-medium">Capacity</p>
                              <p className="text-lg font-semibold">{area.specifications?.capacity} head</p>
                            </div>
                          </div>
                          {area.specifications?.breeding_type && (
                            <div>
                              <p className="text-xs text-gray-500 font-medium">Breeding Type</p>
                              <p className="text-sm">{area.specifications.breeding_type}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-gray-500 font-medium">Notes</p>
                            <p className="text-sm">{area.notes}</p>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Badge variant="outline" className={getPriorityColor(area.priority)}>
                              {area.priority} priority
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Expert Agent and Business Planning Section */}
        <div className="mt-8 space-y-4">
          {/* Expert Agent Card */}
          <div className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg hover:shadow-lg transition-shadow">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-lg text-purple-900">Cattle Management Expert AI</h3>
                </div>
                <p className="text-sm text-purple-700">
                  Ask your AI advisor about profitability analysis, cost optimization, breeding strategies, and
                  operational recommendations based on your business plan.
                </p>
              </div>
              <Link href="/cattle/expert-agent" className="inline-block relative z-10 flex-shrink-0">
                <Button className="bg-purple-600 hover:bg-purple-700 gap-2">
                  <Brain className="h-4 w-4" />
                  Expert Chat
                </Button>
              </Link>
            </div>
          </div>

          {/* Business Planning Card */}
          <div className="p-6 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg text-blue-900">Business Planning</h3>
                <p className="text-sm text-blue-700 mt-1">View detailed financial projections and pricing structure</p>
              </div>
              <div className="flex gap-3 flex-shrink-0">
                <Link href="/cattle/pricing-costs" className="inline-block relative z-10">
                  <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50 bg-transparent">
                    Pricing & Costs
                  </Button>
                </Link>
                <Link href="/cattle/business-plan" className="inline-block relative z-10">
                  <Button className="bg-blue-600 hover:bg-blue-700">Business Plan</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

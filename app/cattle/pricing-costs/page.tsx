"use client"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useEffect, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface PricingData {
  id: string
  animal_type: string
  price_pesos: number
  unit: string
  category: string
  description: string
  quantity_standard: number
}

interface CostData {
  id: string
  cost_type: string
  amount_pesos: number
  unit: string
  description: string
  business_unit: string
  is_fixed: boolean
}

export default function PricingCostsPage() {
  const [pricing, setPricing] = useState<PricingData[]>([])
  const [costs, setCosts] = useState<CostData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createBrowserClient()

        const [pricingRes, costsRes] = await Promise.all([
          supabase.from("cattle_pricing").select("*").eq("is_active", true),
          supabase.from("cattle_operational_costs").select("*"),
        ])

        if (pricingRes.data) setPricing(pricingRes.data)
        if (costsRes.data) setCosts(costsRes.data)
      } catch (error) {
        console.error("Error fetching pricing data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const breedingPrices = pricing.filter((p) => p.category === "Breeding")
  const fatteningPrices = pricing.filter((p) => p.category === "Fattening")
  const operationalCosts = costs.filter((c) => !c.is_fixed)
  const fixedCosts = costs.filter((c) => c.is_fixed)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(price)
  }

  if (loading) {
    return (
      <AppLayout>
        <PageHeader title="Pricing & Costs" description="Animal pricing and operational costs" />
        <div className="p-8 text-center">Cargando datos de precios...</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <PageHeader
        title="Pricing & Costs"
        description="Complete pricing structure for all animal types and operational costs"
      />

      <div className="p-8 space-y-8">
        {/* Breeding Animal Prices */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold">Breeding Animal Prices (Crianza)</h2>
            <Badge className="bg-purple-100 text-purple-800">{breedingPrices.length} tipos</Badge>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Animal Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Standard Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breedingPrices.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.animal_type}</TableCell>
                        <TableCell className="text-sm text-gray-600">{item.description}</TableCell>
                        <TableCell className="text-right font-semibold">{formatPrice(item.price_pesos)}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell className="text-right">{item.quantity_standard}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fattening Animal Prices */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold">Fattening Animal Prices (Engorda)</h2>
            <Badge className="bg-blue-100 text-blue-800">{fatteningPrices.length} tipos</Badge>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Animal Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Standard Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fatteningPrices.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.animal_type}</TableCell>
                        <TableCell className="text-sm text-gray-600">{item.description}</TableCell>
                        <TableCell className="text-right font-semibold">{formatPrice(item.price_pesos)}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell className="text-right">{item.quantity_standard}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Operational Costs */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold">Operational Costs</h2>
            <Badge className="bg-orange-100 text-orange-800">{costs.length} items</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {costs.map((cost) => (
              <Card key={cost.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{cost.cost_type}</CardTitle>
                    <Badge
                      variant="outline"
                      className={cost.is_fixed ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}
                    >
                      {cost.is_fixed ? "Fixed" : "Variable"}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs mt-1">{cost.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Amount</p>
                      <p className="text-2xl font-bold text-green-600">{formatPrice(cost.amount_pesos)}</p>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Unit: {cost.unit}</span>
                      <span>Business: {cost.business_unit}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Summary Card */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardHeader>
            <CardTitle>Pricing Summary</CardTitle>
            <CardDescription>Overview of cattle business pricing structure</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-600 font-medium">Total Breeding Types</p>
                <p className="text-2xl font-bold">{breedingPrices.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Total Fattening Types</p>
                <p className="text-2xl font-bold">{fatteningPrices.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Fixed Costs</p>
                <p className="text-2xl font-bold text-red-600">{fixedCosts.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Total Cost Items</p>
                <p className="text-2xl font-bold">{costs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

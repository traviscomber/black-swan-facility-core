"use client"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import { TrendingUp, DollarSign, Package, AlertCircle } from "lucide-react"
import { useEffect, useState } from "react"

interface ProcurementItem {
  id: string
  item_name: string
  category: string
  total_cost: number
  status: string
  supplier_id: string
  quantity: number
}

interface CategoryStats {
  category: string
  count: number
  total: number
}

export default function ProcurementAnalyticsPage() {
  const [items, setItems] = useState<ProcurementItem[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([])

  useEffect(() => {
    const loadData = async () => {
      const supabase = createBrowserClient()
      const { data, error } = await supabase.from("procurement_items").select("*")

      if (!error && data) {
        setItems(data)

        // Calculate category stats
        const stats: { [key: string]: { count: number; total: number } } = {}
        data.forEach((item) => {
          if (!stats[item.category]) {
            stats[item.category] = { count: 0, total: 0 }
          }
          stats[item.category].count += 1
          stats[item.category].total += item.total_cost || 0
        })

        setCategoryStats(
          Object.entries(stats).map(([category, { count, total }]) => ({
            category,
            count,
            total,
          })),
        )
      }
      setLoading(false)
    }

    loadData()
  }, [])

  const totalSpent = items.reduce((sum, item) => sum + (item.total_cost || 0), 0)
  const totalOrders = items.length
  const pendingOrders = items.filter((i) => i.status === "pending").length
  const deliveredOrders = items.filter((i) => i.status === "delivered").length
  const avgOrderValue = totalOrders > 0 ? (totalSpent / totalOrders).toFixed(2) : 0

  return (
    <AppLayout>
      <PageHeader title="Procurement Analytics" description="Budget tracking and procurement insights" />

      <div className="p-8 space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">${totalSpent.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
                <Package className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">{totalOrders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Order Value</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">${avgOrderValue}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending Orders</CardTitle>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">{pendingOrders}</div>
            </CardContent>
          </Card>
        </div>

        {/* Spending by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>Budget allocation across procurement categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <div className="text-center text-muted-foreground py-8">Loading analytics...</div>
              ) : categoryStats.length > 0 ? (
                categoryStats.map((stat) => {
                  const percentage = totalSpent > 0 ? (stat.total / totalSpent) * 100 : 0
                  return (
                    <div key={stat.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-accent">{stat.category}</p>
                          <p className="text-sm text-muted-foreground">{stat.count} items</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-accent">${stat.total.toLocaleString()}</p>
                          <p className="text-sm text-muted-foreground">{percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center text-muted-foreground py-8">No spending data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status Summary */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Order Status Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Pending</span>
                <span className="text-lg font-semibold text-yellow-500">{pendingOrders}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Delivered</span>
                <span className="text-lg font-semibold text-green-500">{deliveredOrders}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">In Transit</span>
                <span className="text-lg font-semibold text-blue-500">
                  {items.filter((i) => i.status === "ordered").length}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categoryStats
                  .sort((a, b) => b.total - a.total)
                  .slice(0, 3)
                  .map((stat, idx) => (
                    <div key={stat.category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-primary" style={{ opacity: 1 - idx * 0.2 }} />
                        <span className="text-sm text-muted-foreground">{stat.category}</span>
                      </div>
                      <span className="font-semibold text-accent">${stat.total.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}

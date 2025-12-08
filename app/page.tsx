"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Sparkles,
  XCircle,
  Activity,
  MapPin,
  Plus,
} from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { IssuesTrendChart, AssetDistributionChart } from "@/components/dashboard-charts"
import { InfrastructureSearchDialog } from "@/components/infrastructure-search-dialog"

function getUtilityStatusColor(status: string) {
  switch (status) {
    case "ok":
      return "bg-green-100 text-green-800 border-green-200"
    case "warning":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "critical":
      return "bg-red-100 text-red-800 border-red-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

function getUtilityIcon(status: string) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="h-5 w-5 text-green-600" />
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-yellow-600" />
    case "critical":
      return <XCircle className="h-5 w-5 text-red-600" />
    default:
      return <Activity className="h-5 w-5 text-gray-600" />
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function Dashboard() {
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [selectedInfrastructure, setSelectedInfrastructure] = useState<any>(null)
  const supabase = createBrowserClient()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        console.log("[v0] Keyboard shortcut triggered: Ctrl/Cmd+K")
        setSearchDialogOpen(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleSelectInfrastructure = (infrastructure: any) => {
    console.log("[v0] Selected infrastructure from search:", infrastructure)
    setSelectedInfrastructure(infrastructure)
    window.location.href = `/map?selected=${infrastructure.id}`
  }

  return (
    <AppLayout>
      <PageHeader title="Dashboard" description="Facility overview and system status" />

      <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-gray-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Assets</CardTitle>
              <MapPin className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-black">0</div>
              <p className="text-xs text-gray-500 mt-1">0 critical</p>
            </CardContent>
          </Card>

          <Card className="border-gray-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Open Issues</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-black">0</div>
              <p className="text-xs text-gray-500 mt-1">0 resolved this month</p>
            </CardContent>
          </Card>

          <Card className="border-gray-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Tasks</CardTitle>
              <Wrench className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-black">0</div>
              <p className="text-xs text-gray-500 mt-1">Maintenance scheduled</p>
            </CardContent>
          </Card>

          <Card className="border-gray-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">System Health</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-black">0/0</div>
              <p className="text-xs text-gray-500 mt-1">Utilities operational</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-gray-100">
            <CardHeader>
              <CardTitle className="text-base">Issue Trends</CardTitle>
              <CardDescription className="text-xs">Last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <IssuesTrendChart data={[]} />
            </CardContent>
          </Card>

          <Card className="border-gray-100">
            <CardHeader>
              <CardTitle className="text-base">Asset Distribution</CardTitle>
              <CardDescription className="text-xs">By asset type</CardDescription>
            </CardHeader>
            <CardContent>
              <AssetDistributionChart data={[]} />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-black">Open Issues</h2>
              <Link href="/issues/report">
                <Button size="sm" className="h-8 text-xs">
                  <Plus className="mr-1 h-3 w-3 md:mr-2 md:h-4 md:w-4" />
                  Report Issue
                </Button>
              </Link>
            </div>
            <Card className="border-gray-100">
              <CardContent className="p-0">
                <div className="p-8 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 font-medium">No open issues</p>
                  <p className="text-xs text-gray-400 mt-1">All systems operational</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-black">Upcoming Maintenance</h2>
              <Link href="/maintenance">
                <Button variant="outline" size="sm" className="h-8 text-xs bg-transparent">
                  View All
                </Button>
              </Link>
            </div>
            <Card className="border-gray-100">
              <CardContent className="p-0">
                <div className="p-8 text-center text-sm text-gray-400">No upcoming maintenance</div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-base font-semibold text-black">Recent Activity</h2>
          <Card className="border-gray-100">
            <CardContent className="p-0">
              <div className="p-8 text-center text-sm text-gray-400">No recent activity</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-gray-100">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription className="text-xs">Common facility management tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/map">
              <Button variant="outline" className="w-full justify-start bg-transparent text-sm h-10">
                <MapPin className="mr-2 h-4 w-4" />
                Open GIS Map
              </Button>
            </Link>
            <Link href="/issues/report">
              <Button variant="outline" className="w-full justify-start bg-transparent text-sm h-10">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Report Issue
              </Button>
            </Link>
            <Link href="/assets">
              <Button variant="outline" className="w-full justify-start bg-transparent text-sm h-10">
                <Plus className="mr-2 h-4 w-4" />
                Add Asset
              </Button>
            </Link>
            <Link href="/maintenance">
              <Button variant="outline" className="w-full justify-start bg-transparent text-sm h-10">
                <Wrench className="mr-2 h-4 w-4" />
                Schedule Maintenance
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <button
        onClick={() => setSearchDialogOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 group"
        aria-label="AI Search"
      >
        <div className="relative">
          <Sparkles className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-2 w-2 bg-white rounded-full animate-ping" />
        </div>
        <span className="font-medium">AI Search</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-white/20 rounded border border-white/30">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <InfrastructureSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        onSelectInfrastructure={handleSelectInfrastructure}
      />
    </AppLayout>
  )
}

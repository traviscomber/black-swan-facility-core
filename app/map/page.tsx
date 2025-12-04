"use client"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useState, useEffect } from "react"
import type { Asset } from "@/lib/types"
import Link from "next/link"
import { MapPin, Layers, X, ChevronLeft, ChevronRight } from "lucide-react"

export default function MapPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [filters, setFilters] = useState({
    water: true,
    electricity: true,
    internet: true,
    critical: true,
  })

  useEffect(() => {
    const fetchAssets = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("assets")
        .select("*")
        .not("latitude", "is", null)
        .not("longitude", "is", null)

      if (data) setAssets(data)
    }

    fetchAssets()
  }, [])

  const getAssetColor = (asset: Asset) => {
    if (asset.is_critical) return "#ef4444"
    switch (asset.type.toLowerCase()) {
      case "water":
        return "#3b82f6"
      case "electricity":
        return "#eab308"
      case "internet":
        return "#22c55e"
      default:
        return "#6b7280"
    }
  }

  const filteredAssets = assets.filter((asset) => {
    if (asset.is_critical && filters.critical) return true
    if (asset.type.toLowerCase() === "water" && filters.water) return true
    if (asset.type.toLowerCase() === "electricity" && filters.electricity) return true
    if (asset.type.toLowerCase() === "internet" && filters.internet) return true
    return false
  })

  const centerLat =
    filteredAssets.length > 0
      ? filteredAssets.reduce((sum, a) => sum + (a.latitude || 0), 0) / filteredAssets.length
      : 40.7128
  const centerLng =
    filteredAssets.length > 0
      ? filteredAssets.reduce((sum, a) => sum + (a.longitude || 0), 0) / filteredAssets.length
      : -74.006

  return (
    <AppLayout>
      <PageHeader title="GIS Map" description="Interactive facility asset map" />

      <div className="relative h-[calc(100vh-8rem)] md:h-[calc(100vh-5rem)]">
        {/* Map View - Full width on mobile */}
        <div className="absolute inset-0 bg-gray-100">
          <div className="h-full w-full overflow-hidden">
            {/* Grid background */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `
                  linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                  linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
                `,
                backgroundSize: "50px 50px",
              }}
            />

            {/* Asset markers */}
            {filteredAssets.map((asset) => {
              const x = ((asset.longitude || 0) - centerLng) * 5000 + 50
              const y = ((asset.latitude || 0) - centerLat) * 5000 + 50

              return (
                <div
                  key={asset.id}
                  className="absolute cursor-pointer transition-transform hover:scale-125 z-10"
                  style={{
                    left: `${50 + x}%`,
                    top: `${50 - y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  onClick={() => setSelectedAsset(asset)}
                >
                  <div
                    className="h-5 w-5 md:h-6 md:w-6 rounded-full border-2 border-white shadow-lg"
                    style={{ backgroundColor: getAssetColor(asset) }}
                  />
                  {selectedAsset?.id === asset.id && (
                    <div className="absolute left-8 top-0 z-20 w-48 md:w-56">
                      <Card className="shadow-xl">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-semibold text-sm flex-1">{asset.name}</p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedAsset(null)
                              }}
                              className="text-gray-400 hover:text-gray-600 ml-2"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <p className="text-xs text-gray-600">{asset.type}</p>
                          <p className="text-xs text-gray-500 mt-1">{asset.location}</p>
                          <Link href={`/assets/${asset.id}`} className="mt-3 block">
                            <Button size="sm" className="w-full text-xs h-8">
                              View Details
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Map overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <MapPin className="h-12 w-12 md:h-16 md:w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-400 text-xs md:text-sm">Asset Map Visualization</p>
                <p className="text-gray-300 text-xs mt-2 px-4">Click markers to view details</p>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden absolute top-4 right-4 z-30 bg-white rounded-lg shadow-lg p-2 border border-gray-200"
        >
          {sidebarOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>

        <div
          className={`
            fixed md:absolute top-0 right-0 h-full w-[85vw] max-w-sm md:w-80
            bg-white border-l border-gray-200 shadow-xl md:shadow-none
            transform transition-transform duration-300 ease-in-out z-20
            ${sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}
          `}
        >
          <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
            <div className="flex items-center justify-between md:hidden mb-4">
              <h2 className="text-lg font-semibold">Map Controls</h2>
              <button onClick={() => setSidebarOpen(false)} className="p-2">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Layer Filters */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Layers className="h-4 w-4 md:h-5 md:w-5 text-gray-700" />
                <h3 className="font-semibold text-sm md:text-base text-black">Map Layers</h3>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.water}
                    onChange={(e) => setFilters({ ...filters, water: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <span className="text-sm text-gray-700">Water Systems</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.electricity}
                    onChange={(e) => setFilters({ ...filters, electricity: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                  />
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <span className="text-sm text-gray-700">Electricity</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.internet}
                    onChange={(e) => setFilters({ ...filters, internet: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span className="text-sm text-gray-700">Internet</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.critical}
                    onChange={(e) => setFilters({ ...filters, critical: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="text-sm text-gray-700">Critical Assets</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Asset List */}
            <div>
              <h3 className="font-semibold text-sm md:text-base text-black mb-4">Assets ({filteredAssets.length})</h3>
              <div className="space-y-2">
                {filteredAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="rounded-lg border border-gray-200 p-3 cursor-pointer transition-colors hover:bg-gray-50"
                    onClick={() => {
                      setSelectedAsset(asset)
                      setSidebarOpen(false)
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0 mt-1"
                        style={{ backgroundColor: getAssetColor(asset) }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-black truncate">{asset.name}</p>
                        <p className="text-xs text-gray-600 mt-1">{asset.location}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {asset.type}
                          </Badge>
                          {asset.is_critical && (
                            <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                              Critical
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 bg-black/30 z-10" onClick={() => setSidebarOpen(false)} />
        )}
      </div>
    </AppLayout>
  )
}

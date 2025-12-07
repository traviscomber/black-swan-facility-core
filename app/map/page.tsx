"use client"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { useState, useEffect, useRef } from "react"
import type { Asset } from "@/lib/types"
import { Layers, X, ChevronLeft, ChevronRight, Maximize } from "lucide-react"

export default function MapPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mapType, setMapType] = useState<"street" | "satellite" | "terrain">("street")
  const [filters, setFilters] = useState({
    water: true,
    electricity: true,
    internet: true,
    critical: true,
  })
  const [leafletLoaded, setLeafletLoaded] = useState(false)

  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<any[]>([])

  useEffect(() => {
    if (typeof window === "undefined") return

    // Check if Leaflet is already loaded
    if ((window as any).L) {
      setLeafletLoaded(true)
      return
    }

    // Load Leaflet CSS
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    document.head.appendChild(link)

    // Load Leaflet JS
    const script = document.createElement("script")
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    script.onload = () => setLeafletLoaded(true)
    document.head.appendChild(script)

    return () => {
      document.head.removeChild(link)
      document.head.removeChild(script)
    }
  }, [])

  useEffect(() => {
    if (!leafletLoaded || typeof window === "undefined") return

    const L = (window as any).L

    if (!mapRef.current && mapContainerRef.current) {
      const map = L.map(mapContainerRef.current).setView([-39.76, -73.23], 15)

      // Add default tile layer (street map)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map)

      mapRef.current = map
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [leafletLoaded])

  useEffect(() => {
    if (!mapRef.current || !leafletLoaded || typeof window === "undefined") return

    const L = (window as any).L
    const map = mapRef.current

    // Remove existing tile layers
    map.eachLayer((layer: any) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer)
      }
    })

    // Add new tile layer based on selected type
    let tileUrl = ""
    let attribution = ""

    switch (mapType) {
      case "satellite":
        tileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution = "© Esri"
        break
      case "terrain":
        tileUrl = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
        attribution = "© OpenTopoMap contributors"
        break
      case "street":
      default:
        tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution = "© OpenStreetMap contributors"
    }

    L.tileLayer(tileUrl, {
      attribution,
      maxZoom: 19,
    }).addTo(map)
  }, [mapType, leafletLoaded])

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

  useEffect(() => {
    if (!mapRef.current || !leafletLoaded || typeof window === "undefined") return

    const L = (window as any).L
    const map = mapRef.current

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    // Filter assets
    const filtered = assets.filter((asset) => {
      if (asset.is_critical && filters.critical) return true
      if (asset.type.toLowerCase() === "water" && filters.water) return true
      if (asset.type.toLowerCase() === "electricity" && filters.electricity) return true
      if (asset.type.toLowerCase() === "internet" && filters.internet) return true
      return false
    })

    // Add markers for filtered assets
    filtered.forEach((asset) => {
      if (!asset.latitude || !asset.longitude) return

      const color = getAssetColor(asset)

      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background-color: ${color};
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })

      const marker = L.marker([asset.latitude, asset.longitude], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width: 200px;">
            <h3 style="font-weight: 600; margin-bottom: 8px;">${asset.name}</h3>
            <p style="font-size: 14px; color: #666; margin-bottom: 4px;">${asset.type}</p>
            <p style="font-size: 12px; color: #999; margin-bottom: 12px;">${asset.location || ""}</p>
            <a href="/assets/${asset.id}" style="
              display: block;
              text-align: center;
              background-color: #1a73e8;
              color: white;
              padding: 8px;
              border-radius: 6px;
              text-decoration: none;
              font-size: 14px;
            ">View Details</a>
          </div>
        `)

      markersRef.current.push(marker)
    })

    if (filtered.length > 0) {
      const bounds = L.latLngBounds(filtered.map((a) => [a.latitude!, a.longitude!] as [number, number]))
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [assets, filters, leafletLoaded])

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

  const toggleFullscreen = () => {
    if (!mapContainerRef.current) return

    if (!document.fullscreenElement) {
      mapContainerRef.current.parentElement?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  const filteredAssets = assets.filter((asset) => {
    if (asset.is_critical && filters.critical) return true
    if (asset.type.toLowerCase() === "water" && filters.water) return true
    if (asset.type.toLowerCase() === "electricity" && filters.electricity) return true
    if (asset.type.toLowerCase() === "internet" && filters.internet) return true
    return false
  })

  return (
    <AppLayout>
      <PageHeader title="GIS Map" description="Interactive facility asset map" />

      <div className="relative h-[calc(100vh-8rem)] md:h-[calc(100vh-5rem)]">
        <div ref={mapContainerRef} className="absolute inset-0 z-0" style={{ height: "100%", width: "100%" }} />

        {!leafletLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
              <p className="text-sm text-gray-600">Loading map...</p>
            </div>
          </div>
        )}

        {/* Map Type Controls */}
        <div className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setMapType("street")}
            className={`px-3 py-2 text-xs md:text-sm font-medium transition-colors border-b border-gray-200 block w-full text-left ${
              mapType === "street" ? "bg-blue-50 text-blue-700" : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Street
          </button>
          <button
            onClick={() => setMapType("satellite")}
            className={`px-3 py-2 text-xs md:text-sm font-medium transition-colors border-b border-gray-200 block w-full text-left ${
              mapType === "satellite" ? "bg-blue-50 text-blue-700" : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Satellite
          </button>
          <button
            onClick={() => setMapType("terrain")}
            className={`px-3 py-2 text-xs md:text-sm font-medium transition-colors block w-full text-left ${
              mapType === "terrain" ? "bg-blue-50 text-blue-700" : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Terrain
          </button>
        </div>

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 left-32 z-[1000] bg-white rounded-lg shadow-lg p-2 border border-gray-200 hover:bg-gray-50 transition-colors"
          title="Toggle fullscreen"
        >
          <Maximize className="h-4 w-4 md:h-5 md:w-5 text-gray-700" />
        </button>

        {/* Mobile Toggle Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-2 border border-gray-200"
        >
          {sidebarOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>

        {/* Asset List Sidebar */}
        <div
          className={`
            fixed md:absolute top-0 right-0 h-full w-[85vw] max-w-sm md:w-80
            bg-white border-l border-gray-200 shadow-xl md:shadow-none
            transform transition-transform duration-300 ease-in-out z-[1001]
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
                      if (mapRef.current && asset.latitude && asset.longitude) {
                        mapRef.current.setView([asset.latitude, asset.longitude], 16)
                      }
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

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 bg-black/30 z-[1000]" onClick={() => setSidebarOpen(false)} />
        )}
      </div>
    </AppLayout>
  )
}

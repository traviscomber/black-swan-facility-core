"use client"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useState, useEffect, useRef } from "react"
import type { InfrastructurePlan } from "@/lib/types"
import { Layers, X, ChevronLeft, ChevronRight, Maximize, Wifi, Droplet, Zap, Plus, MapPin } from "lucide-react"
import { InfrastructureDetailPanel } from "@/components/infrastructure-detail-panel"
import { AddInfrastructureDialog } from "@/components/add-infrastructure-dialog"
import { EditInfrastructureDialog } from "@/components/edit-infrastructure-dialog"

export default function MapPage() {
  const [infrastructure, setInfrastructure] = useState<InfrastructurePlan[]>([])
  const [selectedInfra, setSelectedInfra] = useState<InfrastructurePlan | null>(null)
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingInfra, setEditingInfra] = useState<InfrastructurePlan | null>(null)
  const [clickedCoordinates, setClickedCoordinates] = useState<{ lat: number; lng: number } | null>(null)

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mapType, setMapType] = useState<"street" | "satellite" | "terrain" | "hybrid">("street")
  const [terrainOpacity, setTerrainOpacity] = useState(0.5)

  const [filters, setFilters] = useState({
    internet: true,
    water: true,
    electricity: true,
  })

  const [leafletLoaded, setLeafletLoaded] = useState(false)

  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<any[]>([])
  const satelliteLayerRef = useRef<any>(null)
  const terrainLayerRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window === "undefined") return

    if ((window as any).L) {
      setLeafletLoaded(true)
      return
    }

    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    document.head.appendChild(link)

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
      const map = L.map(mapContainerRef.current).setView([-39.8255, -73.2215], 16)

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map)

      map.on("contextmenu", (e: any) => {
        e.originalEvent.preventDefault()
        const { lat, lng } = e.latlng
        console.log("[v0] Map right-clicked at:", lat, lng)
        setClickedCoordinates({ lat, lng })
        setAddDialogOpen(true)
      })

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

    map.eachLayer((layer: any) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer)
      }
    })

    satelliteLayerRef.current = null
    terrainLayerRef.current = null

    if (mapType === "hybrid") {
      const satelliteLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "© Esri",
          maxZoom: 19,
        },
      )

      const terrainLayer = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenTopoMap contributors",
        maxZoom: 19,
        opacity: terrainOpacity,
      })

      satelliteLayer.addTo(map)
      terrainLayer.addTo(map)

      satelliteLayerRef.current = satelliteLayer
      terrainLayerRef.current = terrainLayer
    } else {
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
    }
  }, [mapType, leafletLoaded])

  useEffect(() => {
    if (mapType === "hybrid" && terrainLayerRef.current) {
      terrainLayerRef.current.setOpacity(terrainOpacity)
    }
  }, [terrainOpacity, mapType])

  useEffect(() => {
    const fetchInfrastructure = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("infrastructure_plans").select("*").order("name")

      if (data) setInfrastructure(data)
    }

    fetchInfrastructure()
  }, [])

  useEffect(() => {
    if (!mapRef.current || !leafletLoaded || typeof window === "undefined") return

    const L = (window as any).L
    const map = mapRef.current

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    const filtered = infrastructure.filter((infra) => {
      return filters[infra.category]
    })

    filtered.forEach((infra) => {
      const color = getInfraColor(infra)
      const IconComponent = getInfraIcon(infra.category)

      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: ${color};
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
        ">${getIconSymbol(infra.category)}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })

      const marker = L.marker([infra.latitude, infra.longitude], { icon })
        .addTo(map)
        .on("click", () => {
          setSelectedInfra(infra)
          setDetailPanelOpen(true)
        })

      markersRef.current.push(marker)
    })

    if (filtered.length > 0) {
      const bounds = L.latLngBounds(filtered.map((i) => [i.latitude, i.longitude] as [number, number]))
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [infrastructure, filters, leafletLoaded])

  const getInfraColor = (infra: InfrastructurePlan) => {
    if (infra.priority === "critical") return "#dc2626"
    switch (infra.category) {
      case "internet":
        return "#3b82f6"
      case "water":
        return "#06b6d4"
      case "electricity":
        return "#eab308"
      default:
        return "#6b7280"
    }
  }

  const getInfraIcon = (category: string) => {
    switch (category) {
      case "internet":
        return Wifi
      case "water":
        return Droplet
      case "electricity":
        return Zap
      default:
        return MapPin
    }
  }

  const getIconSymbol = (category: string) => {
    switch (category) {
      case "internet":
        return "📡"
      case "water":
        return "💧"
      case "electricity":
        return "⚡"
      default:
        return "📍"
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

  const filteredInfrastructure = infrastructure.filter((infra) => filters[infra.category])

  const infraByCategory = {
    internet: filteredInfrastructure.filter((i) => i.category === "internet"),
    water: filteredInfrastructure.filter((i) => i.category === "water"),
    electricity: filteredInfrastructure.filter((i) => i.category === "electricity"),
  }

  const handleEdit = (infra: InfrastructurePlan) => {
    setEditingInfra(infra)
    setEditDialogOpen(true)
    setDetailPanelOpen(false)
  }

  const handleDelete = () => {
    const fetchInfrastructure = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("infrastructure_plans").select("*").order("name")

      if (data) setInfrastructure(data)
    }
    fetchInfrastructure()
  }

  return (
    <AppLayout>
      <PageHeader
        title="GIS Infrastructure Map"
        description="Internet, Water, and Electrical systems"
        actions={
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Infrastructure
          </Button>
        }
      />

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

        <div className="absolute top-4 left-4 z-[1000] space-y-2">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
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
              className={`px-3 py-2 text-xs md:text-sm font-medium transition-colors border-b border-gray-200 block w-full text-left ${
                mapType === "terrain" ? "bg-blue-50 text-blue-700" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Terrain
            </button>
            <button
              onClick={() => setMapType("hybrid")}
              className={`px-3 py-2 text-xs md:text-sm font-medium transition-colors block w-full text-left ${
                mapType === "hybrid" ? "bg-blue-50 text-blue-700" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Hybrid
            </button>
          </div>

          {mapType === "hybrid" && (
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-48">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700">Terrain Overlay</span>
                <span className="text-xs text-gray-500">{Math.round(terrainOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={terrainOpacity}
                onChange={(e) => setTerrainOpacity(Number.parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Satellite</span>
                <span>Terrain</span>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={toggleFullscreen}
          className="absolute top-4 left-[13.5rem] z-[1000] bg-white rounded-lg shadow-lg p-2 border border-gray-200 hover:bg-gray-50 transition-colors"
          title="Toggle fullscreen"
        >
          <Maximize className="h-4 w-4 md:h-5 md:w-5 text-gray-700" />
        </button>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-2 border border-gray-200"
        >
          {sidebarOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>

        <div
          className={`
            fixed md:absolute top-0 right-0 h-full w-[85vw] max-w-md md:w-96
            bg-white border-l border-gray-200 shadow-xl md:shadow-none
            transform transition-transform duration-300 ease-in-out z-[1001]
            ${sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}
          `}
        >
          <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
            <div className="flex items-center justify-between md:hidden mb-4">
              <h2 className="text-lg font-semibold">Infrastructure</h2>
              <button onClick={() => setSidebarOpen(false)} className="p-2">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-4">
                <Layers className="h-4 w-4 md:h-5 md:w-5 text-gray-700" />
                <h3 className="font-semibold text-sm md:text-base text-black">Infrastructure Layers</h3>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.internet}
                    onChange={(e) => setFilters({ ...filters, internet: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-gray-700">Internet ({infraByCategory.internet.length})</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.water}
                    onChange={(e) => setFilters({ ...filters, water: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div className="flex items-center gap-2">
                    <Droplet className="h-4 w-4 text-cyan-600" />
                    <span className="text-sm text-gray-700">Water ({infraByCategory.water.length})</span>
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
                    <Zap className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm text-gray-700">Electricity ({infraByCategory.electricity.length})</span>
                  </div>
                </label>
              </div>
            </div>

            {Object.entries(infraByCategory).map(([category, items]) => {
              if (items.length === 0) return null
              const Icon = getInfraIcon(category)

              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="h-4 w-4" />
                    <h4 className="font-medium text-sm capitalize">{category}</h4>
                  </div>
                  <div className="space-y-2">
                    {items.map((infra) => (
                      <div
                        key={infra.id}
                        className="rounded-lg border border-gray-200 p-3 cursor-pointer transition-all hover:bg-gray-50 hover:border-gray-300"
                        onClick={() => {
                          if (mapRef.current) {
                            mapRef.current.setView([infra.latitude, infra.longitude], 17)
                          }
                          setSelectedInfra(infra)
                          setDetailPanelOpen(true)
                          setSidebarOpen(false)
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className="h-3 w-3 rounded-full flex-shrink-0 mt-1"
                            style={{ backgroundColor: getInfraColor(infra) }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-black truncate">{infra.name}</p>
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{infra.description}</p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {infra.status}
                              </Badge>
                              {infra.priority === "critical" && (
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
              )
            })}

            {filteredInfrastructure.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No infrastructure visible</p>
                <p className="text-xs mt-1">Enable layers above</p>
              </div>
            )}
          </div>
        </div>

        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 bg-black/30 z-[1000]" onClick={() => setSidebarOpen(false)} />
        )}

        {selectedInfra && (
          <InfrastructureDetailPanel
            infrastructure={selectedInfra}
            open={detailPanelOpen}
            onClose={() => {
              setDetailPanelOpen(false)
              setSelectedInfra(null)
            }}
            onUpdate={() => {
              const fetchInfrastructure = async () => {
                const supabase = createClient()
                const { data } = await supabase.from("infrastructure_plans").select("*").order("name")

                if (data) setInfrastructure(data)
              }
              fetchInfrastructure()
            }}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}

        <AddInfrastructureDialog
          open={addDialogOpen}
          onClose={() => {
            setAddDialogOpen(false)
            setClickedCoordinates(null)
          }}
          onAdd={() => {
            const fetchInfrastructure = async () => {
              const supabase = createClient()
              const { data } = await supabase.from("infrastructure_plans").select("*").order("name")

              if (data) setInfrastructure(data)
            }
            fetchInfrastructure()
            setAddDialogOpen(false)
            setClickedCoordinates(null)
          }}
          initialCoordinates={clickedCoordinates}
        />

        <EditInfrastructureDialog
          open={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false)
            setEditingInfra(null)
          }}
          onUpdate={() => {
            const fetchInfrastructure = async () => {
              const supabase = createClient()
              const { data } = await supabase.from("infrastructure_plans").select("*").order("name")

              if (data) setInfrastructure(data)
            }
            fetchInfrastructure()
          }}
          infrastructure={editingInfra}
        />
      </div>
    </AppLayout>
  )
}

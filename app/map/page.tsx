"use client"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useState, useEffect, useRef, useCallback } from "react"
import type { InfrastructurePlan } from "@/lib/types"
import {
  Layers,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Wifi,
  Droplet,
  Zap,
  Plus,
  MapPin,
  Sparkles,
} from "lucide-react"
import { InfrastructureDetailPanel } from "@/components/infrastructure-detail-panel"
import { AddInfrastructureDialog } from "@/components/add-infrastructure-dialog"
import { EditInfrastructureDialog } from "@/components/edit-infrastructure-dialog"
import { DeleteDialog } from "@/components/delete-dialog"
import { InfrastructureSearchDialog } from "@/components/infrastructure-search-dialog"

interface Location {
  id: string
  name: string
  description: string | null
}

export default function MapPage() {
  const [infrastructure, setInfrastructure] = useState<InfrastructurePlan[]>([])
  const [selectedInfra, setSelectedInfra] = useState<InfrastructurePlan | null>(null)
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingInfra, setEditingInfra] = useState<InfrastructurePlan | null>(null)
  const [clickedCoordinates, setClickedCoordinates] = useState<{ lat: number; lng: number } | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [blinkingMarkerId, setBlinkingMarkerId] = useState<string | null>(null)
  const [newInfraLocation, setNewInfraLocation] = useState<{ lat: number; lng: number } | null>(null)

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mapType, setMapType] = useState<"street" | "satellite" | "terrain" | "hybrid">("street")
  const [terrainOpacity, setTerrainOpacity] = useState(0.5)

  const [filters, setFilters] = useState({
    internet: true,
    water: true,
    electricity: true,
  })

  const [expandedCategory, setExpandedCategory] = useState<"internet" | "water" | "electricity" | null>("internet")

  const [locations, setLocations] = useState<Location[]>([])
  const [groupBy, setGroupBy] = useState<"category" | "location">("category")

  const [leafletLoaded, setLeafletLoaded] = useState(false)

  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<any[]>([])
  const baseLayerRef = useRef<any>(null)
  const overlayLayerRef = useRef<any>(null)

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
    if (!leafletLoaded || typeof window === "undefined" || mapRef.current) return

    const L = (window as any).L

    if (mapContainerRef.current) {
      const map = L.map(mapContainerRef.current, {
        preferCanvas: true,
        zoomControl: true,
        attributionControl: true,
      }).setView([-39.8255, -73.2215], 14)

      const initialTileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
        subdomains: ["a", "b", "c"],
      })
      initialTileLayer.addTo(map)
      baseLayerRef.current = initialTileLayer

      map.on("contextmenu", (e: any) => {
        setNewInfraLocation(e.latlng)
        setAddDialogOpen(true)
      })

      mapRef.current = map

      setTimeout(() => {
        map.invalidateSize()
      }, 100)

      console.log("[v0] Map initialized successfully")
    }
  }, [leafletLoaded])

  useEffect(() => {
    if (!mapRef.current || !leafletLoaded || typeof window === "undefined") return

    const L = (window as any).L
    const map = mapRef.current

    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current)
      baseLayerRef.current = null
    }

    if (overlayLayerRef.current) {
      map.removeLayer(overlayLayerRef.current)
      overlayLayerRef.current = null
    }

    if (mapType === "hybrid") {
      baseLayerRef.current = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "© Esri",
          maxZoom: 19,
        },
      ).addTo(map)

      overlayLayerRef.current = L.tileLayer("https://tile.opentopomap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenTopoMap contributors",
        maxZoom: 17,
        opacity: terrainOpacity,
      }).addTo(map)
    } else {
      let tileUrl = ""
      let attribution = ""
      let maxZoom = 19
      let subdomains: string[] = []

      switch (mapType) {
        case "satellite":
          tileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution = "© Esri"
          break
        case "terrain":
          tileUrl = "https://tile.opentopomap.org/{z}/{x}/{y}.png"
          attribution = "© OpenTopoMap contributors"
          maxZoom = 17
          break
        case "street":
        default:
          tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution = "© OpenStreetMap contributors"
          subdomains = ["a", "b", "c"]
      }

      baseLayerRef.current = L.tileLayer(tileUrl, {
        attribution,
        maxZoom,
        subdomains,
      }).addTo(map)
    }

    map.invalidateSize()
    setTimeout(() => {
      map.invalidateSize()
    }, 100)
  }, [mapType, leafletLoaded, terrainOpacity])

  useEffect(() => {
    if (!mapRef.current || !leafletLoaded || mapType !== "hybrid") return
    if (!overlayLayerRef.current) return

    console.log("[v0] Updating terrain opacity to:", terrainOpacity)
    overlayLayerRef.current.setOpacity(terrainOpacity)
  }, [terrainOpacity, leafletLoaded, mapType])

  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize()
      }, 300)
    }
  }, [detailPanelOpen, sidebarOpen, addDialogOpen, editDialogOpen])

  useEffect(() => {
    const fetchInfrastructure = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("infrastructure_plans").select("*").order("name")

      if (data) setInfrastructure(data)
    }

    const fetchLocations = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("locations").select("*").eq("is_active", true).order("name")

      if (data) setLocations(data)
    }

    fetchInfrastructure()
    fetchLocations()
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

  const infraByLocation = locations.reduce(
    (acc, location) => {
      acc[location.id] = filteredInfrastructure.filter((i) => i.location_id === location.id)
      return acc
    },
    {} as Record<string, InfrastructurePlan[]>,
  )

  const infraWithoutLocation = filteredInfrastructure.filter((i) => !i.location_id)

  const handleEdit = (infra: InfrastructurePlan) => {
    setEditingInfra(infra)
    setEditDialogOpen(true)
    setDetailPanelOpen(false)
  }

  const handleDelete = async () => {
    const supabase = createClient()
    const { error } = await supabase.from("infrastructure_plans").delete().eq("id", selectedInfra?.id)

    if (!error) {
      const { data } = await supabase.from("infrastructure_plans").select("*").order("name")
      if (data) setInfrastructure(data)
      setSelectedInfra(null)
      setDetailPanelOpen(false)
      setShowDeleteDialog(false)
    }
  }

  const blinkMarker = useCallback(
    (infraId: string) => {
      if (!mapRef.current || !leafletLoaded || typeof window === "undefined") return

      const L = (window as any).L
      const markerToFind = markersRef.current.find((m) => {
        const infra = infrastructure.find((i) => i.id === infraId)
        if (!infra) return false
        const latLng = m.getLatLng()
        return latLng.lat === infra.latitude && latLng.lng === infra.longitude
      })

      if (markerToFind) {
        const infra = infrastructure.find((i) => i.id === infraId)
        if (!infra) return
        const originalIcon = markerToFind.getIcon()
        const color = getInfraColor(infra)
        const symbol = getIconSymbol(infra.category)

        let blinkCount = 0
        const blinkInterval = setInterval(() => {
          if (blinkCount >= 6) {
            clearInterval(blinkInterval)
            markerToFind.setIcon(originalIcon)
            return
          }

          const isHighlighted = blinkCount % 2 === 0
          const icon = L.divIcon({
            className: "custom-marker",
            html: `<div style="
            width: ${isHighlighted ? "44px" : "32px"};
            height: ${isHighlighted ? "44px" : "32px"};
            border-radius: 50%;
            background-color: ${isHighlighted ? "#fff" : color};
            border: ${isHighlighted ? `4px solid ${color}` : "3px solid white"};
            box-shadow: 0 ${isHighlighted ? "4" : "2"}px ${isHighlighted ? "12" : "8"}px rgba(0,0,0,${isHighlighted ? "0.4" : "0.3"});
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${isHighlighted ? color : "white"};
            font-weight: bold;
            transition: all 0.2s ease;
          ">${symbol}</div>`,
            iconSize: [isHighlighted ? 44 : 32, isHighlighted ? 44 : 32],
            iconAnchor: [isHighlighted ? 22 : 16, isHighlighted ? 22 : 16],
          })

          markerToFind.setIcon(icon)
          blinkCount++
        }, 300)
      }
    },
    [leafletLoaded, infrastructure],
  )

  const handleInfraClick = useCallback(
    (infra: any) => {
      if (mapRef.current) {
        mapRef.current.setView([infra.latitude, infra.longitude], 17)
        blinkMarker(infra.id)
      }
      setSelectedInfra(infra)
      setDetailPanelOpen(true)
      setSidebarOpen(false)
    },
    [blinkMarker],
  )

  const handleSelectFromSearch = (infrastructure: any) => {
    console.log("[v0] Infrastructure selected from search:", infrastructure)
    setSelectedInfra(infrastructure)

    if (mapRef.current) {
      mapRef.current.setView([infrastructure.latitude, infrastructure.longitude], 18)

      setBlinkingMarkerId(infrastructure.id)
      setTimeout(() => setBlinkingMarkerId(null), 1800)
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-full w-full">
        <PageHeader
          title="GIS Infrastructure Map"
          description="Internet, Water, and Electrical systems"
          actions={
            <div className="flex gap-2">
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Infrastructure
              </Button>
            </div>
          }
        />

        <div className="relative flex-1 w-full overflow-hidden">
          <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />

          {!leafletLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-[100]">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
                <p className="text-sm text-gray-600">Loading map...</p>
              </div>
            </div>
          )}

          {/* Map controls remain the same */}
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
                    <div className="flex items-center gap-2 flex-1">
                      <Wifi className="h-4 w-4 text-blue-600" />
                      <button
                        onClick={() => setExpandedCategory(expandedCategory === "internet" ? null : "internet")}
                        className="text-sm text-gray-700 hover:text-gray-900 flex-1 text-left flex items-center justify-between"
                      >
                        <span>Internet ({infraByCategory.internet.length})</span>
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${expandedCategory === "internet" ? "rotate-90" : ""}`}
                        />
                      </button>
                    </div>
                  </label>

                  {expandedCategory === "internet" && filters.internet && (
                    <div className="ml-8 space-y-2 max-h-64 overflow-y-auto border-l border-blue-200 pl-3">
                      {infraByCategory.internet.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No Internet points</p>
                      ) : (
                        infraByCategory.internet.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleInfraClick(item)}
                            className="block w-full text-left p-2 rounded hover:bg-blue-50 transition-colors text-xs text-gray-600 hover:text-gray-900"
                          >
                            <div className="font-medium text-gray-800">{item.name}</div>
                            <div className="text-xs text-gray-500">{item.type || "Infrastructure"}</div>
                          </button>
                        ))
                      )}
                    </div>
                  )}

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

              {filteredInfrastructure.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No infrastructure visible</p>
                  <p className="text-xs mt-1">Enable layers above</p>
                </div>
              )}
            </div>
          </div>

          {detailPanelOpen && selectedInfra && (
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
              onEdit={() => handleEdit(selectedInfra)}
              onDelete={() => {
                setShowDeleteDialog(true)
              }}
            />
          )}

          <AddInfrastructureDialog
            open={addDialogOpen}
            onClose={() => {
              setAddDialogOpen(false)
              setClickedCoordinates(null)
              setNewInfraLocation(null)
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
              setNewInfraLocation(null)
            }}
            initialCoordinates={newInfraLocation}
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

          <DeleteDialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} onDelete={handleDelete} />

          <InfrastructureSearchDialog
            open={searchDialogOpen}
            onOpenChange={setSearchDialogOpen}
            onSelectInfrastructure={handleSelectFromSearch}
          />

          <button
            onClick={() => setSearchDialogOpen(true)}
            className="fixed bottom-6 right-6 z-[1000] h-14 w-14 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center group"
            aria-label="AI Search"
          >
            <Sparkles className="h-6 w-6 text-white group-hover:animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
            </span>
          </button>
        </div>
      </div>
    </AppLayout>
  )
}

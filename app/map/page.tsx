"use client"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useState, useEffect, useRef, useCallback } from "react"
import type { InfrastructurePlan, InfrastructureConnection } from "@/lib/types"
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
  Flower as Shower,
  Circle,
  Package,
  Wrench,
  CastleIcon as CattleIcon,
  Upload,
  MapIcon,
} from "lucide-react"
import KmzMapView from "@/components/kmz-map-viewer"
import { InfrastructureDetailPanel } from "@/components/infrastructure-detail-panel"

interface Location {
  id: string
  name: string
  description: string | null
}

interface Utility {
  id: string
  category: string
  status: string
  notes: string | null
  phase: "phase1" | "phase2" | "general"
  last_update: string
}

// Phase 1 utilities (Deadline: 13 December 2025)
const PHASE_1_UTILITIES = ["electricity", "water", "internet"]

// Phase 2 utilities
const PHASE_2_UTILITIES = [
  "drinking_water",
  "heating",
  "gasoline",
  "gas",
  "wood_supply",
  "trash",
  "sewage",
  "storage",
  "equipment_inventory",
  "food_storage",
  "security",
  "fire_safety",
]

const UTILITY_SPECS = {
  electricity: {
    icon: "⚡",
    color: "#eab308",
    label: "Electricity",
    requirements: ["SLD", "Maps", "Equipment Specs", "Monitoring", "Issues", "Improvement Plan"],
  },
  water: {
    icon: "💧",
    color: "#06b6d4",
    label: "Water Supply",
    requirements: ["Sources & Pumps", "Distribution Maps", "Maintenance Logs", "Issues", "Improvement Plan"],
  },
  internet: {
    icon: "📡",
    color: "#3b82f6",
    label: "Internet & Network",
    requirements: ["Router Maps", "Bandwidth", "Coverage Issues", "Monitoring", "Improvement Plan"],
  },
  drinking_water: {
    icon: "🔵",
    color: "#06d6d4",
    label: "Drinking Water",
    requirements: ["Treatment", "Storage", "Maintenance"],
  },
  heating: {
    icon: "🔥",
    color: "#f97316",
    label: "Heating System",
    requirements: ["Equipment", "Distribution", "Maintenance"],
  },
  gasoline: {
    icon: "⛽",
    color: "#dc2626",
    label: "Gasoline Storage",
    requirements: ["Tank Location", "Capacity", "Safety Protocol"],
  },
  gas: {
    icon: "💨",
    color: "#60a5fa",
    label: "Gas System",
    requirements: ["Piping", "Valves", "Maintenance"],
  },
  wood_supply: {
    icon: "🪵",
    color: "#92400e",
    label: "Wood Supply",
    requirements: ["Storage Location", "Quantity", "Maintenance"],
  },
  trash: {
    icon: "🗑️",
    color: "#6b7280",
    label: "Trash Management",
    requirements: ["Collection Points", "Schedule", "Disposal"],
  },
  sewage: {
    icon: "🚿",
    color: "#8b5cf6",
    label: "Sewage System",
    requirements: ["Treatment Plant", "Pipes", "Maintenance"],
  },
  storage: {
    icon: "📦",
    color: "#10b981",
    label: "Storage Systems",
    requirements: ["Inventory", "Capacity", "Organization"],
  },
  equipment_inventory: {
    icon: "🔧",
    color: "#6366f1",
    label: "Equipment",
    requirements: ["List", "Condition", "Location"],
  },
  food_storage: {
    icon: "🥫",
    color: "#fbbf24",
    label: "Food Storage",
    requirements: ["Capacity", "Temperature", "Inventory"],
  },
  security: {
    icon: "🛡️",
    color: "#ec4899",
    label: "Security Systems",
    requirements: ["Cameras", "Access Control", "Monitoring"],
  },
  fire_safety: {
    icon: "🚒",
    color: "#991b1b",
    label: "Fire Safety",
    requirements: ["Extinguishers", "Alarms", "Emergency Exits"],
  },
  cattle: {
    icon: "🐄",
    color: "#8b7355",
    label: "Cattle",
    requirements: ["Pasture", "Facilities", "Inventory"],
  },
}

export default function MapPage() {
  const [infrastructure, setInfrastructure] = useState<InfrastructurePlan[]>([])
  const [utilities, setUtilities] = useState<Utility[]>([])
  const [selectedInfra, setSelectedInfra] = useState<InfrastructurePlan | null>(null)
  const [selectedUtility, setSelectedUtility] = useState<Utility | null>(null)
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingInfra, setEditingInfra] = useState<InfrastructurePlan | null>(null)
  const [clickedCoordinates, setClickedCoordinates] = useState<{ lat: number; lng: number } | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [blinkingMarkerId, setBlinkingMarkerId] = useState<string | null>(null)
  const [newInfraLocation, setNewInfraLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [kmzLayers, setKmzLayers] = useState<any[]>([])
  const [kmzLoadedIds, setKmzLoadedIds] = useState<Set<string>>(new Set())
  const [showKmzUploadDialog, setShowKmzUploadDialog] = useState(false)
  const [kmzFilterEnabled, setKmzFilterEnabled] = useState(false)

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mapType, setMapType] = useState<"street" | "satellite" | "terrain" | "hybrid">("street")
  const [terrainOpacity, setTerrainOpacity] = useState(0.5)

  const [filters, setFilters] = useState({
    internet: true,
    water: true,
    electricity: true,
    cattle: true,
    drinking_water: true,
    heating: true,
    gasoline: true,
    gas: true,
    wood_supply: true,
    trash: true,
    sewage: true,
    storage: true,
    equipment_inventory: true,
    food_storage: true,
    security: true,
    fire_safety: true,
  })

  const [expandedCategory, setExpandedCategory] = useState<
    | "internet"
    | "water"
    | "electricity"
    | "cattle"
    | "drinking_water"
    | "heating"
    | "gasoline"
    | "gas"
    | "wood_supply"
    | "trash"
    | "sewage"
    | "storage"
    | "equipment_inventory"
    | "food_storage"
    | "security"
    | "fire_safety"
    | null
  >("phase1")

  const [locations, setLocations] = useState<Location[]>([])
  const [groupBy, setGroupBy] = useState<"category" | "location" | "phase">("phase")

  const [leafletLoaded, setLeafletLoaded] = useState(false)

  const [showRoads, setShowRoads] = useState(false)
  const [showBuildings, setShowBuildings] = useState(false)
  const [visibleConnections, setVisibleConnections] = useState<Set<string>>(new Set())
  const [connections, setConnections] = useState<InfrastructureConnection[]>([])

  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<any[]>([])
  const baseLayerRef = useRef<any>(null)
  const overlayLayerRef = useRef<any>(null)
  const kmzLayersRef = useRef<any>([])

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
    script.onload = () => {
      setTimeout(() => setLeafletLoaded(true), 100)
    }
    script.onerror = () => {
      console.error("[v0] Failed to load Leaflet library")
    }
    document.head.appendChild(script)

    return () => {
      // Clean up only if they haven't been removed already
      if (document.head.contains(link)) document.head.removeChild(link)
      if (document.head.contains(script)) document.head.removeChild(script)
    }
  }, [])

  useEffect(() => {
    if (!leafletLoaded || typeof window === "undefined" || mapRef.current) return

    const L = (window as any).L

    if (mapContainerRef.current) {
      mapContainerRef.current.style.height = "100%"
      mapContainerRef.current.style.width = "100%"

      const isMobile = window.innerWidth < 768
      const isTablet = window.innerWidth < 1024
      const initialZoom = isMobile ? 9 : isTablet ? 10 : 11

      const map = L.map(mapContainerRef.current, {
        preferCanvas: true,
        zoomControl: true,
        attributionControl: true,
      }).setView([-39.8255, -73.2215], initialZoom)

      const initialTileLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20,
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
      }, 50)
      setTimeout(() => {
        map.invalidateSize()
      }, 200)
      setTimeout(() => {
        map.invalidateSize()
      }, 500)

      if (typeof ResizeObserver !== "undefined") {
        const resizeObserver = new ResizeObserver(() => {
          map.invalidateSize()
        })
        resizeObserver.observe(mapContainerRef.current)

        return () => {
          resizeObserver.disconnect()
        }
      }

      console.log("[v0] Map initialized successfully with Carto tiles")
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
          tileUrl = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution =
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
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
          width: 16px;
          height: 16px;
          border-radius: 2px;
          background-color: ${color};
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 8px;
        ">${getIconSymbol(infra.category)}</div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
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

  useEffect(() => {
    const fetchUtilities = async () => {
      const supabase = createClient()
      const { data, error } = await supabase.from("utilities").select("*")

      if (error) {
        console.error("Error fetching utilities:", error)
        return
      }

      const enrichedUtilities = (data || []).map((util: any) => ({
        ...util,
        phase: PHASE_1_UTILITIES.includes(util.category)
          ? "phase1"
          : PHASE_2_UTILITIES.includes(util.category)
            ? "phase2"
            : "general",
      }))

      setUtilities(enrichedUtilities)
    }

    fetchUtilities()
  }, [])

  useEffect(() => {
    const loadInfrastructure = async () => {
      const supabase = createClient()
      const { data, error } = await supabase.from("infrastructure_plans").select("*").order("name")

      if (error) {
        console.error("[v0] Error loading infrastructure:", error)
        return
      }

      if (data) {
        setInfrastructure(data)
      }
    }

    loadInfrastructure()
  }, [])

  useEffect(() => {
    const loadLocations = async () => {
      const supabase = createClient()
      const { data, error } = await supabase.from("locations").select("*").order("name")

      if (error) {
        console.error("[v0] Error loading locations:", error)
        return
      }

      if (data) {
        setLocations(data)
      }
    }

    loadLocations()
  }, [])

  useEffect(() => {
    const loadKmzFiles = async () => {
      const supabase = createClient()
      const { data, error } = await supabase.from("kmz_files").select("*").eq("is_active", true)

      if (error) {
        if (error.message.includes("Could not find the table")) {
          console.log("[v0] KMZ files table not yet created. Run migration script 026_create_kmz_management.sql")
          setKmzLayers([]) // Initialize empty array
        } else {
          console.error("[v0] Error loading KMZ files:", error)
        }
        return
      }

      if (data) {
        setKmzLayers(data)
      }
    }

    loadKmzFiles()
  }, [])

  useEffect(() => {
    if (!mapRef.current || !leafletLoaded || typeof window === "undefined") return

    const L = (window as any).L
    const map = mapRef.current

    // Remove existing KMZ layers
    kmzLayersRef.current.forEach((layer: any) => {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer)
      }
    })
    kmzLayersRef.current = []
    setKmzLoadedIds(new Set())

    if (!kmzFilterEnabled) return

    // Add KMZ layers
    kmzLayers.forEach((kmzFile) => {
      try {
        // Parse KMZ (which is a ZIP file containing KML)
        fetch(kmzFile.file_url)
          .then((response) => response.blob())
          .then((blob) => {
            // For now, we'll note that full KMZ parsing requires a library
            // This is a placeholder that shows the KMZ is being loaded
            console.log(`[v0] KMZ file loaded: ${kmzFile.name}`)
            setKmzLoadedIds((prev) => new Set(prev).add(kmzFile.id))
          })
          .catch((error) => {
            console.error(`[v0] Error loading KMZ ${kmzFile.name}:`, error)
          })
      } catch (error) {
        console.error(`[v0] Error processing KMZ ${kmzFile.name}:`, error)
      }
    })
  }, [kmzFilterEnabled, kmzLayers, leafletLoaded])

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from("infrastructure_connections").select("*").eq("status", "active")

        if (error) throw error
        setConnections(data || [])
      } catch (error) {
        console.error("Error fetching connections:", error)
      }
    }

    fetchConnections()
  }, [])

  const toggleConnectionVisibility = (category: string) => {
    setVisibleConnections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }

  const getInfraColor = (infra: InfrastructurePlan) => {
    if (infra.priority === "critical") return "#dc2626"
    switch (infra.category) {
      case "internet":
        return "#3b82f6"
      case "water":
        return "#06b6d4"
      case "electricity":
        return "#eab308"
      case "cattle":
        return "#8b7355"
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
      case "cattle":
        return CattleIcon
      case "drinking_water":
        return Circle
      case "heating":
        return Zap
      case "gasoline":
        return Zap
      case "gas":
        return Zap
      case "wood_supply":
        return Zap
      case "trash":
        return Zap
      case "sewage":
        return Shower
      case "storage":
        return Package
      case "equipment_inventory":
        return Wrench
      case "food_storage":
        return Zap
      case "security":
        return Zap
      case "fire_safety":
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
      case "cattle":
        return "🐄"
      case "drinking_water":
        return "🔵"
      case "heating":
        return "🔥"
      case "gasoline":
        return "⛽"
      case "gas":
        return "💨"
      case "wood_supply":
        return "🪵"
      case "trash":
        return "🗑️"
      case "sewage":
        return "🚿"
      case "storage":
        return "📦"
      case "equipment_inventory":
        return "🔧"
      case "food_storage":
        return "🥫"
      case "security":
        return "🛡️"
      case "fire_safety":
        return "🚒"
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

  const filteredInfrastructure = infrastructure.filter((infra) => {
    // Check if the category is in the filters object and is enabled
    return filters[infra.category as keyof typeof filters]
  })

  const infraByCategory = {
    // Phase 1 utilities
    internet: filteredInfrastructure.filter((item) => item.category === "internet"),
    water: filteredInfrastructure.filter((item) => item.category === "water"),
    electricity: filteredInfrastructure.filter((item) => item.category === "electricity"),
    cattle: filteredInfrastructure.filter((item) => item.category === "cattle"),
    // Phase 2 utilities
    drinking_water: filteredInfrastructure.filter((item) => item.category === "drinking_water"),
    heating: filteredInfrastructure.filter((item) => item.category === "heating"),
    gasoline: filteredInfrastructure.filter((item) => item.category === "gasoline"),
    gas: filteredInfrastructure.filter((item) => item.category === "gas"),
    wood_supply: filteredInfrastructure.filter((item) => item.category === "wood_supply"),
    trash: filteredInfrastructure.filter((item) => item.category === "trash"),
    sewage: filteredInfrastructure.filter((item) => item.category === "sewage"),
    storage: filteredInfrastructure.filter((item) => item.category === "storage"),
    equipment_inventory: filteredInfrastructure.filter((item) => item.category === "equipment_inventory"),
    food_storage: filteredInfrastructure.filter((item) => item.category === "food_storage"),
    security: filteredInfrastructure.filter((item) => item.category === "security"),
    fire_safety: filteredInfrastructure.filter((item) => item.category === "fire_safety"),
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
            width: ${isHighlighted ? "24px" : "16px"};
            height: ${isHighlighted ? "24px" : "16px"};
            border-radius: ${isHighlighted ? "3px" : "2px"};
            background-color: ${isHighlighted ? "#fff" : color};
            border: ${isHighlighted ? `3px solid ${color}` : "2px solid white"};
            box-shadow: 0 ${isHighlighted ? "2" : "1"}px ${isHighlighted ? "6" : "4"}px rgba(0,0,0,${isHighlighted ? "0.4" : "0.3"});
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${isHighlighted ? color : "white"};
            font-weight: bold;
            font-size: ${isHighlighted ? "10px" : "8px"};
            transition: all 0.2s ease;
          ">${symbol}</div>`,
            iconSize: [isHighlighted ? 24 : 16, isHighlighted ? 24 : 16],
            iconAnchor: [isHighlighted ? 12 : 8, isHighlighted ? 12 : 8],
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

  const getPhaseLabel = (phase: string) => {
    if (phase === "phase1") return "Phase 1"
    if (phase === "phase2") return "Phase 2 (After Phase 1)"
    return "General"
  }

  const getUtilityColor = (category: string) => {
    return (UTILITY_SPECS as any)[category]?.color || "#6b7280"
  }

  const getUtilityIcon = (category: string) => {
    return (UTILITY_SPECS as any)[category]?.icon || "📍"
  }

  const getPhaseColor = (category: string) => {
    if (PHASE_1_UTILITIES.includes(category)) return "#dc2626" // Red for Phase 1
    if (PHASE_2_UTILITIES.includes(category)) return "#3b82f6" // Blue for Phase 2
    return "#6b7280"
  }

  const INFRASTRUCTURE_CATEGORIES = [
    {
      name: "PHASE 1",
      items: infrastructure
        .filter((item) => item.phase === "phase1")
        .map((item) => ({
          name: item.name,
          category: item.category,
          id: item.id,
        })),
    },
    {
      name: "PHASE 2 UTILITIES",
      items: infrastructure
        .filter((item) => item.phase === "phase2")
        .map((item) => ({
          name: item.name,
          category: item.category,
          id: item.id,
        })),
    },
    {
      name: "GIS OVERLAYS",
      items: [
        {
          name: "Roads (Draw with Leaflet toolbar)",
          category: "roads",
          id: "roads",
          type: "toggle",
          checked: showRoads,
        },
        {
          name: "Buildings (Draw with Leaflet toolbar)",
          category: "buildings",
          id: "buildings",
          type: "toggle",
          checked: showBuildings,
        },
        {
          name: "Roads Connections (Show connection lines)",
          category: "roads_connections",
          id: "roads_connections",
          type: "toggle",
          checked: visibleConnections.has("road"),
        },
        {
          name: "Internet Connections (Show network lines)",
          category: "internet_connections",
          id: "internet_connections",
          type: "toggle",
          checked: visibleConnections.has("internet"),
        },
        {
          name: "Water Connections (Show pipeline lines)",
          category: "water_connections",
          id: "water_connections",
          type: "toggle",
          checked: visibleConnections.has("water"),
        },
        {
          name: "Gas Connections (Show gas lines)",
          category: "gas_connections",
          id: "gas_connections",
          type: "toggle",
          checked: visibleConnections.has("gas"),
        },
      ],
    },
  ]

  return (
    <AppLayout>
      <div className="relative w-full h-[calc(100vh-3.5rem)] bg-gray-100 overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full" />

        <PageHeader
          title="GIS Infrastructure Map"
          description="Internet, Water, Electricity, Cattle, Drinking Water, Heating, Gasoline, Gas, Wood Supply, Trash, Sewage, Storage, Equipment Inventory, Food Storage, Security, Fire Safety"
          actions={
            <div className="flex gap-2">
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Infrastructure
              </Button>
            </div>
          }
        />

        <div className="absolute bottom-4 left-4 z-[1000] space-y-2">
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
          className="absolute top-4 z-[1002] bg-white rounded-lg shadow-lg p-2 border border-gray-200 hover:bg-gray-50 transition-colors right-4 md:right-[400px]"
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

        {/* Map Layers Sidebar */}
        <div className="absolute top-4 left-4 z-[999] bg-white rounded-lg shadow-lg p-4 md:hidden">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
          >
            <MapIcon className="h-5 w-5" />
            <span className="font-semibold">Layers</span>
          </button>
        </div>

        <div
          className={`
            ${sidebarOpen ? "fixed md:absolute" : "absolute"} top-0 right-0 bottom-0
            w-[85vw] max-w-md md:max-w-96 md:w-96
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
                {/* Phase 1 Utilities */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-red-600 mb-2">PHASE 1</p>
                  {/* Internet */}
                  <label className="flex items-center gap-3 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={filters.internet}
                      onChange={(e) => setFilters({ ...filters, internet: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-lg">{getUtilityIcon("internet")}</span>
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
                    <div className="ml-8 space-y-2 max-h-64 overflow-y-auto border-l border-blue-200 pl-3 mb-2">
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

                  {/* Water */}
                  <label className="flex items-center gap-3 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={filters.water}
                      onChange={(e) => setFilters({ ...filters, water: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getUtilityIcon("water")}</span>
                      <span className="text-sm text-gray-700">Water ({infraByCategory.water.length})</span>
                    </div>
                  </label>

                  {/* Electricity */}
                  <label className="flex items-center gap-3 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={filters.electricity}
                      onChange={(e) => setFilters({ ...filters, electricity: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getUtilityIcon("electricity")}</span>
                      <span className="text-sm text-gray-700">Electricity ({infraByCategory.electricity.length})</span>
                    </div>
                  </label>
                </div>

                {/* Phase 2 Utilities */}
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-xs font-semibold text-blue-600 mb-2">PHASE 2 UTILITIES</p>
                  {/* Cattle */}
                  <label className="flex items-center gap-3 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={filters.cattle}
                      onChange={(e) => setFilters({ ...filters, cattle: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-lg">{getUtilityIcon("cattle")}</span>
                      <button
                        onClick={() => setExpandedCategory(expandedCategory === "cattle" ? null : "cattle")}
                        className="text-sm text-gray-700 hover:text-gray-900 flex-1 text-left flex items-center justify-between"
                      >
                        <span>Cattle ({infraByCategory.cattle.length})</span>
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${expandedCategory === "cattle" ? "rotate-90" : ""}`}
                        />
                      </button>
                    </div>
                  </label>

                  {expandedCategory === "cattle" && filters.cattle && (
                    <div className="ml-8 space-y-2 max-h-64 overflow-y-auto border-l border-amber-200 pl-3 mb-2">
                      {infraByCategory.cattle.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No Cattle points</p>
                      ) : (
                        infraByCategory.cattle.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleInfraClick(item)}
                            className="block w-full text-left p-2 rounded hover:bg-amber-50 transition-colors text-xs text-gray-600 hover:text-gray-900"
                          >
                            <div className="font-medium text-gray-800">{item.name}</div>
                            <div className="text-xs text-gray-500">{item.description}</div>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {/* Other Phase 2 Utilities */}
                  {[
                    "drinking_water",
                    "heating",
                    "gasoline",
                    "gas",
                    "wood_supply",
                    "trash",
                    "sewage",
                    "storage",
                    "equipment_inventory",
                    "food_storage",
                    "security",
                    "fire_safety",
                  ].map((category) => {
                    const spec = UTILITY_SPECS[category as keyof typeof UTILITY_SPECS]
                    if (!spec) return null
                    const items = infraByCategory[category as keyof typeof infraByCategory] || []

                    return (
                      <label key={category} className="flex items-center gap-3 cursor-pointer mb-2">
                        <input
                          type="checkbox"
                          checked={filters[category as keyof typeof filters]}
                          onChange={(e) => setFilters({ ...filters, [category]: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300 focus:ring-offset-0"
                          style={{
                            accentColor: spec.color,
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{spec.icon}</span>
                          <span className="text-sm text-gray-700">
                            {spec.label} ({items.length})
                          </span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* KMZ Overlays section */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapIcon className="h-4 w-4 md:h-5 md:w-5 text-gray-700" />
                  <h3 className="font-semibold text-sm md:text-base text-black">GIS Overlays</h3>
                </div>
              </div>

              <Button onClick={() => setShowKmzUploadDialog(true)} className="w-full text-xs" variant="outline">
                <Upload className="mr-2 h-3 w-3" />
                Upload KMZ
              </Button>

              {/* Add toggles for Roads, Buildings, and Connections */}
              <div className="mt-4 space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRoads}
                    onChange={(e) => setShowRoads(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">Roads (Draw with Leaflet toolbar)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBuildings}
                    onChange={(e) => setShowBuildings(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">Buildings (Draw with Leaflet toolbar)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleConnections.has("road")}
                    onChange={() => toggleConnectionVisibility("road")}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Roads Connections (Show connection lines)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleConnections.has("internet")}
                    onChange={() => toggleConnectionVisibility("internet")}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Internet Connections (Show network lines)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleConnections.has("water")}
                    onChange={() => toggleConnectionVisibility("water")}
                    className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-gray-700">Water Connections (Show pipeline lines)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleConnections.has("gas")}
                    onChange={() => toggleConnectionVisibility("gas")}
                    className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Gas Connections (Show gas lines)</span>
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

        {/* Render KmzMapViewer component and pass necessary props */}
        <KmzMapView
          coordinatesVisible={false} // Set to false as per update
          infrastructureData={infrastructure}
          visibleConnections={visibleConnections}
          infrastructureConnections={connections} // Use the fetched connections
        />

        {/* Keeping only the top-right fullscreen button with responsive positioning for Infrastructure panel */}
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

        {/* Infrastructure Detail Panel */}
        {selectedInfra && detailPanelOpen && (
          <InfrastructureDetailPanel
            infrastructure={selectedInfra}
            onClose={() => setDetailPanelOpen(false)}
            onUpdate={() => {
              // Reload infrastructure data
              const loadInfra = async () => {
                const supabase = createClient()
                const { data } = await supabase.from("infrastructure_plans").select("*")
                if (data) setInfrastructure(data)
              }
              loadInfra()
            }}
            onEdit={() => {
              setEditingInfra(selectedInfra)
              setEditDialogOpen(true)
            }}
            onDelete={() => {
              setDetailPanelOpen(false)
              setSelectedInfra(null)
              // Reload infrastructure data
              const loadInfra = async () => {
                const supabase = createClient()
                const { data } = await supabase.from("infrastructure_plans").select("*")
                if (data) setInfrastructure(data)
              }
              loadInfra()
            }}
          />
        )}
      </div>
    </AppLayout>
  )
}

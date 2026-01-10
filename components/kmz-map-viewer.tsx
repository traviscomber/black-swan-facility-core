"use client"

import { useEffect, useRef, useState } from "react"
import type { InfrastructureConnection } from "@/lib/types"

interface KmzMapViewProps {
  visibleLayers?: Set<string>
  kmzFiles?: any[]
  connections?: InfrastructureConnection[]
  visibleConnections?: Set<string>
  showRoads?: boolean
  showBuildings?: boolean
  infrastructureData?: any[]
  onMapClick?: (lat: number, lng: number) => void
  onMarkerClick?: (infra: any) => void
  isDrawingConnection?: boolean
  connectionStart?: any | null
}

const KmzMapView = ({
  visibleLayers = new Set(),
  kmzFiles = [],
  connections = [],
  visibleConnections = new Set(),
  showRoads = false,
  showBuildings = false,
  infrastructureData = [],
  onMapClick,
  onMarkerClick,
  isDrawingConnection = false,
  connectionStart = null,
}: KmzMapViewProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [mapType, setMapType] = useState<"street" | "satellite" | "terrain" | "hybrid">("street")
  const [terrainOpacity, setTerrainOpacity] = useState(0.5)
  const [mapReady, setMapReady] = useState(false) // Added mapReady state to track when map is initialized
  const tileLayersRef = useRef<any>({})
  const polylineLayersRef = useRef<any>(null)
  const drawnItemsRef = useRef<any>(null)
  const drawControlRef = useRef<any>(null)
  const infrastructureMarkersRef = useRef<any>(null)
  const connectionLinesRef = useRef<any>([])

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return

    const initMap = async () => {
      const L = await import("leaflet")

      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement("link")
        link.rel = "stylesheet"
        link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
        document.head.appendChild(link)
      }

      if (!document.querySelector('link[href*="leaflet.draw.css"]')) {
        const drawLink = document.createElement("link")
        drawLink.rel = "stylesheet"
        drawLink.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet-draw/1.0.4/leaflet.draw.css"
        document.head.appendChild(drawLink)
      }

      if (mapRef.current) return

      mapRef.current = L.map(mapContainerRef.current).setView([-40.3522, -71.5437], 13)

      mapRef.current.createPane("connectionPane")
      mapRef.current.getPane("connectionPane").style.zIndex = 650 // Above markers (600) but below popups (700)

      const streetLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      })

      const satelliteLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "© Esri",
          maxZoom: 18,
        },
      )

      const terrainLayer = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenTopoMap",
        maxZoom: 17,
      })

      tileLayersRef.current = {
        street: streetLayer,
        satellite: satelliteLayer,
        terrain: terrainLayer,
      }

      streetLayer.addTo(mapRef.current)

      polylineLayersRef.current = {
        road: L.layerGroup(),
        buildings: L.layerGroup(),
        electricity: L.layerGroup(),
        internet: L.layerGroup(),
        water: L.layerGroup(),
        gas: L.layerGroup(),
        diagram: L.layerGroup(), // Added diagram layer
      }

      drawnItemsRef.current = new L.FeatureGroup()
      mapRef.current.addLayer(drawnItemsRef.current)

      if (onMapClick) {
        mapRef.current.on("click", (e: any) => {
          console.log("[v0] Map clicked at:", e.latlng.lat, e.latlng.lng)
          onMapClick(e.latlng.lat, e.latlng.lng)
        })
      }

      setMapReady(true) // Set mapReady to true after map is initialized
      console.log("[v0] Map initialized and ready")
    }

    initMap()
  }, [onMapClick])

  useEffect(() => {
    if (!mapRef.current) return

    const currentLayer = tileLayersRef.current[mapType]
    if (!currentLayer) return

    Object.values(tileLayersRef.current).forEach((layer: any) => {
      if (mapRef.current.hasLayer(layer)) {
        mapRef.current.removeLayer(layer)
      }
    })

    if (mapType === "hybrid") {
      const satelliteLayer = tileLayersRef.current.satellite
      const terrainLayer = tileLayersRef.current.terrain

      satelliteLayer.addTo(mapRef.current)
      terrainLayer.setOpacity(terrainOpacity)
      terrainLayer.addTo(mapRef.current)

      console.log("[v0] Hybrid mode - Satellite opacity: 1, Terrain opacity:", terrainOpacity)
    } else {
      currentLayer.setOpacity(1)
      currentLayer.addTo(mapRef.current)
    }
  }, [mapType, terrainOpacity])

  useEffect(() => {
    if (!mapRef.current || !mapReady || !infrastructureData || infrastructureData.length === 0) {
      return
    }

    const L = window.L
    if (!L) return

    // Find Prairie Houses Starlink 4 and Signal Repeater 2
    const starlink = infrastructureData.find((i: any) => i.name === "Prairie Houses, Starlink 4")
    const repeater = infrastructureData.find((i: any) => i.name === "Prairie Houses, Signal Repeater 2")

    console.log("[v0] Found Prairie Houses points:", {
      starlink: starlink?.name,
      repeater: repeater?.name,
      starlinkCoords: starlink ? [starlink.latitude, starlink.longitude] : null,
      repeaterCoords: repeater ? [repeater.latitude, repeater.longitude] : null,
    })

    if (starlink && repeater && starlink.latitude && repeater.latitude) {
      // Create ONE simple red line
      const testLine = L.polyline(
        [
          [starlink.latitude, starlink.longitude],
          [repeater.latitude, repeater.longitude],
        ],
        {
          color: "#FF0000", // Bright red
          weight: 20, // VERY thick
          opacity: 1,
          pane: "connectionPane",
        },
      )

      testLine.addTo(mapRef.current)
      console.log("[v0] ✓ HARDCODED TEST LINE ADDED between Prairie Houses points")
      console.log("[v0] Line coordinates:", [
        [starlink.latitude, starlink.longitude],
        [repeater.latitude, repeater.longitude],
      ])
    } else {
      console.log("[v0] ✗ Could not find Prairie Houses points for test line")
    }
  }, [infrastructureData, mapReady])

  useEffect(() => {
    if (!mapRef.current || !drawnItemsRef.current) return

    const setupDrawing = async () => {
      const L = await import("leaflet")

      if (showRoads || showBuildings) {
        if (!window.L?.Control?.Draw) {
          await new Promise((resolve) => {
            const script = document.createElement("script")
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet-draw/1.0.4/leaflet.draw.js"
            script.onload = () => {
              console.log("[v0] Leaflet.Draw loaded successfully")
              resolve(true)
            }
            script.onerror = () => {
              console.warn("[v0] Leaflet.Draw unavailable - drawing tools disabled")
              resolve(false)
            }
            document.head.appendChild(script)
          })
        }

        if (window.L?.Control?.Draw) {
          const drawControl = new L.Control.Draw({
            position: "bottomleft",
            draw: {
              polyline: showRoads ? { metric: true, feet: false } : false,
              polygon: showBuildings ? { metric: true, feet: false } : false,
              rectangle: showBuildings ? { metric: true, feet: false } : false,
              circle: false,
              circlemarker: false,
              marker: false,
            },
            edit: {
              featureGroup: drawnItemsRef.current,
              edit: true,
              remove: true,
            },
          })

          if (drawControlRef.current) {
            mapRef.current.removeControl(drawControlRef.current)
          }

          mapRef.current.addControl(drawControl)
          drawControlRef.current = drawControl

          mapRef.current.on("draw:created", (e: any) => {
            const layer = e.layer
            drawnItemsRef.current.addLayer(layer)
            console.log("[v0] Drawn item created:", e.layerType)
          })

          mapRef.current.on("draw:edited", () => {
            console.log("[v0] Drawn items edited")
          })

          mapRef.current.on("draw:deleted", () => {
            console.log("[v0] Drawn items deleted")
          })
        }
      } else {
        if (drawControlRef.current) {
          mapRef.current.removeControl(drawControlRef.current)
          drawControlRef.current = null
        }
      }
    }

    setupDrawing().catch((err) => console.error("[v0] Error setting up drawing:", err))
  }, [showRoads, showBuildings])

  useEffect(() => {
    if (!mapRef.current || !infrastructureData || infrastructureData.length === 0) {
      console.log("[v0] Infrastructure data not ready:", {
        hasMap: !!mapRef.current,
        hasData: !!infrastructureData,
        length: infrastructureData?.length || 0,
      })
      return
    }

    const L = window.L
    if (!L) return

    if (infrastructureMarkersRef.current) {
      infrastructureMarkersRef.current.clearLayers()
    } else {
      infrastructureMarkersRef.current = L.layerGroup()
      infrastructureMarkersRef.current.addTo(mapRef.current)
    }

    console.log("[v0] Rendering infrastructure markers:", infrastructureData.length)

    infrastructureData.forEach((item: any) => {
      if (!item.latitude || !item.longitude) {
        return
      }

      const marker = L.marker([item.latitude, item.longitude])

      const isStartPoint = connectionStart && connectionStart.id === item.id
      const popupText =
        isDrawingConnection && isStartPoint
          ? `<strong>${item.name}</strong><br><em>Connection start point</em>`
          : `<strong>${item.name}</strong>`

      marker.bindPopup(popupText)

      if (onMarkerClick) {
        marker.on("click", () => {
          onMarkerClick(item)
        })
      }

      if (isStartPoint && L.divIcon) {
        marker.setIcon(
          L.divIcon({
            html: `<div style="background: #f59e0b; width: 16px; height: 16px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
            className: "infrastructure-marker-selected",
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
        )
      }

      marker.addTo(infrastructureMarkersRef.current)
    })

    console.log("[v0] Infrastructure markers rendered:", infrastructureData.length, "valid markers")
  }, [infrastructureData, onMarkerClick, isDrawingConnection, connectionStart])

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />

      <div className="absolute top-4 right-4 md:right-96 lg:right-96 z-[1001] space-y-3 pointer-events-auto">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          {["street", "satellite", "terrain", "hybrid"].map((type) => (
            <button
              key={type}
              onClick={() => setMapType(type as "street" | "satellite" | "terrain" | "hybrid")}
              className={`px-3 py-2 text-xs md:text-sm font-medium transition-colors block w-full text-left ${
                type !== "hybrid" ? "border-b border-gray-200" : ""
              } ${mapType === type ? "bg-blue-50 text-blue-700" : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
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
    </div>
  )
}

export default KmzMapView

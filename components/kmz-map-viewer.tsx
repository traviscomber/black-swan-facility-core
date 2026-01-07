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
}

const KmzMapView = ({
  visibleLayers = new Set(),
  kmzFiles = [],
  connections = [],
  visibleConnections = new Set(),
  showRoads = false,
  showBuildings = false,
}: KmzMapViewProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [mapType, setMapType] = useState<"street" | "satellite" | "terrain" | "hybrid">("street")
  const [terrainOpacity, setTerrainOpacity] = useState(0.5)
  const tileLayersRef = useRef<any>({})
  const polylineLayersRef = useRef<any>({})
  const drawnItemsRef = useRef<any>(null)
  const drawControlRef = useRef<any>(null)

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
      }

      drawnItemsRef.current = new L.FeatureGroup()
      mapRef.current.addLayer(drawnItemsRef.current)
    }

    initMap()
  }, [])

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
    if (!mapRef.current || mapType !== "hybrid") return

    const terrainLayer = tileLayersRef.current.terrain
    if (terrainLayer && mapRef.current.hasLayer(terrainLayer)) {
      terrainLayer.setOpacity(terrainOpacity)
    }
  }, [terrainOpacity])

  useEffect(() => {
    if (!mapRef.current || !connections || connections.length === 0) return

    const L = window.L
    if (!L) return

    // Clear existing polylines for each connection type
    Object.values(polylineLayersRef.current).forEach((layerGroup: any) => {
      if (mapRef.current.hasLayer(layerGroup)) {
        mapRef.current.removeLayer(layerGroup)
      }
    })

    polylineLayersRef.current = {
      road: L.layerGroup(),
      buildings: L.layerGroup(),
      electricity: L.layerGroup(),
      internet: L.layerGroup(),
      water: L.layerGroup(),
      gas: L.layerGroup(),
    }

    // Add polylines for visible connection types
    connections.forEach((connection) => {
      const connectionType = connection.connection_type
      const coordinates = connection.coordinates

      // Skip if coordinates are not valid
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) return

      // Map connection type to visible connection category
      let layerKey = connectionType
      if (!polylineLayersRef.current[layerKey]) {
        layerKey = "road" // default to road if type not found
      }

      // Determine color based on connection type
      const getConnectionColor = (type: string) => {
        switch (type) {
          case "road":
            return "#8B4513"
          case "building":
            return "#DC143C"
          case "electricity":
            return "#FFD700"
          case "internet":
            return "#3b82f6"
          case "water":
            return "#06b6d4"
          case "gas":
            return "#FF8C00"
          case "sewage":
            return "#8B5A8B"
          default:
            return "#666666"
        }
      }

      // Convert [lon, lat] to [lat, lon] for Leaflet
      const leafletCoords = coordinates.map((coord: [number, number]) => [coord[1], coord[0]])

      const polyline = L.polyline(leafletCoords, {
        color: getConnectionColor(connectionType),
        weight: 3,
        opacity: 0.7,
        lineCap: "round",
        lineJoin: "round",
      })

      polyline.addTo(polylineLayersRef.current[layerKey])
    })

    // Add visible polyline layers to map
    visibleConnections.forEach((type: string) => {
      if (polylineLayersRef.current[type]) {
        polylineLayersRef.current[type].addTo(mapRef.current)
      }
    })

    console.log("[v0] Connection polylines rendered for types:", Array.from(visibleConnections))
  }, [connections, visibleConnections])

  useEffect(() => {
    if (!mapRef.current || !drawnItemsRef.current) return

    const setupDrawing = async () => {
      const L = await import("leaflet")

      // Only enable drawing if showRoads or showBuildings is true
      if (showRoads || showBuildings) {
        // First check if leaflet-draw script is already loaded
        if (!window.L?.Control?.Draw) {
          await new Promise((resolve) => {
            const script = document.createElement("script")
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet-draw/1.0.4/leaflet.draw.js"
            script.onload = resolve
            script.onerror = () => {
              console.error("[v0] Failed to load Leaflet.Draw from CDN")
              resolve() // Still resolve to prevent hanging
            }
            document.head.appendChild(script)
          })
        }

        // Now use L.Control.Draw
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

          // Remove existing draw control if it exists
          if (drawControlRef.current) {
            mapRef.current.removeControl(drawControlRef.current)
          }

          mapRef.current.addControl(drawControl)
          drawControlRef.current = drawControl

          // Handle drawn items
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
        } else {
          console.warn("[v0] Leaflet.Draw not available after loading from CDN")
        }
      } else {
        // Remove draw control when toggled off
        if (drawControlRef.current) {
          mapRef.current.removeControl(drawControlRef.current)
          drawControlRef.current = null
        }
      }
    }

    setupDrawing().catch((err) => console.error("[v0] Error setting up drawing:", err))
  }, [showRoads, showBuildings])

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

"use client"

import { useEffect, useRef, useState } from "react"
import type { InfrastructureConnection } from "@/lib/types"
import JSZip from "jszip"

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
  const polylineLayersRef = useRef<any>({})
  const drawnItemsRef = useRef<any>(null)
  const drawControlRef = useRef<any>(null)
  const infrastructureMarkersRef = useRef<any>(null)
  const connectionLinesRef = useRef<any[]>([])
  const kmzLayersRef = useRef<Map<string, any>>(new Map())

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

    console.log("[v0] Switching to layer:", mapType)

    // Remove all current layers
    Object.values(tileLayersRef.current).forEach((layer: any) => {
      if (mapRef.current.hasLayer(layer)) {
        mapRef.current.removeLayer(layer)
      }
    })

    if (mapType === "hybrid") {
      // Hybrid mode: combine satellite and terrain
      const satelliteLayer = tileLayersRef.current.satellite
      const terrainLayer = tileLayersRef.current.terrain

      satelliteLayer.addTo(mapRef.current)
      terrainLayer.setOpacity(terrainOpacity)
      terrainLayer.addTo(mapRef.current)

      console.log("[v0] Hybrid mode - Satellite opacity: 1, Terrain opacity:", terrainOpacity)
    } else {
      // Single layer mode
      const currentLayer = tileLayersRef.current[mapType]
      if (currentLayer) {
        console.log("[v0] Single layer mode:", mapType)
        currentLayer.setOpacity(1)
        currentLayer.addTo(mapRef.current)
      }
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

  useEffect(() => {
    if (!mapRef.current || !mapReady || !kmzFiles || kmzFiles.length === 0) {
      console.log("[v0] KMZ files not ready:", {
        hasMap: !!mapRef.current,
        mapReady,
        kmzFilesCount: kmzFiles?.length || 0,
      })
      return
    }

    const L = window.L
    if (!L) return

    kmzLayersRef.current.forEach((layer) => {
      if (mapRef.current.hasLayer(layer)) {
        mapRef.current.removeLayer(layer)
      }
    })
    kmzLayersRef.current.clear()

    console.log("[v0] Loading KMZ files:", kmzFiles.length)

    // Load and render each KMZ file
    kmzFiles.forEach(async (file: any) => {
      try {
        console.log("[v0] Loading KMZ file:", file.name, "from", file.file_url)

        // Fetch the KMZ file from Supabase Storage
        const response = await fetch(file.file_url)
        if (!response.ok) {
          console.error("[v0] Failed to fetch KMZ file:", file.name, response.statusText)
          return
        }

        const arrayBuffer = await response.arrayBuffer()
        console.log("[v0] KMZ file loaded:", file.name, arrayBuffer.byteLength, "bytes")

        // Load JSZip to extract KMZ (which is a ZIP file)
        const zip = new JSZip()
        const zipData = await zip.loadAsync(arrayBuffer)

        // Find the KML file inside the KMZ
        const kmlFile = Object.keys(zipData.files).find((name) => name.endsWith(".kml") || name.endsWith(".KML"))
        if (!kmlFile) {
          console.error("[v0] No KML file found in KMZ:", file.name)
          return
        }

        const kmlText = await zipData.files[kmlFile].async("string")
        console.log("[v0] KML extracted from KMZ:", file.name, kmlText.length, "characters")

        // Parse KML to GeoJSON using browser's native DOMParser
        const parser = new DOMParser()
        const kmlDoc = parser.parseFromString(kmlText, "text/xml")

        // Check for parsing errors
        const parserError = kmlDoc.querySelector("parsererror")
        if (parserError) {
          console.error("[v0] KML parsing error:", parserError.textContent)
          return
        }

        console.log("[v0] KML parsed successfully, converting to GeoJSON...")
        const toGeoJSON = await import("@mapbox/togeojson")
        const kmlConverter = toGeoJSON.kml || toGeoJSON.default?.kml || toGeoJSON.default

        if (typeof kmlConverter !== "function") {
          console.error("[v0] kml converter is not a function:", typeof kmlConverter, toGeoJSON)
          return
        }

        const geoJSON = kmlConverter(kmlDoc)

        // Validate GeoJSON features have valid coordinates
        if (!geoJSON.features || geoJSON.features.length === 0) {
          console.error("[v0] No valid features found in GeoJSON from KMZ:", file.name)
          return
        }

        // Filter out features with invalid geometries
        const validFeatures = geoJSON.features.filter((feature: any) => {
          if (!feature.geometry) return false
          if (!feature.geometry.coordinates) return false
          
          // Check for valid coordinates based on geometry type
          const coords = feature.geometry.coordinates
          if (Array.isArray(coords) && coords.length > 0) {
            // For point geometries
            if (feature.geometry.type === "Point" && coords.length === 2) {
              return !isNaN(coords[0]) && !isNaN(coords[1])
            }
            // For other types, just check if array is not empty
            return true
          }
          return false
        })

        console.log("[v0] GeoJSON created:", validFeatures.length, "valid features out of", geoJSON.features.length)

        if (validFeatures.length === 0) {
          console.warn("[v0] No valid features after filtering for KMZ:", file.name)
          return
        }

        // Create a new GeoJSON with only valid features
        const validGeoJSON = {
          type: "FeatureCollection",
          features: validFeatures,
        }

        // Add GeoJSON to map with proper error handling
        let layer
        try {
          layer = L.geoJSON(validGeoJSON, {
            style: {
              color: "#2196F3",
              weight: 3,
              opacity: 0.8,
              fillOpacity: 0.3,
            },
            pointToLayer: (feature: any, latlng: any) => {
              if (!latlng || latlng === undefined) {
                console.warn("[v0] Invalid latlng for point feature:", feature)
                return null
              }
              return L.circleMarker(latlng, {
                radius: 8,
                fillColor: "#2196F3",
                color: "#fff",
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8,
              })
            },
            onEachFeature: (feature: any, layer: any) => {
              if (!layer || !layer.bindPopup) return
              
              const props = feature.properties || {}
              let popupContent = `<div style="max-width: 300px; max-height: 400px; overflow-y: auto;">`
              popupContent += `<strong style="color: #2196F3; font-size: 16px;">${file.name}</strong><br/>`

              // Show all properties from the KMZ
              if (Object.keys(props).length > 0) {
                popupContent += `<div style="margin-top: 8px; border-top: 1px solid #e5e7eb; padding-top: 8px;">`

                Object.entries(props).forEach(([key, value]) => {
                  // Skip empty values
                  if (value === null || value === undefined || value === "") return

                  // Format the key (convert camelCase to Title Case)
                  const formattedKey = key
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (str) => str.toUpperCase())
                    .trim()

                  // Handle different value types
                  let formattedValue = value
                  if (typeof value === "object") {
                    formattedValue = JSON.stringify(value, null, 2)
                  } else {
                    formattedValue = String(value)
                  }

                  // Add to popup with styling
                  popupContent += `
                    <div style="margin-bottom: 6px;">
                      <strong style="color: #4b5563; font-size: 12px;">${formattedKey}:</strong>
                      <span style="color: #1f2937; font-size: 12px; margin-left: 4px;">${formattedValue}</span>
                    </div>
                  `
                })

                popupContent += `</div>`
              } else {
                popupContent += `<em style="color: #9ca3af; font-size: 12px;">No additional properties</em>`
              }

              popupContent += `</div>`

              layer.bindPopup(popupContent, {
                maxWidth: 350,
                maxHeight: 450,
              })
            },
          })
        } catch (e) {
          console.error("[v0] Error creating GeoJSON layer:", e)
          return
        }

        if (!layer) {
          console.error("[v0] Failed to create layer from GeoJSON")
          return
        }

        kmzLayersRef.current.set(file.id, layer)

        if (visibleLayers.has(file.id)) {
          layer.addTo(mapRef.current)
          console.log("[v0] ✓ KMZ rendered on map (visible):", file.name)
        } else {
          console.log("[v0] ✓ KMZ loaded but hidden:", file.name)
        }

        // Zoom to fit the first visible KMZ layer
        if (kmzLayersRef.current.size === 1 && visibleLayers.has(file.id)) {
          try {
            const bounds = layer.getBounds()
            if (bounds && bounds.isValid && bounds.isValid()) {
              mapRef.current.fitBounds(bounds, { padding: [50, 50] })
            }
          } catch (e) {
            console.log("[v0] Could not fit bounds for KMZ:", e)
          }
        }
      } catch (error) {
        console.error("[v0] Error loading KMZ file:", file.name, error)
      }
    })
  }, [kmzFiles, mapReady])

  useEffect(() => {
    if (!mapRef.current || kmzLayersRef.current.size === 0) return

    console.log("[v0] Visibility changed, updating layers. Visible count:", visibleLayers.size)

    kmzLayersRef.current.forEach((layer, fileId) => {
      const shouldBeVisible = visibleLayers.has(fileId)
      const isCurrentlyVisible = mapRef.current.hasLayer(layer)

      if (shouldBeVisible && !isCurrentlyVisible) {
        layer.addTo(mapRef.current)
        console.log("[v0] Showing KMZ layer:", fileId)
      } else if (!shouldBeVisible && isCurrentlyVisible) {
        mapRef.current.removeLayer(layer)
        console.log("[v0] Hiding KMZ layer:", fileId)
      }
    })
  }, [visibleLayers])

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

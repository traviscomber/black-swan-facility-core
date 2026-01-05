"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

interface KmzFile {
  id: string
  name: string
  file_url: string
}

interface KmzMapViewerProps {
  visibleLayers: Set<string>
  kmzFiles: KmzFile[]
}

export default function KmzMapViewer({ visibleLayers, kmzFiles }: KmzMapViewerProps) {
  const mapRef = useRef<L.Map | null>(null)
  const layersRef = useRef<Map<string, L.GeoJSON>>(new Map())

  useEffect(() => {
    if (!mapRef.current) {
      // Initialize map centered on facility default location (adjust coordinates as needed)
      mapRef.current = L.map("map-container", {
        center: [-40.5, -72.1], // Default to Valdivia region
        zoom: 10,
      })

      // Add base layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(mapRef.current)
    }

    // Update visible layers
    kmzFiles.forEach((file) => {
      const isVisible = visibleLayers.has(file.id)
      const existingLayer = layersRef.current.get(file.id)

      if (isVisible && !existingLayer) {
        // Load and add KMZ/GeoJSON layer
        fetch(file.file_url)
          .then((response) => response.json())
          .then((data) => {
            const geoJsonLayer = L.geoJSON(data, {
              style: {
                color: "#3b82f6",
                weight: 2,
                opacity: 0.7,
              },
            })

            if (mapRef.current) {
              geoJsonLayer.addTo(mapRef.current)
              layersRef.current.set(file.id, geoJsonLayer)

              // Fit bounds to layer
              const bounds = geoJsonLayer.getBounds()
              if (bounds.isValid()) {
                mapRef.current.fitBounds(bounds, { padding: [50, 50] })
              }
            }
          })
          .catch((error) => console.error(`[v0] Error loading KMZ ${file.name}:`, error))
      } else if (!isVisible && existingLayer) {
        // Remove layer
        if (mapRef.current) {
          mapRef.current.removeLayer(existingLayer)
        }
        layersRef.current.delete(file.id)
      }
    })

    return () => {
      // Cleanup on unmount
    }
  }, [visibleLayers, kmzFiles])

  return <div id="map-container" className="w-full h-full" />
}

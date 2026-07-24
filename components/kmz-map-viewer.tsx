"use client"

import { useEffect, useRef } from "react"
import JSZip from "jszip"
import type { InfrastructureConnection } from "@/lib/types"

interface InfrastructureItem {
  id: string
  name: string
  latitude: number | null
  longitude: number | null
  category?: string | null
  status?: string | null
}

interface KmzFile {
  id: string
  name?: string
  file_url?: string
  is_visible?: boolean
  opacity?: number | string | null
}

interface KmzFeature {
  name: string
  folder: string
  type: string
  description: string
}

interface KmzMapViewProps {
  visibleLayers?: Set<string>
  kmzFiles?: KmzFile[]
  connections?: InfrastructureConnection[]
  visibleConnections?: Set<string>
  infrastructureData?: InfrastructureItem[]
  onMapClick?: (lat: number, lng: number) => void
  onMarkerClick?: (infra: InfrastructureItem) => void
  onStats?: (id: string, stats: { features: number; types: string[]; folders: string[] }) => void
  onFeatures?: (id: string, features: KmzFeature[]) => void
}

type LeafletMap = import("leaflet").Map

type ParsedGeometry = {
  type: "Point" | "LineString" | "Polygon"
  coordinates: number[] | number[][] | number[][][]
  name: string
  description: string
  folder: string
}

function coordinatePairs(value: string): number[][] {
  return value
    .trim()
    .split(/\s+/)
    .map((entry) => entry.split(",").slice(0, 2).map(Number))
    .filter((pair) => pair.length === 2 && pair.every(Number.isFinite))
}

function parseKml(kml: string): ParsedGeometry[] {
  const document = new DOMParser().parseFromString(kml, "application/xml")
  if (document.querySelector("parsererror")) throw new Error("Invalid KML document")

  return Array.from(document.querySelectorAll("Placemark")).flatMap((placemark) => {
    const name = placemark.querySelector(":scope > name")?.textContent?.trim() || "Unnamed feature"
    const description = placemark.querySelector(":scope > description")?.textContent?.trim() || ""
    const folder = placemark.parentElement?.querySelector(":scope > name")?.textContent?.trim() || ""
    const geometries: ParsedGeometry[] = []

    placemark.querySelectorAll("Point > coordinates").forEach((node) => {
      const pair = coordinatePairs(node.textContent || "")[0]
      if (pair) geometries.push({ type: "Point", coordinates: pair, name, description, folder })
    })
    placemark.querySelectorAll("LineString > coordinates").forEach((node) => {
      const pairs = coordinatePairs(node.textContent || "")
      if (pairs.length > 1) geometries.push({ type: "LineString", coordinates: pairs, name, description, folder })
    })
    placemark.querySelectorAll("Polygon outerBoundaryIs LinearRing > coordinates").forEach((node) => {
      const pairs = coordinatePairs(node.textContent || "")
      if (pairs.length > 2) geometries.push({ type: "Polygon", coordinates: [pairs], name, description, folder })
    })
    return geometries
  })
}

async function readKml(file: KmzFile): Promise<string> {
  if (!file.file_url) throw new Error("KMZ file URL is missing")
  const response = await fetch(file.file_url)
  if (!response.ok) throw new Error(`Unable to load layer (${response.status})`)
  const buffer = await response.arrayBuffer()
  if (file.file_url.toLowerCase().includes(".kml")) return new TextDecoder().decode(buffer)
  const zip = await JSZip.loadAsync(buffer)
  const kmlEntry = Object.values(zip.files).find((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".kml"))
  if (!kmlEntry) throw new Error("The KMZ archive does not contain a KML document")
  return kmlEntry.async("text")
}

export default function KmzMapView({
  visibleLayers,
  kmzFiles = [],
  connections = [],
  visibleConnections = new Set(),
  infrastructureData = [],
  onMapClick,
  onMarkerClick,
  onStats,
  onFeatures,
}: KmzMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const infrastructureLayerRef = useRef<import("leaflet").LayerGroup | null>(null)
  const connectionLayerRef = useRef<import("leaflet").LayerGroup | null>(null)
  const kmzLayerRef = useRef<Map<string, import("leaflet").LayerGroup>>(new Map())
  const clickHandlerRef = useRef(onMapClick)

  useEffect(() => { clickHandlerRef.current = onMapClick }, [onMapClick])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false
    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return
      const map = L.map(containerRef.current, { zoomControl: true }).setView([-39.8255, -73.2215], 11)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 19 }).addTo(map)
      map.on("click", (event: import("leaflet").LeafletMouseEvent) => clickHandlerRef.current?.(event.latlng.lat, event.latlng.lng))
      infrastructureLayerRef.current = L.layerGroup().addTo(map)
      connectionLayerRef.current = L.layerGroup().addTo(map)
      mapRef.current = map
      window.setTimeout(() => map.invalidateSize(), 100)
    })
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      infrastructureLayerRef.current = null
      connectionLayerRef.current = null
      kmzLayerRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !infrastructureLayerRef.current) return
    let cancelled = false
    void import("leaflet").then((L) => {
      if (cancelled || !infrastructureLayerRef.current) return
      infrastructureLayerRef.current.clearLayers()
      infrastructureData.filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)).forEach((item) => {
        const marker = L.circleMarker([Number(item.latitude), Number(item.longitude)], { radius: 6, weight: 2, fillOpacity: 0.8 })
        marker.bindPopup(`<strong>${item.name}</strong>${item.category ? `<br>${item.category}` : ""}`)
        if (onMarkerClick) marker.on("click", () => onMarkerClick(item))
        marker.addTo(infrastructureLayerRef.current!)
      })
    })
    return () => { cancelled = true }
  }, [infrastructureData, onMarkerClick])

  useEffect(() => {
    if (!connectionLayerRef.current) return
    let cancelled = false
    void import("leaflet").then((L) => {
      if (cancelled || !connectionLayerRef.current) return
      connectionLayerRef.current.clearLayers()
      const byId = new Map(infrastructureData.map((item) => [item.id, item]))
      connections.forEach((connection) => {
        const category = connection.connection_type || "general"
        if (visibleConnections.size > 0 && !visibleConnections.has(category)) return
        const from = byId.get(connection.from_infrastructure_id)
        const to = byId.get(connection.to_infrastructure_id)
        if (!from || !to || !Number.isFinite(from.latitude) || !Number.isFinite(from.longitude) || !Number.isFinite(to.latitude) || !Number.isFinite(to.longitude)) return
        L.polyline([[Number(from.latitude), Number(from.longitude)], [Number(to.latitude), Number(to.longitude)]], { weight: 3, opacity: 0.75, dashArray: connection.line_style === "dashed" ? "8 8" : undefined }).addTo(connectionLayerRef.current!)
      })
    })
    return () => { cancelled = true }
  }, [connections, infrastructureData, visibleConnections])

  useEffect(() => {
    if (!mapRef.current) return
    let cancelled = false
    void import("leaflet").then(async (L) => {
      if (cancelled || !mapRef.current) return
      kmzLayerRef.current.forEach((layer) => layer.remove())
      kmzLayerRef.current.clear()

      const allBounds: [number, number][] = infrastructureData
        .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
        .map((item) => [Number(item.latitude), Number(item.longitude)])
      const enabled = kmzFiles.filter((file) => file.file_url && (visibleLayers ? visibleLayers.has(file.id) : file.is_visible !== false))

      for (const file of enabled) {
        if (cancelled || !mapRef.current) return
        try {
          const geometries = parseKml(await readKml(file))
          const group = L.layerGroup().addTo(mapRef.current)
          const opacity = Math.min(1, Math.max(0, Number(file.opacity ?? 1)))

          geometries.forEach((geometry) => {
            const popup = `<strong>${geometry.name}</strong>${geometry.description ? `<br>${geometry.description}` : ""}`
            if (geometry.type === "Point") {
              const [lng, lat] = geometry.coordinates as number[]
              allBounds.push([lat, lng])
              L.circleMarker([lat, lng], { radius: 5, fillOpacity: opacity }).bindPopup(popup).addTo(group)
            } else if (geometry.type === "LineString") {
              const latLngs = (geometry.coordinates as number[][]).map(([lng, lat]) => {
                allBounds.push([lat, lng])
                return [lat, lng] as [number, number]
              })
              L.polyline(latLngs, { opacity, weight: 3 }).bindPopup(popup).addTo(group)
            } else {
              const latLngs = (geometry.coordinates as number[][][])[0].map(([lng, lat]) => {
                allBounds.push([lat, lng])
                return [lat, lng] as [number, number]
              })
              L.polygon(latLngs, { opacity, fillOpacity: opacity * 0.25 }).bindPopup(popup).addTo(group)
            }
          })

          kmzLayerRef.current.set(file.id, group)
          const features = geometries.map((geometry) => ({ name: geometry.name, folder: geometry.folder, type: geometry.type, description: geometry.description }))
          onFeatures?.(file.id, features)
          onStats?.(file.id, { features: features.length, types: Array.from(new Set(features.map((feature) => feature.type))), folders: Array.from(new Set(features.map((feature) => feature.folder).filter(Boolean))) })
        } catch (error) {
          console.error(`Unable to render GIS layer ${file.id}:`, error)
          onFeatures?.(file.id, [])
          onStats?.(file.id, { features: 0, types: [], folders: [] })
        }
      }

      if (allBounds.length === 1) mapRef.current.setView(allBounds[0], 14)
      if (allBounds.length > 1) mapRef.current.fitBounds(L.latLngBounds(allBounds), { padding: [30, 30], maxZoom: 15 })
    })
    return () => { cancelled = true }
  }, [kmzFiles, visibleLayers, infrastructureData, onFeatures, onStats])

  return <div ref={containerRef} className="h-full min-h-[520px] w-full rounded-lg border" aria-label="GIS map" />
}

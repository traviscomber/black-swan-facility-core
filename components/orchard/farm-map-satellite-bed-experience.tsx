"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, Layers3, LocateFixed, Maximize2, Minimize2, X } from "lucide-react"
import { farmMapBedPolygons } from "@/lib/orchard/farm-map-bed-layout"
import { farmMapRectToLatLngs, PROVISIONAL_GEOREF } from "@/lib/orchard/farm-map-provisional-georef"
import { loadOverlayGeoJson } from "@/lib/map/overlay-loader"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"
type Overlay = { id: string; name: string; file_url: string; file_type: string | null; opacity: number | string | null; updated_at: string | null }
type Obj = {
  id: string
  plot_id: string | null
  object_type: string
  name: string
  x_pct: number | string
  y_pct: number | string
  width_pct: number | string
  height_pct: number | string
  rotation_deg: number | string
  bed_count: number | string | null
  bed_width_cm: number | string | null
  path_width_cm: number | string | null
  is_visible: boolean
  satellite_lat: number | string | null
  satellite_lng: number | string | null
  satellite_position_source: string | null
}
type CropSummary = { crops: string[]; season: string | null }
type BedAllocation = { crop: string; start: string | null; end: string | null; lengthM: number }
type BedPlan = { id: string; plotId: string; name: string; code: string | null; planningOrder: number; allocations: BedAllocation[] }
type DragSource = { clientX?: number; clientY?: number; touches?: ArrayLike<{ clientX: number; clientY: number }>; changedTouches?: ArrayLike<{ clientX: number; clientY: number }>; preventDefault?: () => void; stopPropagation?: () => void }
type LEvent = { originalEvent?: DragSource }
type Layer = { addTo: (map: LMap) => Layer; bindTooltip?: (content: string, options?: Record<string, unknown>) => Layer; on?: (event: string, handler: (event: LEvent) => void) => Layer; setLatLngs?: (points: [number, number][]) => Layer }
type LMap = {
  setView: (center: [number, number], zoom: number) => LMap
  addLayer: (layer: Layer) => LMap
  removeLayer: (layer: Layer) => LMap
  hasLayer: (layer: Layer) => boolean
  invalidateSize: () => void
  remove: () => void
  getZoom: () => number
  on: (event: string, handler: () => void) => LMap
  off: (event: string, handler: () => void) => LMap
  containerPointToLatLng: (point: [number, number]) => { lat: number; lng: number }
  dragging: { disable: () => void; enable: () => void }
}
type Leaflet = {
  map: (el: HTMLElement, options?: Record<string, unknown>) => LMap
  tileLayer: (url: string, options?: Record<string, unknown>) => Layer & { on: (event: string, handler: () => void) => Layer }
  geoJSON: (data: unknown, options?: Record<string, unknown>) => Layer
  circleMarker: (latlng: unknown, options?: Record<string, unknown>) => Layer
  polygon: (points: [number, number][], options?: Record<string, unknown>) => Layer
  control: { zoom: (options?: Record<string, unknown>) => { addTo: (map: LMap) => unknown } }
}

const CENTER: [number, number] = [-39.697291, -73.206357]
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
const BED_DETAIL_ZOOM = 19
const BED_LABEL_ZOOM = 20

const copy = {
  en: { title: "Farm Map · Satellite", subtitle: "Fundo Corcovado · operational orchard", layers: "Map layers", focus: "Focus farm", full: "Fullscreen", exit: "Exit fullscreen", loading: "Loading satellite map…", error: "The satellite farm map could not be loaded.", baseError: "Satellite imagery could not be loaded.", note: "Canonical orchard fields and their season plan. Planned crops are not observed planting. Bed geometry is an operational schematic inside each field, not surveyed positioning.", blocks: "Orchard fields", blockNote: "Drag to position · zoom in for 10-bed detail", field: "Field", rotation: "Rotation", done: "Done", planned: "PLAN", noPlan: "No crop plan", season: "Season plan", beds: "Beds", bedDetail: "Bed detail", close: "Close", saveError: "Could not save the field change." },
  es: { title: "Mapa de la granja · Satélite", subtitle: "Fundo Corcovado · orchard operacional", layers: "Capas del mapa", focus: "Centrar predio", full: "Pantalla completa", exit: "Salir de pantalla completa", loading: "Cargando mapa satelital…", error: "No fue posible cargar el mapa satelital.", baseError: "No fue posible cargar la imagen satelital.", note: "Campos canónicos del orchard y su plan de temporada. Los cultivos planificados no son plantación observada. La geometría de camas es un esquema operacional dentro de cada field, no una posición topográfica levantada.", blocks: "Campos del orchard", blockNote: "Arrastra para ubicar · acerca para ver las 10 camas", field: "Campo", rotation: "Rotación", done: "Listo", planned: "PLAN", noPlan: "Sin plan de cultivo", season: "Plan de temporada", beds: "Camas", bedDetail: "Detalle de camas", close: "Cerrar", saveError: "No fue posible guardar el cambio del campo." },
  de: { title: "Hofkarte · Satellit", subtitle: "Fundo Corcovado · operativer Obstgarten", layers: "Kartenebenen", focus: "Hof zentrieren", full: "Vollbild", exit: "Vollbild beenden", loading: "Satellitenkarte wird geladen…", error: "Die Satellitenkarte konnte nicht geladen werden.", baseError: "Das Satellitenbild konnte nicht geladen werden.", note: "Kanonische Flächen und ihr Saisonplan. Geplante Kulturen sind keine beobachtete Pflanzung. Die Beetgeometrie ist eine operative Darstellung innerhalb der Fläche, keine vermessene Position.", blocks: "Obstgarten-Felder", blockNote: "Zum Positionieren ziehen · für 10 Beete hineinzoomen", field: "Feld", rotation: "Drehung", done: "Fertig", planned: "PLAN", noPlan: "Kein Kulturplan", season: "Saisonplan", beds: "Beete", bedDetail: "Beetdetails", close: "Schließen", saveError: "Die Feldänderung konnte nicht gespeichert werden." },
} as const

const num = (v: unknown, fallback = 0) => { const x = Number(v); return Number.isFinite(x) ? x : fallback }
const safe = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c] ?? c))
const center = (points: [number, number][]) => { const sum = points.reduce((a, [lat, lng]) => ({ lat: a.lat + lat, lng: a.lng + lng }), { lat: 0, lng: 0 }); return { lat: sum.lat / points.length, lng: sum.lng / points.length } }
const shift = (points: [number, number][], a: { lat: number; lng: number }, b: { lat: number; lng: number }) => points.map(([lat, lng]) => [lat + b.lat - a.lat, lng + b.lng - a.lng] as [number, number])
const polygon = (o: Obj) => { const base = farmMapRectToLatLngs({ xPct: num(o.x_pct), yPct: num(o.y_pct), widthPct: num(o.width_pct, 9), heightPct: num(o.height_pct, 13), rotationDeg: num(o.rotation_deg) }); const c = center(base), lat = o.satellite_lat == null ? null : num(o.satellite_lat), lng = o.satellite_lng == null ? null : num(o.satellite_lng); return lat == null || lng == null ? base : shift(base, c, { lat, lng }) }
const dragPoint = (e: DragSource | MouseEvent | TouchEvent | undefined) => { if (!e) return null; const s = e as DragSource, t = s.touches?.[0] ?? s.changedTouches?.[0], x = t?.clientX ?? s.clientX, y = t?.clientY ?? s.clientY; return Number.isFinite(x) && Number.isFinite(y) ? { x: Number(x), y: Number(y) } : null }
const area = (t: string) => ["field_block", "greenhouse", "tunnel", "farm_area"].includes(t)
const overlayColor = (n: string) => n.toLowerCase().includes("agua") ? "#7BA7B8" : n.toLowerCase().includes("proteccion") ? "#96A983" : n.toLowerCase().includes("pmf") ? "#C3A66D" : "#F0EEE7"
const bedCode = (bed: BedPlan) => bed.code?.split("-").at(-1) ?? bed.name.replace(/^Bed\s*/i, "B")
const lengthSuffix = (lengthM: number) => lengthM > 0 && lengthM < 9.95 ? ` ${Number(lengthM.toFixed(1))}m` : ""

function bedPlanText(bed: BedPlan, noPlan: string) {
  if (!bed.allocations.length) return noPlan
  const groups = new Map<string, BedAllocation[]>()
  for (const allocation of bed.allocations) {
    const key = `${allocation.start ?? ""}|${allocation.end ?? ""}`
    const group = groups.get(key) ?? []
    group.push(allocation)
    groups.set(key, group)
  }
  return [...groups.values()].map((group) => group.map((a) => `${a.crop}${lengthSuffix(a.lengthM)}`).join(" + ")).join(" → ")
}

export function FarmMapSatelliteExperience() {
  const { language } = useLanguage()
  const text = copy[language as Locale]
  const supabase = useMemo(() => createBrowserClient(), [])
  const root = useRef<HTMLElement>(null), node = useRef<HTMLDivElement>(null), mapRef = useRef<LMap | null>(null), leaflet = useRef<Leaflet | null>(null), dragCleanup = useRef<(() => void) | null>(null)
  const layers = useRef(new Map<string, Layer>()), blocks = useRef(new Map<string, Layer>()), bedLayers = useRef(new Map<string, Layer>()), visibleRef = useRef(new Set<string>())
  const [objects, setObjects] = useState<Obj[]>([]), [overlays, setOverlays] = useState<Overlay[]>([]), [summaries, setSummaries] = useState<Record<string, CropSummary>>({}), [bedsByPlot, setBedsByPlot] = useState<Record<string, BedPlan[]>>({}), [visible, setVisible] = useState(new Set<string>()), [selected, setSelected] = useState<string | null>(null), [drawer, setDrawer] = useState(false), [showBlocks, setShowBlocks] = useState(true), [ready, setReady] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null), [baseError, setBaseError] = useState(false), [fullscreen, setFullscreen] = useState(false), [zoom, setZoom] = useState(18)

  useEffect(() => {
    let dead = false
    void supabase.from("gis_overlays").select("id,name,file_url,file_type,opacity,updated_at").order("layer_order").order("name").then((r) => {
      if (dead) return
      if (r.error) { setError(text.error); return }
      const rows = (r.data ?? []) as Overlay[], initial = new Set(rows.filter((x) => x.name.toLowerCase().includes("capas corcovado")).map((x) => x.id))
      visibleRef.current = initial
      setVisible(initial)
      setOverlays(rows)
    })
    void supabase.from("orchard_farm_map_objects").select("id,plot_id,object_type,name,x_pct,y_pct,width_pct,height_pct,rotation_deg,bed_count,bed_width_cm,path_width_cm,is_visible,satellite_lat,satellite_lng,satellite_position_source").eq("is_visible", true).order("name").then((r) => { if (!dead && !r.error) setObjects((r.data ?? []) as Obj[]) })
    void Promise.all([
      supabase.from("orchard_game_plans").select("id,season,status,start_date,end_date").order("start_date", { ascending: false }),
      supabase.from("orchard_beds").select("id,plot_id,name,code,status,planning_order").order("planning_order"),
      supabase.from("orchard_bed_allocations").select("bed_id,crop_succession_id,allocated_length_m,planned_start_date,planned_end_date"),
      supabase.from("orchard_crop_successions").select("id,crop_cycle_id"),
      supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name"),
    ]).then((rs) => {
      if (dead || rs.some((r) => r.error)) return
      const plans = (rs[0].data ?? []) as { id: string; season: string | null; status: string | null; start_date: string | null; end_date: string | null }[]
      const today = new Date().toISOString().slice(0, 10)
      const plan = plans.find((p) => p.status === "active" && (!p.start_date || p.start_date <= today) && (!p.end_date || p.end_date >= today)) ?? plans.find((p) => p.status === "draft" && (!p.start_date || p.start_date <= today) && (!p.end_date || p.end_date >= today))
      if (!plan) return
      const beds = ((rs[1].data ?? []) as { id: string; plot_id: string; name: string; code: string | null; status: string | null; planning_order: number | null }[]).filter((x) => x.status !== "out_of_service")
      const bedById = new Map(beds.map((x) => [x.id, x]))
      const successionCycle = new Map(((rs[3].data ?? []) as { id: string; crop_cycle_id: string }[]).map((x) => [x.id, x.crop_cycle_id]))
      const cycle = new Map(((rs[4].data ?? []) as { id: string; game_plan_id: string; crop_name: string }[]).filter((x) => x.game_plan_id === plan.id).map((x) => [x.id, x.crop_name]))
      const allocationBucket = new Map<string, BedAllocation[]>()
      for (const a of (rs[2].data ?? []) as { bed_id: string; crop_succession_id: string; allocated_length_m: number | string | null; planned_start_date: string | null; planned_end_date: string | null }[]) {
        if (!bedById.has(a.bed_id)) continue
        const crop = cycle.get(successionCycle.get(a.crop_succession_id) ?? "")
        if (!crop) continue
        const list = allocationBucket.get(a.bed_id) ?? []
        list.push({ crop, start: a.planned_start_date, end: a.planned_end_date, lengthM: num(a.allocated_length_m) })
        allocationBucket.set(a.bed_id, list)
      }
      const nextBeds: Record<string, BedPlan[]> = {}
      for (const bed of beds) {
        const item: BedPlan = { id: bed.id, plotId: bed.plot_id, name: bed.name, code: bed.code, planningOrder: bed.planning_order ?? 999, allocations: (allocationBucket.get(bed.id) ?? []).sort((a, b) => (a.start ?? "9999").localeCompare(b.start ?? "9999") || a.crop.localeCompare(b.crop)) }
        nextBeds[bed.plot_id] = [...(nextBeds[bed.plot_id] ?? []), item]
      }
      for (const list of Object.values(nextBeds)) list.sort((a, b) => a.planningOrder - b.planningOrder || a.name.localeCompare(b.name))
      setBedsByPlot(nextBeds)

      const bucket = new Map<string, Map<string, number>>()
      for (const [bedId, allocations] of allocationBucket) {
        const plotId = bedById.get(bedId)?.plot_id
        if (!plotId) continue
        const byCrop = bucket.get(plotId) ?? new Map<string, number>()
        for (const allocation of allocations) byCrop.set(allocation.crop, (byCrop.get(allocation.crop) ?? 0) + allocation.lengthM)
        bucket.set(plotId, byCrop)
      }
      const next: Record<string, CropSummary> = {}
      for (const [plotId, crops] of bucket) next[plotId] = { crops: [...crops.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name), season: plan.season }
      setSummaries(next)
    })
    return () => { dead = true }
  }, [supabase, text.error])

  const loadOverlay = async (L: Leaflet, map: LMap, o: Overlay) => {
    if (layers.current.has(o.id)) return
    try {
      const r = await loadOverlayGeoJson({ id: o.id, file_url: o.file_url, file_type: o.file_type, source_version: o.updated_at ?? o.file_url }), canonical = o.name.toLowerCase().includes("capas corcovado"), color = canonical ? "#f1eee7" : overlayColor(o.name), opacity = Math.max(0, Math.min(1, num(o.opacity, 1))), layer = L.geoJSON(r.geojson as Record<string, unknown>, { style: () => ({ color, weight: canonical ? 2.8 : 2, opacity: canonical ? .95 : .85 * opacity, fillColor: color, fillOpacity: canonical ? .025 : .06 * opacity }), pointToLayer: (_f: unknown, ll: unknown) => L.circleMarker(ll, { radius: 4, color, fillColor: color, fillOpacity: opacity }) })
      layers.current.set(o.id, layer)
      if (visibleRef.current.has(o.id)) map.addLayer(layer)
    } catch { }
  }

  useEffect(() => {
    if (!node.current || !overlays.length) return
    let dead = false
    setReady(false)
    let map: LMap | null = null
    let handleZoom: (() => void) | null = null
    void import("leaflet").then((m) => {
      if (dead || !node.current) return
      const L = m as unknown as Leaflet
      leaflet.current = L
      map = L.map(node.current, { zoomControl: false, attributionControl: true, minZoom: 4, maxZoom: 20 }).setView(CENTER, 18)
      handleZoom = () => { if (map) setZoom(map.getZoom()) }
      mapRef.current = map
      map.on("zoomend", handleZoom)
      L.control.zoom({ position: "bottomleft" }).addTo(map)
      let fails = 0
      const base = L.tileLayer(ESRI, { maxZoom: 20, maxNativeZoom: 19, tileSize: 256, attribution: "Imagery © Esri and contributors" })
      base.on("tileerror", () => { if (++fails >= 4) setBaseError(true) })
      base.on("load", () => setBaseError(false))
      base.addTo(map)
      setReady(true)
      void Promise.all(overlays.filter((x) => visibleRef.current.has(x.id)).map((x) => loadOverlay(L, map as LMap, x))).then(() => { if (!dead && map) { map.setView(CENTER, 18); setZoom(18); requestAnimationFrame(() => map?.invalidateSize()); setLoading(false) } })
    }).catch(() => { if (!dead) { setError(text.error); setLoading(false) } })
    return () => {
      dead = true
      dragCleanup.current?.(); dragCleanup.current = null
      if (map && handleZoom) map.off("zoomend", handleZoom)
      map?.remove()
      mapRef.current = null; leaflet.current = null
      layers.current.clear(); blocks.current.clear(); bedLayers.current.clear()
    }
  }, [overlays, text.error])

  useEffect(() => {
    const map = mapRef.current, L = leaflet.current
    if (!ready || !map || !L) return
    for (const layer of blocks.current.values()) if (map.hasLayer(layer)) map.removeLayer(layer)
    for (const layer of bedLayers.current.values()) if (map.hasLayer(layer)) map.removeLayer(layer)
    blocks.current.clear(); bedLayers.current.clear()
    if (!showBlocks) return
    const detail = zoom >= BED_DETAIL_ZOOM
    const labels = zoom >= BED_LABEL_ZOOM

    for (const o of objects.filter((x) => area(x.object_type))) {
      const active = selected === o.id, start = polygon(o), summary = o.plot_id ? summaries[o.plot_id] : undefined, crops = summary?.crops ?? [], short = crops.slice(0, 2).join(" · ") + (crops.length > 2 ? ` +${crops.length - 2}` : "")
      const layer = L.polygon(start, { color: active ? "#bde1cf" : "#f1eee7", weight: active ? 3.2 : detail ? 1.7 : 2.2, opacity: 1, fillColor: active ? "#91c9ae" : "#d7b17a", fillOpacity: detail ? .055 : active ? .22 : .14, className: "cursor-move" })
      if (!detail) layer.bindTooltip?.(`<b>${safe(o.name)}</b><span>${short ? `${safe(text.planned)} · ${safe(short)}` : safe(text.noPlan)}</span>`, { permanent: true, direction: "center", opacity: 1, className: `orchard-label${active ? " orchard-label-active" : ""}` })
      const begin = (e: LEvent) => {
        e.originalEvent?.preventDefault?.(); e.originalEvent?.stopPropagation?.(); dragCleanup.current?.()
        const p0 = dragPoint(e.originalEvent), el = node.current
        if (!p0 || !el) return
        map.dragging.disable()
        const rect = el.getBoundingClientRect(), toLL = (p: { x: number; y: number }) => map.containerPointToLatLng([p.x - rect.left, p.y - rect.top]), pointer0 = toLL(p0), c0 = center(start)
        let c = c0, done = false
        const move = (ev: MouseEvent | TouchEvent) => { ev.preventDefault(); const p = dragPoint(ev); if (!p) return; const q = toLL(p); c = { lat: c0.lat + q.lat - pointer0.lat, lng: c0.lng + q.lng - pointer0.lng }; layer.setLatLngs?.(shift(start, c0, c)) }
        const off = () => { document.removeEventListener("mousemove", move); document.removeEventListener("touchmove", move); document.removeEventListener("mouseup", finish); document.removeEventListener("touchend", finish); document.removeEventListener("touchcancel", finish); map.dragging.enable(); dragCleanup.current = null }
        const finish = () => { if (done) return; done = true; off(); setSelected(o.id); setDrawer(false); if (Math.abs(c.lat - c0.lat) < 1e-10 && Math.abs(c.lng - c0.lng) < 1e-10) return; setObjects((rows) => rows.map((x) => x.id === o.id ? { ...x, satellite_lat: c.lat, satellite_lng: c.lng, satellite_position_source: "operator" } : x)); void supabase.from("orchard_farm_map_objects").update({ satellite_lat: c.lat, satellite_lng: c.lng, satellite_position_source: "operator", updated_at: new Date().toISOString() }).eq("id", o.id).then((r) => { if (r.error) setError(text.saveError) }) }
        dragCleanup.current = off
        document.addEventListener("mousemove", move, { passive: false }); document.addEventListener("touchmove", move, { passive: false }); document.addEventListener("mouseup", finish, { once: true }); document.addEventListener("touchend", finish, { once: true }); document.addEventListener("touchcancel", finish, { once: true })
      }
      layer.on?.("mousedown", begin); layer.on?.("touchstart", begin)
      blocks.current.set(o.id, layer); map.addLayer(layer)

      if (!detail || !o.plot_id) continue
      const beds = bedsByPlot[o.plot_id] ?? []
      if (!beds.length) continue
      const strips = farmMapBedPolygons(start, { bedCount: Math.max(beds.length, num(o.bed_count, beds.length)), bedWidthM: num(o.bed_width_cm, 76) / 100, pathWidthM: num(o.path_width_cm, 40) / 100 })
      beds.forEach((bed, index) => {
        const points = strips[index]
        if (!points) return
        const hasPlan = bed.allocations.length > 0
        const bedLayer = L.polygon(points, { color: hasPlan ? "#d7b17a" : "#8f8a81", weight: labels ? 1.25 : .9, opacity: hasPlan ? .96 : .72, fillColor: hasPlan ? "#d7b17a" : "#5d5a54", fillOpacity: hasPlan ? .25 : .1, interactive: false })
        if (labels) bedLayer.bindTooltip?.(`<b>${safe(bedCode(bed))}</b><span>${safe(bedPlanText(bed, text.noPlan))}</span>`, { permanent: true, direction: "center", opacity: 1, className: `orchard-bed-label${hasPlan ? "" : " orchard-bed-label-empty"}` })
        bedLayers.current.set(`${o.id}:${bed.id}`, bedLayer); map.addLayer(bedLayer)
      })
    }
  }, [objects, summaries, bedsByPlot, showBlocks, selected, ready, zoom, supabase, text.noPlan, text.planned, text.saveError])

  useEffect(() => { const fn = () => { setFullscreen(document.fullscreenElement === root.current); requestAnimationFrame(() => mapRef.current?.invalidateSize()) }; document.addEventListener("fullscreenchange", fn); return () => document.removeEventListener("fullscreenchange", fn) }, [])

  const toggleOverlay = (o: Overlay) => { const map = mapRef.current, L = leaflet.current; if (!map || !L) return; const next = new Set(visibleRef.current), on = !next.has(o.id); on ? next.add(o.id) : next.delete(o.id); visibleRef.current = next; setVisible(next); const layer = layers.current.get(o.id); if (!layer && on) { void loadOverlay(L, map, o); return } if (layer) { if (on && !map.hasLayer(layer)) map.addLayer(layer); if (!on && map.hasLayer(layer)) map.removeLayer(layer) } }
  const block = objects.find((x) => x.id === selected) ?? null, summary = block?.plot_id ? summaries[block.plot_id] : undefined, selectedBeds = block?.plot_id ? bedsByPlot[block.plot_id] ?? [] : []
  const rotate = (v: number, persist = false) => { if (!selected) return; const r = Math.max(-180, Math.min(180, Math.round(v))); setObjects((rows) => rows.map((x) => x.id === selected ? { ...x, rotation_deg: r } : x)); if (persist) void supabase.from("orchard_farm_map_objects").update({ rotation_deg: r, updated_at: new Date().toISOString() }).eq("id", selected).then((result) => { if (result.error) setError(text.saveError) }) }
  const toggleFull = async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await root.current?.requestFullscreen?.() }

  return <main ref={root} className="relative h-[calc(100dvh-var(--orchard-nav-height,0px))] min-h-[620px] w-full overflow-hidden bg-[#11110f]">
    <div ref={node} className="absolute inset-0" aria-label={text.title} />
    <style jsx global>{`.orchard-label{background:rgba(18,18,16,.90)!important;border:1px solid rgba(241,238,231,.82)!important;border-radius:0!important;color:#f1eee7!important;padding:5px 7px!important;text-align:center!important;box-shadow:0 6px 18px rgba(0,0,0,.35)!important}.orchard-label:before,.orchard-bed-label:before{display:none!important}.orchard-label b{display:block;font-size:11px;line-height:1.1}.orchard-label span{display:block;margin-top:3px;color:#d7b17a;font-size:8px;font-weight:600;letter-spacing:.07em;line-height:1.1;text-transform:uppercase;white-space:nowrap}.orchard-label-active{border-color:#bde1cf!important}.orchard-label-active span{color:#bde1cf}.orchard-bed-label{background:rgba(18,18,16,.91)!important;border:1px solid rgba(215,177,122,.75)!important;border-radius:0!important;color:#f1eee7!important;padding:3px 4px!important;text-align:center!important;box-shadow:0 3px 10px rgba(0,0,0,.3)!important}.orchard-bed-label b{display:block;color:#bde1cf;font-size:7px;line-height:1}.orchard-bed-label span{display:block;margin-top:2px;max-width:98px;overflow:hidden;text-overflow:ellipsis;color:#e7d8bd;font-size:6.5px;font-weight:600;letter-spacing:.035em;line-height:1.15;text-transform:uppercase;white-space:nowrap}.orchard-bed-label-empty{border-color:rgba(143,138,129,.55)!important}.orchard-bed-label-empty span{color:#8f8a81!important}`}</style>
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-between p-4"><div className="border border-white/12 bg-[#171512]/90 px-3 py-2 text-[10px] font-semibold uppercase tracking-[.16em] text-[#91c9ae]">{text.subtitle}</div><button onClick={() => { setDrawer((v) => !v); setSelected(null) }} className="pointer-events-auto flex h-10 items-center gap-2 border border-white/15 bg-[#171512]/94 px-3 text-xs text-[#f1eee7]"><Layers3 className="h-4 w-4" />{text.layers}</button></div>
    {block && !drawer ? <aside className="absolute right-4 top-[70px] z-30 w-[340px] max-w-[calc(100%-32px)] border border-white/15 bg-[#171512]/97"><div className="flex justify-between border-b border-white/10 p-4"><div><div className="text-sm text-[#f1eee7]">{block.name}</div><div className="text-[11px] text-[#8f8a81]">{text.field} · {selectedBeds.length} {text.beds.toLowerCase()}</div></div><button onClick={() => setSelected(null)} className="border border-[#91c9ae]/40 bg-[#173328] px-3 text-xs text-[#bde1cf]">{text.done}</button></div>{summary ? <div className="border-b border-white/10 px-4 py-3"><div className="text-[10px] uppercase tracking-[.12em] text-[#91c9ae]">{text.season}{summary.season ? ` · ${summary.season}` : ""}</div><div className="mt-1 text-xs leading-5 text-[#e8e5dc]">{summary.crops.join(" · ")}</div></div> : null}<div className="border-b border-white/10 px-4 py-3"><div className="text-[10px] uppercase tracking-[.12em] text-[#91c9ae]">{text.bedDetail} · zoom {BED_DETAIL_ZOOM}+</div><div className="mt-1 text-[11px] leading-4 text-[#aaa69c]">{zoom >= BED_DETAIL_ZOOM ? `${selectedBeds.length} ${text.beds.toLowerCase()} · ${zoom >= BED_LABEL_ZOOM ? text.planned : `${text.planned} @ zoom ${BED_LABEL_ZOOM}`}` : `${text.beds}: zoom ${BED_DETAIL_ZOOM}+`}</div></div><div className="p-4"><div className="mb-3 flex justify-between text-xs text-[#aaa69c]"><span>{text.rotation}</span><span>{Math.round(num(block.rotation_deg))}°</span></div><input className="w-full accent-[#91c9ae]" type="range" min={-180} max={180} value={Math.round(num(block.rotation_deg))} onChange={(e) => rotate(Number(e.currentTarget.value))} onPointerUp={(e) => rotate(Number(e.currentTarget.value), true)} onBlur={(e) => rotate(Number(e.currentTarget.value), true)} /></div></aside> : null}
    {drawer ? <aside className="absolute right-4 top-[70px] z-30 w-[360px] max-w-[calc(100%-32px)] border border-white/15 bg-[#171512]/97"><div className="flex justify-between border-b border-white/10 p-4"><div><div className="text-xs text-[#f1eee7]">{text.layers}</div><div className="mt-1 text-[11px] leading-4 text-[#8f8a81]">{text.note}</div></div><button onClick={() => setDrawer(false)} aria-label={text.close}><X className="h-4 w-4 text-[#8f8a81]" /></button></div><button onClick={() => setShowBlocks((v) => !v)} className="flex w-full items-center gap-3 border-b border-white/10 p-4 text-left"><span className="h-3 w-3 border border-[#d7b17a]" style={{ background: showBlocks ? "#d7b17a" : "transparent" }} /><span className="flex-1"><span className="block text-xs text-[#e8e5dc]">{text.blocks}</span><span className="block text-[10px] uppercase tracking-[.08em] text-[#8f8a81]">{text.blockNote} · {PROVISIONAL_GEOREF.anchors.length} anchors</span></span>{showBlocks ? <Check className="h-4 w-4 text-[#d7b17a]" /> : null}</button><div className="max-h-[45vh] overflow-y-auto p-2">{overlays.map((o) => { const on = visible.has(o.id); return <button key={o.id} onClick={() => toggleOverlay(o)} className="flex w-full items-center gap-3 px-2 py-2 text-left hover:bg-white/[.04]"><span className="h-3 w-3 border" style={{ borderColor: overlayColor(o.name), background: on ? overlayColor(o.name) : "transparent" }} /><span className="truncate text-xs text-[#e8e5dc]">{o.name.replace(/^BS_/i, "").replaceAll("_", " ")}</span></button> })}</div></aside> : null}
    <div className="absolute bottom-5 left-[72px] z-20 flex border border-white/15 bg-[#171512]/94 p-1"><button onClick={() => mapRef.current?.setView(CENTER, 18)} className="flex h-9 items-center gap-2 px-3 text-xs text-[#e8e5dc]"><LocateFixed className="h-4 w-4 text-[#91c9ae]" />{text.focus}</button><button onClick={() => void toggleFull()} className="flex h-9 items-center gap-2 border-l border-white/10 px-3 text-xs text-[#e8e5dc]">{fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}{fullscreen ? text.exit : text.full}</button></div>
    {loading ? <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#11110f]/60 text-sm text-[#aaa69c]">{text.loading}</div> : null}{error ? <div className="absolute left-1/2 top-1/2 z-40 -translate-x-1/2 border border-red-400/30 bg-[#211817] px-4 py-3 text-sm text-[#e7c2bb]">{error}</div> : null}{baseError && !error ? <div className="absolute bottom-20 left-1/2 z-30 -translate-x-1/2 bg-[#211e1a]/95 px-4 py-2 text-xs text-[#d9c7a0]">{text.baseError}</div> : null}
  </main>
}

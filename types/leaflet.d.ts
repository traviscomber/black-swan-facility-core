declare module "leaflet" {
  namespace L {
    type LatLngExpression = [number, number]

    interface Layer {
      addTo(target: Map | LayerGroup): this
      remove(): this
      bindPopup(content: string): this
      on(event: string, handler: (...args: unknown[]) => void): this
    }

    class Map {
      setView(center: LatLngExpression, zoom: number): this
      fitBounds(bounds: LatLngBounds, options?: { padding?: [number, number]; maxZoom?: number }): this
      on(event: "click", handler: (event: LeafletMouseEvent) => void): this
      invalidateSize(): this
      remove(): this
    }

    class LayerGroup implements Layer {
      addTo(target: Map | LayerGroup): this
      remove(): this
      bindPopup(content: string): this
      on(event: string, handler: (...args: unknown[]) => void): this
      clearLayers(): this
    }

    interface LeafletMouseEvent {
      latlng: { lat: number; lng: number }
    }

    interface LatLngBounds {}

    interface TileLayer extends Layer {}
    interface Path extends Layer {}

    interface MapOptions {
      zoomControl?: boolean
    }

    interface TileLayerOptions {
      attribution?: string
      maxZoom?: number
    }

    interface PathOptions {
      color?: string
      weight?: number
      opacity?: number
      fillOpacity?: number
      radius?: number
      dashArray?: string
    }

    function map(element: HTMLElement, options?: MapOptions): Map
    function tileLayer(urlTemplate: string, options?: TileLayerOptions): TileLayer
    function layerGroup(): LayerGroup
    function circleMarker(latlng: LatLngExpression, options?: PathOptions): Path
    function polyline(latlngs: LatLngExpression[], options?: PathOptions): Path
    function polygon(latlngs: LatLngExpression[], options?: PathOptions): Path
    function latLngBounds(latlngs: LatLngExpression[]): LatLngBounds
  }

  const L: {
    map: typeof L.map
    tileLayer: typeof L.tileLayer
    layerGroup: typeof L.layerGroup
    circleMarker: typeof L.circleMarker
    polyline: typeof L.polyline
    polygon: typeof L.polygon
    latLngBounds: typeof L.latLngBounds
  }

  export = L
}

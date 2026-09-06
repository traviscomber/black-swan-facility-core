export type LatLng = { lat: number; lng: number }
export type ImagePoint = { x: number; y: number }
export type FarmMapRect = {
  xPct: number
  yPct: number
  widthPct: number
  heightPct: number
  rotationDeg: number
}

const IMAGE_WIDTH = 400
const IMAGE_HEIGHT = 333
const METERS_PER_DEG_LAT = 111_320
const ORIGIN: LatLng = { lat: -39.699435, lng: -73.205363 }
const METERS_PER_DEG_LNG = METERS_PER_DEG_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180)

// Provisional alignment derived from two clearly matching physical landmarks visible
// in the canonical Orchard aerial and the north-up Esri satellite view on 2026-09-05.
// It is intentionally presentation-only: it does not rewrite canonical farm-map positions.
const ANCHOR_A = {
  image: { x: 324, y: 29 },
  geo: { lat: -39.69903876705759, lng: -73.20530935581971 },
}
const ANCHOR_B = {
  image: { x: 208, y: 157 },
  geo: { lat: -39.69997568919921, lng: -73.2053790932541 },
}

function geoToMeters(point: LatLng) {
  return {
    x: (point.lng - ORIGIN.lng) * METERS_PER_DEG_LNG,
    y: (point.lat - ORIGIN.lat) * METERS_PER_DEG_LAT,
  }
}

const aMeters = geoToMeters(ANCHOR_A.geo)
const bMeters = geoToMeters(ANCHOR_B.geo)
const imageVector = {
  x: ANCHOR_B.image.x - ANCHOR_A.image.x,
  y: -(ANCHOR_B.image.y - ANCHOR_A.image.y),
}
const geoVector = { x: bMeters.x - aMeters.x, y: bMeters.y - aMeters.y }
const scale = Math.hypot(geoVector.x, geoVector.y) / Math.hypot(imageVector.x, imageVector.y)
const angle = Math.atan2(geoVector.y, geoVector.x) - Math.atan2(imageVector.y, imageVector.x)

export const PROVISIONAL_GEOREF = {
  status: "provisional" as const,
  source: "visual_landmark_alignment_2026-09-05",
  imageWidth: IMAGE_WIDTH,
  imageHeight: IMAGE_HEIGHT,
  anchors: [ANCHOR_A, ANCHOR_B] as const,
}

export function imagePointToLatLng(point: ImagePoint): LatLng {
  const dx = point.x - ANCHOR_A.image.x
  const dy = -(point.y - ANCHOR_A.image.y)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const east = aMeters.x + scale * (cos * dx - sin * dy)
  const north = aMeters.y + scale * (sin * dx + cos * dy)
  return {
    lat: ORIGIN.lat + north / METERS_PER_DEG_LAT,
    lng: ORIGIN.lng + east / METERS_PER_DEG_LNG,
  }
}

export function farmMapRectToLatLngs(rect: FarmMapRect): [number, number][] {
  const cx = (rect.xPct / 100) * IMAGE_WIDTH
  const cy = (rect.yPct / 100) * IMAGE_HEIGHT
  const halfW = ((rect.widthPct / 100) * IMAGE_WIDTH) / 2
  const halfH = ((rect.heightPct / 100) * IMAGE_HEIGHT) / 2
  const theta = (rect.rotationDeg * Math.PI) / 180
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const corners = [
    [-halfW, -halfH],
    [halfW, -halfH],
    [halfW, halfH],
    [-halfW, halfH],
  ] as const
  return corners.map(([x, y]) => {
    const point = imagePointToLatLng({ x: cx + cos * x - sin * y, y: cy + sin * x + cos * y })
    return [point.lat, point.lng]
  })
}

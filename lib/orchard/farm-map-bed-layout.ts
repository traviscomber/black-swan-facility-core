export type FarmMapLatLng = [number, number]

export type FarmMapBedLayoutOptions = {
  bedCount: number
  bedWidthM: number
  pathWidthM: number
}

function interpolate(a: FarmMapLatLng, b: FarmMapLatLng, t: number): FarmMapLatLng {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

/**
 * Subdivide a four-corner field footprint into long, parallel bed strips.
 *
 * The returned geometry is presentation-only. It preserves the canonical field
 * footprint and uses canonical bed/path widths to express planning order; it is
 * not a surveyed bed georeference.
 */
export function farmMapBedPolygons(
  field: FarmMapLatLng[],
  options: FarmMapBedLayoutOptions,
): FarmMapLatLng[][] {
  if (field.length !== 4) return []

  const bedCount = Math.max(0, Math.floor(options.bedCount))
  const bedWidthM = Math.max(0, options.bedWidthM)
  const pathWidthM = Math.max(0, options.pathWidthM)
  if (!bedCount || !bedWidthM) return []

  const totalWidthM = bedCount * bedWidthM + Math.max(0, bedCount - 1) * pathWidthM
  if (!totalWidthM) return []

  const [topLeft, topRight, bottomRight, bottomLeft] = field
  return Array.from({ length: bedCount }, (_, index) => {
    const start = (index * (bedWidthM + pathWidthM)) / totalWidthM
    const end = (index * (bedWidthM + pathWidthM) + bedWidthM) / totalWidthM
    return [
      interpolate(topLeft, topRight, start),
      interpolate(topLeft, topRight, end),
      interpolate(bottomLeft, bottomRight, end),
      interpolate(bottomLeft, bottomRight, start),
    ]
  })
}

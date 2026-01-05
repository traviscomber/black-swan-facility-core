"use client"

import { useState } from "react"

const KmzMapView = () => {
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapType, setMapType] = useState<"street" | "satellite" | "terrain" | "hybrid">("street")
  const [terrainOpacity, setTerrainOpacity] = useState(0.5)

  return (
    <div>
      {mapLoaded && (
        <div className="absolute top-4 left-4 z-[1000] space-y-3">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden mb-2">
            {["street", "satellite", "terrain", "hybrid"].map((type) => (
              <button
                key={type}
                onClick={() => {
                  try {
                    setMapType(type as "street" | "satellite" | "terrain" | "hybrid")
                  } catch (e) {
                    console.error("[v0] Error switching to", type, e)
                  }
                }}
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
                onChange={(e) => {
                  try {
                    setTerrainOpacity(Number.parseFloat(e.target.value))
                  } catch (e) {
                    console.error("[v0] Error updating opacity", e)
                  }
                }}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Satellite</span>
                <span>Terrain</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default KmzMapView

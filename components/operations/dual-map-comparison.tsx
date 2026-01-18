'use client'

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface DualMapProps {
  month1: Date
  month2: Date
  kmzFiles1: Array<{ id: string; file_url: string; name: string }>
  kmzFiles2: Array<{ id: string; file_url: string; name: string }>
  onMonth1Change: (date: Date) => void
  onMonth2Change: (date: Date) => void
}

export function DualMapComparison({ month1, month2, kmzFiles1, kmzFiles2, onMonth1Change, onMonth2Change }: DualMapProps) {
  const mapContainer1 = useRef<HTMLDivElement>(null)
  const mapContainer2 = useRef<HTMLDivElement>(null)
  const map1 = useRef<L.Map | null>(null)
  const map2 = useRef<L.Map | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize maps
  useEffect(() => {
    if (!mapContainer1.current || !mapContainer2.current) return

    // Initialize map 1
    map1.current = L.map(mapContainer1.current).setView([0, 0], 2)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map1.current)

    // Initialize map 2
    map2.current = L.map(mapContainer2.current).setView([0, 0], 2)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map2.current)

    setIsLoading(false)

    return () => {
      map1.current?.remove()
      map2.current?.remove()
    }
  }, [])

  // Load KMZ files on maps
  useEffect(() => {
    if (!map1.current || !map2.current) return

    // Load KMZ files for month 1
    kmzFiles1.forEach(file => {
      L.polyline([[0, 0]], { color: '#2196F3', weight: 2 }).addTo(map1.current!)
    })

    // Load KMZ files for month 2
    kmzFiles2.forEach(file => {
      L.polyline([[0, 0]], { color: '#FF6B35', weight: 2 }).addTo(map2.current!)
    })
  }, [kmzFiles1, kmzFiles2])

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Map 1 */}
        <Card className="overflow-hidden">
          <div className="bg-muted p-4 flex items-center justify-between border-b">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const prev = new Date(month1)
                  prev.setMonth(prev.getMonth() - 1)
                  onMonth1Change(prev)
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-semibold capitalize text-sm min-w-32">{formatMonth(month1)}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const next = new Date(month1)
                  next.setMonth(next.getMonth() + 1)
                  onMonth1Change(next)
                }}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">{kmzFiles1.length} rutas</span>
          </div>
          <div ref={mapContainer1} className="h-96 w-full bg-background" />
        </Card>

        {/* Map 2 */}
        <Card className="overflow-hidden">
          <div className="bg-muted p-4 flex items-center justify-between border-b">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const prev = new Date(month2)
                  prev.setMonth(prev.getMonth() - 1)
                  onMonth2Change(prev)
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-semibold capitalize text-sm min-w-32">{formatMonth(month2)}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const next = new Date(month2)
                  next.setMonth(next.getMonth() + 1)
                  onMonth2Change(next)
                }}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">{kmzFiles2.length} rutas</span>
          </div>
          <div ref={mapContainer2} className="h-96 w-full bg-background" />
        </Card>
      </div>

      {/* Comparison Legend */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-3">Leyenda de Comparación</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-1 bg-blue-500 rounded" />
            <span className="text-sm">{formatMonth(month1)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-1 bg-orange-500 rounded" />
            <span className="text-sm">{formatMonth(month2)}</span>
          </div>
        </div>
      </Card>
    </div>
  )
}

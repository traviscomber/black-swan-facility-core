'use client'

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MapPin, Truck, Clock, TrendingUp, Download, Share2, Trash2 } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface OperationDetail {
  id: string
  operation_code: string
  title: string
  description?: string
  operation_type: string
  vehicle?: { name: string; code: string }
  start_date: string
  end_date?: string
  status: string
  distance_km?: number
  duration_hours?: number
  area_covered_km2?: number
  location?: string
  notes?: string
  kmz_files?: Array<{ id: string; name: string; file_url: string; total_distance_km?: number }>
}

interface OperationDetailViewProps {
  operation: OperationDetail
  onDelete?: () => void
  onEdit?: () => void
}

const statusColors: Record<string, string> = {
  planned: 'bg-blue-500/10 text-blue-700',
  in_progress: 'bg-amber-500/10 text-amber-700',
  completed: 'bg-green-500/10 text-green-700',
  cancelled: 'bg-red-500/10 text-red-700',
}

export function OperationDetailView({ operation, onDelete, onEdit }: OperationDetailViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (!mapContainer.current) return

    map.current = L.map(mapContainer.current).setView([0, 0], 3)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map.current)

    // Add sample route visualization
    L.polyline([[0, 0]], { color: '#2196F3', weight: 2 }).addTo(map.current)

    return () => {
      map.current?.remove()
    }
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-sm text-muted-foreground">{operation.operation_code}</span>
              <Badge className={statusColors[operation.status] || ''}>
                {operation.status}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold">{operation.title}</h1>
            {operation.description && (
              <p className="text-sm text-muted-foreground mt-2">{operation.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              Editar
            </Button>
            <Button variant="outline" size="sm" className="text-destructive bg-transparent" onClick={onDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {operation.vehicle && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Vehículo</span>
            </div>
            <p className="font-semibold text-sm">{operation.vehicle.name}</p>
            <p className="text-xs text-muted-foreground">{operation.vehicle.code}</p>
          </Card>
        )}
        {operation.distance_km && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Distancia</span>
            </div>
            <p className="font-semibold text-sm">{operation.distance_km.toFixed(1)} km</p>
          </Card>
        )}
        {operation.duration_hours && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Duración</span>
            </div>
            <p className="font-semibold text-sm">{operation.duration_hours.toFixed(1)} hrs</p>
          </Card>
        )}
        {operation.area_covered_km2 && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Área</span>
            </div>
            <p className="font-semibold text-sm">{operation.area_covered_km2.toFixed(2)} km²</p>
          </Card>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="route">Ruta</TabsTrigger>
          <TabsTrigger value="files">Archivos KMZ</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-3">Información General</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Inicio:</span>
                <span>{formatDate(operation.start_date)}</span>
              </div>
              {operation.end_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fin:</span>
                  <span>{formatDate(operation.end_date)}</span>
                </div>
              )}
              {operation.location && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ubicación:</span>
                  <span>{operation.location}</span>
                </div>
              )}
            </div>
          </Card>
          {operation.notes && (
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3">Notas</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{operation.notes}</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="route">
          <Card className="overflow-hidden">
            <div ref={mapContainer} className="w-full h-96 bg-background" />
          </Card>
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          {operation.kmz_files && operation.kmz_files.length > 0 ? (
            operation.kmz_files.map(file => (
              <Card key={file.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{file.name}</p>
                    {file.total_distance_km && (
                      <p className="text-xs text-muted-foreground">{file.total_distance_km.toFixed(1)} km</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Descargar
                  </Button>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No hay archivos KMZ asociados</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

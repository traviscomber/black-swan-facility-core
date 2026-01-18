'use client'

import { useCallback, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrendingUp, Truck, MapPin, Clock } from 'lucide-react'

interface Operation {
  id: string
  operation_code: string
  title: string
  operation_type: string
  vehicle_id?: string
  start_date: string
  end_date?: string
  status: string
  distance_km?: number
  duration_hours?: number
  area_covered_km2?: number
  vehicle?: { name: string; code: string }
}

interface OperationsListProps {
  operations: Operation[]
  selectedVehicle?: string
  onOperationClick?: (operation: Operation) => void
}

const statusColors: Record<string, string> = {
  planned: 'bg-blue-500/10 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-500/10 text-amber-700 border-amber-200',
  completed: 'bg-green-500/10 text-green-700 border-green-200',
  cancelled: 'bg-red-500/10 text-red-700 border-red-200',
}

const operationTypeLabels: Record<string, string> = {
  vehicle_trip: 'Viaje',
  field_operation: 'Operación de Campo',
  survey: 'Levantamiento',
  inspection: 'Inspección',
  maintenance: 'Mantenimiento',
  other: 'Otro',
}

export function OperationsList({ operations, selectedVehicle, onOperationClick }: OperationsListProps) {
  const filteredOperations = useMemo(() => {
    if (!selectedVehicle) return operations
    return operations.filter(op => op.vehicle_id === selectedVehicle)
  }, [operations, selectedVehicle])

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [])

  if (filteredOperations.length === 0) {
    return (
      <Card className="p-8 text-center">
        <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
        <p className="text-muted-foreground">No hay operaciones registradas para este período</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {filteredOperations.map(operation => (
        <Card
          key={operation.id}
          className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={() => onOperationClick?.(operation)}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-muted-foreground">{operation.operation_code}</span>
                <Badge variant="outline" className={statusColors[operation.status] || ''}>
                  {operation.status}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {operationTypeLabels[operation.operation_type] || operation.operation_type}
                </Badge>
              </div>
              <h3 className="font-semibold text-sm">{operation.title}</h3>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {operation.vehicle && (
              <div className="flex items-center gap-2 text-xs">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{operation.vehicle.name}</span>
              </div>
            )}
            {operation.distance_km && (
              <div className="flex items-center gap-2 text-xs">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{operation.distance_km.toFixed(1)} km</span>
              </div>
            )}
            {operation.duration_hours && (
              <div className="flex items-center gap-2 text-xs">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{operation.duration_hours.toFixed(1)} hrs</span>
              </div>
            )}
            {operation.area_covered_km2 && (
              <div className="flex items-center gap-2 text-xs">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{operation.area_covered_km2.toFixed(2)} km²</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatDate(operation.start_date)}</span>
            {operation.end_date && <span>→ {formatDate(operation.end_date)}</span>}
          </div>
        </Card>
      ))}
    </div>
  )
}

'use client'

import { Card } from '@/components/ui/card'
import { TrendingUp, MapPin, Clock, Zap } from 'lucide-react'

interface MonthlyStats {
  total_operations: number
  total_distance_km: number
  total_duration_hours: number
  total_area_covered_km2: number
  total_kmz_files: number
  vehicles_active?: string[]
}

interface OperationsStatsProps {
  stats: MonthlyStats
}

export function OperationsStats({ stats }: OperationsStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <Card className="p-4 border-l-4 border-l-blue-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Operaciones</p>
            <p className="text-2xl font-bold">{stats.total_operations}</p>
          </div>
          <Zap className="w-8 h-8 text-blue-500 opacity-20" />
        </div>
      </Card>

      <Card className="p-4 border-l-4 border-l-green-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Distancia Total</p>
            <p className="text-2xl font-bold">{stats.total_distance_km.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">km</p>
          </div>
          <MapPin className="w-8 h-8 text-green-500 opacity-20" />
        </div>
      </Card>

      <Card className="p-4 border-l-4 border-l-amber-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Horas Totales</p>
            <p className="text-2xl font-bold">{stats.total_duration_hours.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">hrs</p>
          </div>
          <Clock className="w-8 h-8 text-amber-500 opacity-20" />
        </div>
      </Card>

      <Card className="p-4 border-l-4 border-l-purple-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Área Cubierta</p>
            <p className="text-2xl font-bold">{stats.total_area_covered_km2.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">km²</p>
          </div>
          <TrendingUp className="w-8 h-8 text-purple-500 opacity-20" />
        </div>
      </Card>

      <Card className="p-4 border-l-4 border-l-pink-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Archivos KMZ</p>
            <p className="text-2xl font-bold">{stats.total_kmz_files}</p>
          </div>
          <Zap className="w-8 h-8 text-pink-500 opacity-20" />
        </div>
      </Card>
    </div>
  )
}

'use client'

import { Card } from '@/components/ui/card'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface RouteAnalyticsData {
  month: string
  distance: number
  duration: number
  area: number
  operations: number
}

interface VehicleStats {
  name: string
  distance: number
  operations: number
  hours: number
}

interface AnalyticsDashboardProps {
  chartData: RouteAnalyticsData[]
  vehicleStats: VehicleStats[]
  totalDistance: number
  totalOperations: number
  avgDistancePerOperation: number
  avgDurationPerOperation: number
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

export function AnalyticsDashboard({
  chartData,
  vehicleStats,
  totalDistance,
  totalOperations,
  avgDistancePerOperation,
  avgDurationPerOperation,
}: AnalyticsDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Distancia Total</p>
          <p className="text-3xl font-bold">{totalDistance.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground mt-2">km acumulados</p>
        </Card>

        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Operaciones</p>
          <p className="text-3xl font-bold">{totalOperations}</p>
          <p className="text-xs text-muted-foreground mt-2">registradas</p>
        </Card>

        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Promedio por Operación</p>
          <p className="text-3xl font-bold">{avgDistancePerOperation.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground mt-2">km/operación</p>
        </Card>

        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Promedio Duración</p>
          <p className="text-3xl font-bold">{avgDurationPerOperation.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground mt-2">horas/operación</p>
        </Card>
      </div>

      {/* Distance Trend */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Tendencia de Distancia por Mes</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="distance" stroke="#3b82f6" name="Distancia (km)" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Operations vs Duration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Operaciones por Mes</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="operations" fill="#10b981" name="Operaciones" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Horas Dedicadas</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="duration" fill="#f59e0b" name="Horas" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Vehicle Performance */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Rendimiento por Vehículo</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-muted-foreground font-medium">Vehículo</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Distancia (km)</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Operaciones</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Horas</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Promedio</th>
              </tr>
            </thead>
            <tbody>
              {vehicleStats.map(vehicle => (
                <tr key={vehicle.name} className="border-b hover:bg-muted/50">
                  <td className="py-3 font-medium">{vehicle.name}</td>
                  <td className="py-3 text-right">{vehicle.distance.toFixed(1)}</td>
                  <td className="py-3 text-right">{vehicle.operations}</td>
                  <td className="py-3 text-right">{vehicle.hours.toFixed(1)}</td>
                  <td className="py-3 text-right text-muted-foreground">
                    {(vehicle.distance / vehicle.operations).toFixed(1)} km/op
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Area Coverage */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Área Cubierta por Mes</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="area" stroke="#8b5cf6" name="Área (km²)" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}

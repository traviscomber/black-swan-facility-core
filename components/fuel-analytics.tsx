'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface FuelAnalyticsTabProps {
  records: any[]
  vehicles: any[]
}

export function FuelAnalyticsTab({ records, vehicles }: FuelAnalyticsTabProps) {
  // Prepare data by date
  const dailyData = new Map<string, { date: string; liters: number; cost: number }>()
  records.forEach((record: any) => {
    const date = record.date_recorded || new Date().toISOString().split('T')[0]
    const key = date
    if (!dailyData.has(key)) {
      dailyData.set(key, { date: key, liters: 0, cost: 0 })
    }
    const data = dailyData.get(key)!
    data.liters += record.liters || 0
    data.cost += record.cost_pesos || 0
  })

  const dailyTrendData = Array.from(dailyData.values())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-30) // Last 30 days

  // Consumption by fuel type
  const fuelTypeData = new Map<string, number>()
  records.forEach((record: any) => {
    const type = record.fuel_type || 'Unknown'
    fuelTypeData.set(type, (fuelTypeData.get(type) || 0) + (record.liters || 0))
  })

  const fuelTypeChartData = Array.from(fuelTypeData.entries()).map(([type, liters]) => ({
    name: type,
    value: liters,
  }))

  // Top vehicles by consumption
  const vehicleConsumption = new Map<string, number>()
  records.forEach((record: any) => {
    const vehicleName =
      vehicles.find((v: any) => v.id === record.vehicle_id)?.name || record.vehicle_id || 'Unknown'
    vehicleConsumption.set(vehicleName, (vehicleConsumption.get(vehicleName) || 0) + (record.liters || 0))
  })

  const topVehiclesData = Array.from(vehicleConsumption.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, liters]) => ({ name, liters }))

  // Cost trend
  const costTrendData = dailyTrendData.map(d => ({
    date: new Date(d.date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' }),
    cost: d.cost / 1000, // Convert to thousands
  }))

  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

  const avgLitersPerRecord = records.length > 0 ? records.reduce((sum: number, r: any) => sum + (r.liters || 0), 0) / records.length : 0
  const totalCost = records.reduce((sum: number, r: any) => sum + (r.cost_pesos || 0), 0)
  const avgCostPerLiter = records.length > 0 ? totalCost / records.reduce((sum: number, r: any) => sum + (r.liters || 0), 0) : 0

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Promedio por Registro</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{avgLitersPerRecord.toFixed(1)}L</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Costo Promedio/Litro</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${avgCostPerLiter.toFixed(0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Gasto Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              ${totalCost.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tendencia de Consumo (últimos 30 días)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => new Date(value).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
              />
              <YAxis />
              <Tooltip
                formatter={(value) => value.toFixed(1)}
                labelFormatter={(label) => new Date(label).toLocaleDateString('es-CO')}
              />
              <Legend />
              <Line type="monotone" dataKey="liters" stroke="#3b82f6" name="Litros" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Tipo de Combustible</CardTitle>
          </CardHeader>
          <CardContent>
            {fuelTypeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={fuelTypeChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value.toFixed(0)}L`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {fuelTypeChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value.toFixed(1)}L`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500">No hay datos disponibles</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 10 Vehículos por Consumo</CardTitle>
          </CardHeader>
          <CardContent>
            {topVehiclesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topVehiclesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip formatter={(value) => `${value.toFixed(1)}L`} />
                  <Bar dataKey="liters" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500">No hay datos disponibles</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tendencia de Costos</CardTitle>
        </CardHeader>
        <CardContent>
          {costTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={costTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: 'Costo (miles COP)', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => `$${(value * 1000).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`} />
                <Bar dataKey="cost" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500">No hay datos disponibles</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

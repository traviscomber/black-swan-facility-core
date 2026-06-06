'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface MonthlySummaryTabProps {
  records: any[]
  summary: any[]
  anomalies: any[]
}

export function MonthlySummaryTab({ records, summary, anomalies }: MonthlySummaryTabProps) {
  // Group records by month
  const monthlyData = new Map<string, any>()

  records.forEach((record: any) => {
    const date = new Date(record.date_recorded)
    const monthKey = date.toISOString().substring(0, 7) // YYYY-MM
    
    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, {
        month: monthKey,
        totalLiters: 0,
        totalCost: 0,
        recordCount: 0,
        vehicles: new Set<string>(),
        fuelTypes: {} as Record<string, number>,
      })
    }

    const data = monthlyData.get(monthKey)!
    data.totalLiters += record.liters || 0
    data.totalCost += record.cost_pesos || 0
    data.recordCount += 1
    data.vehicles.add(record.vehicle_id)
    
    const fuelType = record.fuel_type || 'Unknown'
    data.fuelTypes[fuelType] = (data.fuelTypes[fuelType] || 0) + (record.liters || 0)
  })

  const months = Array.from(monthlyData.values()).sort((a, b) => b.month.localeCompare(a.month))

  const totalAnomalies = anomalies.length
  const criticalAnomalies = anomalies.filter((a: any) => a.severity === 'high').length

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Registros</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{records.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Litros</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{records.reduce((sum: number, r: any) => sum + (r.liters || 0), 0).toFixed(0)}L</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Gasto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              ${records.reduce((sum: number, r: any) => sum + (r.cost_pesos || 0), 0).toLocaleString('es-CO')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Anomalías</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{totalAnomalies}</p>
            <p className="text-xs text-red-500">{criticalAnomalies} críticas</p>
          </CardContent>
        </Card>
      </div>

      {criticalAnomalies > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Se detectaron {criticalAnomalies} anomalías críticas. Revisar registros sospechosos.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Resumen por Mes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Registros</TableHead>
                  <TableHead className="text-right">Litros</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">$/L</TableHead>
                  <TableHead>Tipos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {months.map((month: any) => {
                  const costPerLiter = month.totalLiters > 0 ? month.totalCost / month.totalLiters : 0
                  return (
                    <TableRow key={month.month}>
                      <TableCell className="font-medium">{month.month}</TableCell>
                      <TableCell className="text-right">{month.recordCount}</TableCell>
                      <TableCell className="text-right">{month.totalLiters.toFixed(2)}L</TableCell>
                      <TableCell className="text-right">
                        ${month.totalCost.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="text-right">${costPerLiter.toFixed(0)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {Object.entries(month.fuelTypes).map(([type, liters]: [string, any]) => (
                            <Badge key={type} variant="outline" className="text-xs">
                              {type}: {liters.toFixed(0)}L
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Anomalías Detectadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Severidad</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anomalies.slice(0, 20).map((anomaly: any) => (
                    <TableRow key={anomaly.id}>
                      <TableCell className="font-medium capitalize text-xs">
                        {anomaly.anomaly_type?.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="text-sm">{anomaly.description}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            anomaly.severity === 'high'
                              ? 'destructive'
                              : anomaly.severity === 'medium'
                                ? 'outline'
                                : 'secondary'
                          }
                        >
                          {anomaly.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {anomaly.confirmed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <div className="w-4 h-4 rounded border border-gray-300" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

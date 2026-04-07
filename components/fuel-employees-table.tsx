'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Users } from 'lucide-react'

interface EmployeeFuelData {
  id: string
  name: string
  totalLiters: number
  totalCost: number
  transactionCount: number
  gasolineLiters: number
  dieselLiters: number
  gasolineCost: number
  dieselCost: number
}

interface FuelEmployeesTableProps {
  data: EmployeeFuelData[]
  loading?: boolean
}

export function FuelEmployeesTable({ data, loading }: FuelEmployeesTableProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Consumo por Empleado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">Cargando datos...</div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Consumo por Empleado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">No hay datos disponibles</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Consumo por Empleado (Enero 2026)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead className="text-right">Transacciones</TableHead>
                <TableHead className="text-right">Gasolina (L)</TableHead>
                <TableHead className="text-right">Diesel (L)</TableHead>
                <TableHead className="text-right">Total Litros</TableHead>
                <TableHead className="text-right">Gasolina $</TableHead>
                <TableHead className="text-right">Diesel $</TableHead>
                <TableHead className="text-right">Costo Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell className="text-right text-sm">{employee.transactionCount}</TableCell>
                  <TableCell className="text-right text-sm">
                    {employee.gasolineLiters.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {employee.dieselLiters.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{employee.totalLiters.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-sm">
                    ${employee.gasolineCost.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    ${employee.dieselCost.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    ${employee.totalCost.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted font-semibold">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right">
                  {data.reduce((sum, e) => sum + e.transactionCount, 0)}
                </TableCell>
                <TableCell className="text-right">
                  {data.reduce((sum, e) => sum + e.gasolineLiters, 0).toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  {data.reduce((sum, e) => sum + e.dieselLiters, 0).toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  {data.reduce((sum, e) => sum + e.totalLiters, 0).toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  ${data.reduce((sum, e) => sum + e.gasolineCost, 0).toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                </TableCell>
                <TableCell className="text-right">
                  ${data.reduce((sum, e) => sum + e.dieselCost, 0).toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                </TableCell>
                <TableCell className="text-right">
                  ${data.reduce((sum, e) => sum + e.totalCost, 0).toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

import { AppLayout } from '@/components/app-layout'
import { PageHeader } from '@/components/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { FuelUploadComponent } from '@/components/fuel-upload'
import { MonthlySummaryTab } from '@/components/fuel-monthly-summary'
import { FuelAnalyticsTab } from '@/components/fuel-analytics'
import { AlertTriangle, BarChart3, FileUp, ListChecks } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Employee = { id: string; name: string }
type FuelRecord = {
  id: string
  date_recorded: string
  liters: number | null
  cost_pesos: number | null
  fuel_type: string | null
  vehicle_id: string | null
  submitted_by: string | null
  is_verified: boolean | null
  source: string | null
  location: string | null
  odometer_reading: number | null
  employee_name?: string | null
}

type Vehicle = { id: string; name: string | null; code: string | null; vehicle_type: string | null; plate_number: string | null; status: string | null }

export default async function CombustiblesPage() {
  const supabase = await createClient()

  const [fuelResponse, employeesResponse, anomaliesResponse, vehiclesResponse] = await Promise.all([
    supabase
      .from('fuel_consumption')
      .select('id, date_recorded, liters, cost_pesos, fuel_type, vehicle_id, submitted_by, is_verified, source, location, odometer_reading')
      .order('date_recorded', { ascending: false })
      .limit(1000),
    supabase.from('employees').select('id, name'),
    supabase.from('fuel_consumption_anomalies').select('*').order('detected_at', { ascending: false }).limit(100),
    supabase.from('vehicles').select('id, name, code, vehicle_type, plate_number, status').order('name'),
  ])

  const fuelRecords = (fuelResponse.data ?? []) as FuelRecord[]
  const employees = (employeesResponse.data ?? []) as Employee[]
  const employeeMap = new Map(employees.map((employee) => [employee.id, employee.name]))
  const enrichedFuelRecords = fuelRecords.map((record) => ({
    ...record,
    employee_name: record.submitted_by ? employeeMap.get(record.submitted_by) ?? 'No identificado' : 'No informado',
  }))

  const pendingVerification = fuelRecords.filter((record) => !record.is_verified).length
  const incompleteRecords = fuelRecords.filter((record) => !record.location || record.odometer_reading == null).length

  return (
    <AppLayout>
      <PageHeader
        title="Combustibles"
        description="Cargas registradas por vehículo, revisión de respaldo y análisis mensual del Fundo Corcovado."
      />

      <div className="space-y-6 p-4 sm:p-8">
        {(pendingVerification > 0 || incompleteRecords > 0) && (
          <Card className="border-amber-300">
            <CardContent className="flex gap-3 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">Los consumos cargados todavía requieren validación operativa.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {pendingVerification.toLocaleString('es-CL')} registros están pendientes de verificación y {incompleteRecords.toLocaleString('es-CL')} no incluyen ubicación u odómetro. Litros y costos se presentan como valores registrados, no como consumo confirmado.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {fuelResponse.error && (
          <Card className="border-destructive/50"><CardContent className="p-4 text-sm text-destructive">No fue posible cargar los registros de combustible: {fuelResponse.error.message}</CardContent></Card>
        )}

        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-3">
            <TabsTrigger value="summary" className="flex min-h-10 items-center gap-2"><BarChart3 className="h-4 w-4" /><span>Resumen</span></TabsTrigger>
            <TabsTrigger value="analytics" className="flex min-h-10 items-center gap-2"><ListChecks className="h-4 w-4" /><span>Detalle</span></TabsTrigger>
            <TabsTrigger value="upload" className="flex min-h-10 items-center gap-2"><FileUp className="h-4 w-4" /><span>Importar</span></TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="summary">
              <MonthlySummaryTab records={enrichedFuelRecords} summary={[]} anomalies={anomaliesResponse.data ?? []} />
            </TabsContent>
            <TabsContent value="analytics">
              <FuelAnalyticsTab records={enrichedFuelRecords} vehicles={(vehiclesResponse.data ?? []) as Vehicle[]} />
            </TabsContent>
            <TabsContent value="upload">
              <FuelUploadComponent />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  )
}

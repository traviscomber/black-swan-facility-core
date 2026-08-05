import { AppLayout } from '@/components/app-layout'
import { PageHeader } from '@/components/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { FuelUploadComponent } from '@/components/fuel-upload'
import { MonthlySummaryTab } from '@/components/fuel-monthly-summary'
import { FuelAnalyticsTab } from '@/components/fuel-analytics'
import { FuelValidationReview } from '@/components/fuel-validation-review'
import { AlertTriangle, BarChart3, FileUp, ListChecks, ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Employee = { id: string; name: string }
type Vehicle = { id: string; name: string | null; code: string | null; vehicle_type: string | null; plate_number: string | null; status: string | null }
type FuelRecord = {
  id: string
  date_recorded: string
  liters: number | null
  cost_pesos: number | null
  fuel_type: string | null
  vehicle_id: string | null
  submitted_by: string | null
  is_verified: boolean | null
  validation_status: string | null
  source: string | null
  location: string | null
  odometer_reading: number | null
  employee_name?: string | null
  vehicle?: { name?: string | null; code?: string | null } | null
}

export default async function CombustiblesPage() {
  const supabase = await createClient()

  const [fuelResponse, verifiedFuelResponse, employeesResponse, anomaliesResponse, vehiclesResponse] = await Promise.all([
    supabase
      .from('fuel_consumption')
      .select('id, date_recorded, liters, cost_pesos, fuel_type, vehicle_id, submitted_by, is_verified, validation_status, source, location, odometer_reading, vehicle:vehicles(name, code)')
      .order('date_recorded', { ascending: false })
      .limit(1000),
    supabase
      .from('verified_fuel_consumption')
      .select('id, date_recorded, liters, cost_pesos, fuel_type, vehicle_id, submitted_by, is_verified, validation_status, source, location, odometer_reading')
      .order('date_recorded', { ascending: false })
      .limit(1000),
    supabase.from('employees').select('id, name'),
    supabase.from('fuel_consumption_anomalies').select('*').order('detected_at', { ascending: false }).limit(100),
    supabase.from('vehicles').select('id, name, code, vehicle_type, plate_number, status').order('name'),
  ])

  const fuelRecords = (fuelResponse.data ?? []) as FuelRecord[]
  const verifiedFuelRecords = (verifiedFuelResponse.data ?? []) as FuelRecord[]
  const employees = (employeesResponse.data ?? []) as Employee[]
  const employeeMap = new Map(employees.map((employee) => [employee.id, employee.name]))
  const enrichRecords = (records: FuelRecord[]) => records.map((record) => ({
    ...record,
    employee_name: record.submitted_by ? employeeMap.get(record.submitted_by) ?? 'No identificado' : 'No informado',
  }))

  const enrichedVerifiedFuelRecords = enrichRecords(verifiedFuelRecords)
  const pendingRecords = fuelRecords.filter((record) => (record.validation_status || 'pending') === 'pending')
  const rejectedRecords = fuelRecords.filter((record) => record.validation_status === 'rejected')
  const incompleteRecords = pendingRecords.filter((record) => !record.location || record.odometer_reading == null).length

  return (
    <AppLayout>
      <PageHeader
        title="Combustibles"
        description="Registro, validación y análisis de consumos del Fundo Corcovado."
      />

      <div className="space-y-6 p-4 sm:p-8">
        {(pendingRecords.length > 0 || incompleteRecords > 0) && (
          <Card className="border-amber-300">
            <CardContent className="flex gap-3 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">Los consumos pendientes no afectan indicadores operacionales.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {pendingRecords.length.toLocaleString('es-CL')} registros esperan revisión y {incompleteRecords.toLocaleString('es-CL')} no incluyen ubicación u odómetro. Solo los registros verificados ingresan a KPI, costos y análisis.
                  {rejectedRecords.length > 0 ? ` ${rejectedRecords.length.toLocaleString('es-CL')} registros fueron rechazados y permanecen disponibles para auditoría.` : ''}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {fuelResponse.error && (
          <Card className="border-destructive/50"><CardContent className="p-4 text-sm text-destructive">No fue posible cargar los registros de combustible: {fuelResponse.error.message}</CardContent></Card>
        )}

        {verifiedFuelResponse.error && (
          <Card className="border-destructive/50"><CardContent className="p-4 text-sm text-destructive">No fue posible cargar los consumos verificados: {verifiedFuelResponse.error.message}</CardContent></Card>
        )}

        <Tabs defaultValue="validation" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="validation" className="flex min-h-10 items-center gap-2"><ShieldCheck className="h-4 w-4" /><span>Validación</span></TabsTrigger>
            <TabsTrigger value="summary" className="flex min-h-10 items-center gap-2"><BarChart3 className="h-4 w-4" /><span>Resumen</span></TabsTrigger>
            <TabsTrigger value="analytics" className="flex min-h-10 items-center gap-2"><ListChecks className="h-4 w-4" /><span>Análisis</span></TabsTrigger>
            <TabsTrigger value="upload" className="flex min-h-10 items-center gap-2"><FileUp className="h-4 w-4" /><span>Importar</span></TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="validation">
              <FuelValidationReview records={pendingRecords} />
            </TabsContent>
            <TabsContent value="summary">
              <MonthlySummaryTab
                records={enrichedVerifiedFuelRecords}
                summary={[]}
                anomalies={anomaliesResponse.data ?? []}
                pendingCount={pendingRecords.length}
              />
            </TabsContent>
            <TabsContent value="analytics">
              <FuelAnalyticsTab records={enrichedVerifiedFuelRecords} vehicles={(vehiclesResponse.data ?? []) as Vehicle[]} />
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

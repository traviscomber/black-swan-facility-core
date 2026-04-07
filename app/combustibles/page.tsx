import { AppLayout } from '@/components/app-layout'
import { PageHeader } from '@/components/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/server'
import { FuelUploadComponent } from '@/components/fuel-upload'
import { MonthlySummaryTab } from '@/components/fuel-monthly-summary'
import { FuelAnalyticsTab } from '@/components/fuel-analytics'
import { Upload, TrendingUp, BarChart3 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CombustiblesPage() {
  const supabase = await createClient()

  // Fetch fuel records and employees separately (no foreign key relationship defined)
  const [fuelResponse, employeesResponse] = await Promise.all([
    supabase
      .from('fuel_consumption')
      .select('*')
      .order('date_recorded', { ascending: false })
      .limit(1000),
    supabase
      .from('employees')
      .select('id, name')
  ])

  const fuelRecords = fuelResponse.data || []
  const employees = employeesResponse.data || []

  // Create a map of employee IDs to names
  const employeeMap = new Map(employees.map((emp: any) => [emp.id, emp.name]))

  // Enrich fuel records with employee names
  const enrichedFuelRecords = fuelRecords.map((record: any) => ({
    ...record,
    employee_name: employeeMap.get(record.submitted_by) || 'Unknown'
  }))

  const { data: monthlySummary } = await supabase
    .from('monthly_fuel_summary')
    .select('*')
    .order('month', { ascending: false })
    .limit(12)

  const { data: anomalies } = await supabase
    .from('fuel_consumption_anomalies')
    .select('*')
    .order('detected_at', { ascending: false })
    .limit(100)

  const { data: vehicles } = await supabase.from('vehicles').select('*')

  return (
    <AppLayout>
      <PageHeader 
        title="Combustibles" 
        description="Gestionar consumo de combustible, detectar anomalías y generar reportes mensuales"
      />

      <div className="p-8">
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Cargar Reporte</span>
              <span className="sm:hidden">Cargar</span>
            </TabsTrigger>
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Resumen Mensual</span>
              <span className="sm:hidden">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
              <span className="sm:hidden">Datos</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-8">
            <TabsContent value="upload">
              <FuelUploadComponent />
            </TabsContent>

            <TabsContent value="summary">
              <MonthlySummaryTab 
                records={enrichedFuelRecords || []} 
                summary={monthlySummary || []}
                anomalies={anomalies || []}
              />
            </TabsContent>

            <TabsContent value="analytics">
              <FuelAnalyticsTab 
                records={enrichedFuelRecords || []} 
                vehicles={vehicles || []}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  )
}

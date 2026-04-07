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

  // Fetch current data with employee names
  const { data: fuelRecords } = await supabase
    .from('fuel_consumption')
    .select('*, employees(name)')
    .order('date_recorded', { ascending: false })
    .limit(1000)

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
                records={fuelRecords || []} 
                summary={monthlySummary || []}
                anomalies={anomalies || []}
              />
            </TabsContent>

            <TabsContent value="analytics">
              <FuelAnalyticsTab 
                records={fuelRecords || []} 
                vehicles={vehicles || []}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  )
}

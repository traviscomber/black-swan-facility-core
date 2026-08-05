import { AppLayout } from '@/components/app-layout'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { FleetRegistryConsole, type FleetRegistryRow } from '@/components/fleet-registry-console'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function FleetPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehicle_registry_health')
    .select('id, code, name, vehicle_type, plate_number, vin, serial_number, operational_class, operational_subtype, suggested_operational_class, classification_status, fuel_tracking_enabled, maintenance_tracking_enabled, missing_fields')
    .order('name')

  return (
    <AppLayout>
      <PageHeader
        title="Flota y equipos"
        description="Clasificación operacional, identidad, combustible y mantenimiento del parque móvil del Fundo Corcovado."
      />
      <div className="space-y-6 p-4 sm:p-8">
        {error ? (
          <Card className="border-destructive/50"><CardContent className="p-4 text-sm text-destructive">No fue posible cargar el registro de flota: {error.message}</CardContent></Card>
        ) : (
          <FleetRegistryConsole rows={(data ?? []) as FleetRegistryRow[]} />
        )}
      </div>
    </AppLayout>
  )
}

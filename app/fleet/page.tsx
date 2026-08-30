import { AppLayout } from '@/components/app-layout'
import { FleetPageContent } from '@/components/fleet-page-content'
import type { FleetRegistryRow } from '@/components/fleet-registry-console'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function FleetPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehicle_registry_health')
    .select('id, code, name, vehicle_type, plate_number, vin, serial_number, operational_class, operational_subtype, suggested_operational_class, classification_status, fuel_tracking_enabled, maintenance_tracking_enabled, missing_fields')
    .order('name')

  if (error) console.error('[fleet] registry load failed', error)

  return (
    <AppLayout>
      <FleetPageContent rows={(data ?? []) as FleetRegistryRow[]} hasError={Boolean(error)} />
    </AppLayout>
  )
}

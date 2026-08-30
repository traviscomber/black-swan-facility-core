import { AppLayout } from '@/components/app-layout'
import { LocalizedFuelPageShell } from '@/components/localized-fuel-page-shell'
import { createClient } from '@/lib/supabase/server'

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
    supabase.from('fuel_consumption').select('id, date_recorded, liters, cost_pesos, fuel_type, vehicle_id, submitted_by, is_verified, validation_status, source, location, odometer_reading, vehicle:vehicles(name, code)').order('date_recorded', { ascending: false }).limit(1000),
    supabase.from('verified_fuel_consumption').select('id, date_recorded, liters, cost_pesos, fuel_type, vehicle_id, submitted_by, is_verified, validation_status, source, location, odometer_reading').order('date_recorded', { ascending: false }).limit(1000),
    supabase.from('employees').select('id, name'),
    supabase.from('fuel_consumption_anomalies').select('*').order('detected_at', { ascending: false }).limit(100),
    supabase.from('vehicles').select('id, name, code, vehicle_type, plate_number, status').order('name'),
  ])

  const fuelRecords = (fuelResponse.data ?? []) as FuelRecord[]
  const verifiedFuelRecords = (verifiedFuelResponse.data ?? []) as FuelRecord[]
  const employees = (employeesResponse.data ?? []) as Employee[]
  const employeeMap = new Map(employees.map((employee) => [employee.id, employee.name]))
  const enrichRecords = (records: FuelRecord[]) => records.map((record) => ({ ...record, employee_name: record.submitted_by ? employeeMap.get(record.submitted_by) ?? null : null }))
  const pendingRecords = fuelRecords.filter((record) => (record.validation_status || 'pending') === 'pending')
  const rejectedRecords = fuelRecords.filter((record) => record.validation_status === 'rejected')
  const incompleteRecords = pendingRecords.filter((record) => !record.location || record.odometer_reading == null).length

  return (
    <AppLayout>
      <LocalizedFuelPageShell
        verifiedRecords={enrichRecords(verifiedFuelRecords)}
        pendingRecords={pendingRecords}
        rejectedCount={rejectedRecords.length}
        incompleteCount={incompleteRecords}
        anomalies={anomaliesResponse.data ?? []}
        vehicles={(vehiclesResponse.data ?? []) as Vehicle[]}
        fuelLoadFailed={Boolean(fuelResponse.error)}
        verifiedLoadFailed={Boolean(verifiedFuelResponse.error)}
      />
    </AppLayout>
  )
}

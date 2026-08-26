'use server'

import { createClient } from '@/lib/supabase/server'
import type { FuelRecord } from '@/lib/fuel-parser'
import { detectFuelAnomalies, type FuelReferenceEntity } from '@/lib/fuel-anomaly-detector'

export async function detectAnomaliesAction(records: FuelRecord[]) {
  const supabase = await createClient()

  const [vehiclesResult, employeesResult] = await Promise.all([
    supabase.from('vehicles').select('id, name'),
    supabase.from('employees').select('id, name'),
  ])

  if (vehiclesResult.error) throw vehiclesResult.error
  if (employeesResult.error) throw employeesResult.error

  const vehicles = (vehiclesResult.data ?? []) as FuelReferenceEntity[]
  const employees = (employeesResult.data ?? []) as FuelReferenceEntity[]

  return detectFuelAnomalies(records, vehicles, employees)
}

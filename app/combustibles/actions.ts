'use server'

import { createClient } from '@/lib/supabase/server'
import type { FuelRecord } from '@/lib/fuel-parser'
import { detectFuelAnomalies } from '@/lib/fuel-anomaly-detector'

export async function detectAnomaliesAction(records: FuelRecord[]) {
  const supabase = await createClient()

  // Get valid vehicles and employees
  const { data: vehicles } = await supabase.from('vehicles').select('id, name')
  const { data: employees } = await supabase.from('employees').select('id, name')

  return await detectFuelAnomalies(records, vehicles, employees)
}

import { NextRequest, NextResponse } from 'next/server'
import type { FuelRecord } from '@/lib/fuel-parser'
import { detectFuelAnomalies, type FuelReferenceEntity } from '@/lib/fuel-anomaly-detector'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { records } = (await request.json()) as { records: FuelRecord[] }

    if (!records || records.length === 0) {
      return NextResponse.json({ error: 'No records provided' }, { status: 400 })
    }

    const supabase = await createClient()

    const fuelRecords = records.map((record) => ({
      date_recorded: record.date.toISOString().split('T')[0],
      time_recorded: record.time,
      vehicle_id: null,
      fuel_type: record.fuelType,
      liters: record.liters,
      cost_pesos: record.cost,
      odometer_reading: record.odometer,
      location: record.location,
      notes: record.notes,
      source: 'monthly_upload',
      is_verified: false,
      created_at: new Date().toISOString(),
    }))

    const { data: insertedRecords, error: insertError } = await supabase
      .from('fuel_consumption')
      .insert(fuelRecords)
      .select()

    if (insertError) {
      console.error('[fuel-consumption] Error inserting fuel records:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const [vehiclesResult, employeesResult] = await Promise.all([
      supabase.from('vehicles').select('id, name'),
      supabase.from('employees').select('id, name'),
    ])

    if (vehiclesResult.error) {
      console.error('[fuel-consumption] Unable to load vehicle catalog:', vehiclesResult.error)
    }
    if (employeesResult.error) {
      console.error('[fuel-consumption] Unable to load employee catalog:', employeesResult.error)
    }

    const vehicles = vehiclesResult.error ? undefined : (vehiclesResult.data ?? []) as FuelReferenceEntity[]
    const employees = employeesResult.error ? undefined : (employeesResult.data ?? []) as FuelReferenceEntity[]
    const anomalies = await detectFuelAnomalies(records, vehicles, employees)

    if (anomalies.length > 0) {
      const anomalyRecords = anomalies.map((anomaly) => ({
        fuel_consumption_id: insertedRecords?.[0]?.id || null,
        anomaly_type: anomaly.anomalyType,
        severity: anomaly.severity,
        description: anomaly.description,
        notes: anomaly.notes,
        detected_at: new Date().toISOString(),
        confirmed: false,
      }))

      const { error: anomalyError } = await supabase
        .from('fuel_consumption_anomalies')
        .insert(anomalyRecords)

      if (anomalyError) {
        console.error('[fuel-consumption] Error inserting anomalies:', anomalyError)
      }
    }

    return NextResponse.json({
      success: true,
      recordsInserted: insertedRecords?.length || 0,
      anomaliesDetected: anomalies.length,
    })
  } catch (error) {
    console.error('[fuel-consumption] API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

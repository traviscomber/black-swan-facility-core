import type { FuelRecord } from './fuel-parser'

export interface FuelAnomaly {
  fuelConsumptionId?: string
  anomalyType: 'unusual_consumption' | 'duplicate' | 'invalid_vehicle' | 'invalid_person' | 'non_operational_hour' | 'suspicious_pattern'
  severity: 'low' | 'medium' | 'high'
  description: string
  notes?: string
}

// Server-only function for detecting anomalies (used by Route Handlers and Server Actions)
export async function detectFuelAnomalies(records: FuelRecord[], vehicles?: any[], employees?: any[]): Promise<FuelAnomaly[]> {
  const anomalies: FuelAnomaly[] = []

  const vehicleNames = new Set(vehicles?.map(v => v.name) || [])
  const employeeNames = new Set(employees?.map(e => e.name) || [])

  // Calculate statistics for unusual consumption detection
  const consumptionByVehicle = new Map<string, number[]>()
  records.forEach(record => {
    if (!consumptionByVehicle.has(record.vehicle)) {
      consumptionByVehicle.set(record.vehicle, [])
    }
    consumptionByVehicle.get(record.vehicle)!.push(record.liters)
  })

  records.forEach((record, index) => {
    // Check 1: Invalid vehicle
    if (vehicles && !vehicleNames.has(record.vehicle)) {
      anomalies.push({
        anomalyType: 'invalid_vehicle',
        severity: 'high',
        description: `Vehículo "${record.vehicle}" no existe en el sistema`,
        notes: `Fecha: ${record.date.toISOString().split('T')[0]}`,
      })
    }

    // Check 2: Invalid person
    if (employees && !employeeNames.has(record.person)) {
      anomalies.push({
        anomalyType: 'invalid_person',
        severity: 'high',
        description: `Persona "${record.person}" no existe en el sistema`,
        notes: `Fecha: ${record.date.toISOString().split('T')[0]}`,
      })
    }

    // Check 3: Unusual consumption (more than 30% above average)
    const vehicleConsumptions = consumptionByVehicle.get(record.vehicle) || []
    if (vehicleConsumptions.length > 1) {
      const avg = vehicleConsumptions.reduce((a, b) => a + b, 0) / vehicleConsumptions.length
      const threshold = avg * 1.3

      if (record.liters > threshold) {
        anomalies.push({
          anomalyType: 'unusual_consumption',
          severity: 'medium',
          description: `Consumo inusual: ${record.liters}L (promedio: ${avg.toFixed(2)}L)`,
          notes: `Vehículo: ${record.vehicle}, Persona: ${record.person}`,
        })
      }
    }

    // Check 4: Suspicious pattern - very low liters
    if (record.liters < 1) {
      anomalies.push({
        anomalyType: 'suspicious_pattern',
        severity: 'low',
        description: `Consumo muy bajo: ${record.liters}L`,
        notes: `Posible error de digitación`,
      })
    }

    // Check 5: Non-operational hours (if time is provided)
    if (record.time) {
      const hour = parseInt(record.time.split(':')[0])
      if (hour >= 22 || hour < 5) {
        anomalies.push({
          anomalyType: 'non_operational_hour',
          severity: 'low',
          description: `Carga de combustible a hora inusual: ${record.time}`,
          notes: `Hora: ${hour}:00`,
        })
      }
    }

    // Check 6: Duplicate records
    if (index > 0) {
      const prev = records[index - 1]
      if (
        prev.date.getTime() === record.date.getTime() &&
        prev.vehicle === record.vehicle &&
        prev.person === record.person &&
        prev.liters === record.liters &&
        prev.fuelType === record.fuelType
      ) {
        anomalies.push({
          anomalyType: 'duplicate',
          severity: 'high',
          description: `Posible registro duplicado`,
          notes: `Mismo vehículo, persona, cantidad y tipo en la misma fecha`,
        })
      }
    }

    // Check 7: Excessive cost per liter
    const costPerLiter = record.cost / record.liters
    const avgCostPerLiter = records
      .filter(r => r.fuelType === record.fuelType)
      .reduce((sum, r) => sum + r.cost / r.liters, 0) / records.filter(r => r.fuelType === record.fuelType).length

    if (costPerLiter > avgCostPerLiter * 1.2) {
      anomalies.push({
        anomalyType: 'suspicious_pattern',
        severity: 'medium',
        description: `Precio por litro sospechoso: $${costPerLiter.toFixed(0)}/L`,
        notes: `Promedio para ${record.fuelType}: $${avgCostPerLiter.toFixed(0)}/L`,
      })
    }
  })

  return anomalies
}

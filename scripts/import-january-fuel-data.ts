import * as fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

interface FuelRecord {
  date: string
  person: string
  vehicle: string
  fuel_type: 'Bencina' | 'Petróleo'
  liters: number
}

// Parsear el reporte de combustible
const fuelData: FuelRecord[] = [
  // 2026-01-04
  { date: '2026-01-04', person: 'Luis Miranda', vehicle: 'Corcovado', fuel_type: 'Bencina', liters: 50 },
  { date: '2026-01-04', person: 'Luis Miranda', vehicle: 'Lanchón', fuel_type: 'Bencina', liters: 30 },
  { date: '2026-01-04', person: 'Luis Miranda', vehicle: 'Lancha aluminio', fuel_type: 'Bencina', liters: 15 },
  
  // 2026-01-05
  { date: '2026-01-05', person: 'Manfred Corcovado', vehicle: 'Buggy 2', fuel_type: 'Bencina', liters: 30 },
  { date: '2026-01-05', person: '.hector', vehicle: 'Motobomba viñas', fuel_type: 'Bencina', liters: 5 },
  { date: '2026-01-05', person: '.hector', vehicle: 'Desbrozadora', fuel_type: 'Bencina', liters: 5 },
  { date: '2026-01-05', person: 'Luis Miranda', vehicle: 'Corcovado', fuel_type: 'Bencina', liters: 30 },
  { date: '2026-01-05', person: 'Luis Miranda', vehicle: 'Lanchón', fuel_type: 'Bencina', liters: 30 },
  { date: '2026-01-05', person: 'Luis Miranda', vehicle: 'Lancha aluminio', fuel_type: 'Bencina', liters: 10 },
  
  // 2026-01-06
  { date: '2026-01-06', person: 'Manfred Corcovado', vehicle: 'Lanchón', fuel_type: 'Bencina', liters: 25 },
  { date: '2026-01-06', person: 'Manfred Corcovado', vehicle: 'Bote aluminio', fuel_type: 'Bencina', liters: 15 },
  { date: '2026-01-06', person: 'Andres', vehicle: 'Tractor Massey Ferguson', fuel_type: 'Petróleo', liters: 114 },
  { date: '2026-01-06', person: 'Andres', vehicle: 'Tractor New Holland', fuel_type: 'Petróleo', liters: 62 },
  
  // 2026-01-07
  { date: '2026-01-07', person: 'Titan', vehicle: 'Retro', fuel_type: 'Petróleo', liters: 50 },
  { date: '2026-01-07', person: 'Luis Miranda', vehicle: 'Corcovado', fuel_type: 'Bencina', liters: 60 },
  { date: '2026-01-07', person: 'Luis Miranda', vehicle: 'Lancha aluminio', fuel_type: 'Bencina', liters: 15 },
  
  // 2026-01-08
  { date: '2026-01-08', person: '.hector', vehicle: 'Cuatrimoto roja', fuel_type: 'Bencina', liters: 5 },
  { date: '2026-01-08', person: '.hector', vehicle: 'Motobomba viñas', fuel_type: 'Bencina', liters: 5 },
  { date: '2026-01-08', person: 'Titan', vehicle: 'Lanchón', fuel_type: 'Bencina', liters: 25 },
  { date: '2026-01-08', person: 'Titan', vehicle: 'Bote aluminio', fuel_type: 'Bencina', liters: 12 },
  { date: '2026-01-08', person: 'Ruben', vehicle: 'Chipiadora', fuel_type: 'Bencina', liters: 5 },
  { date: '2026-01-08', person: 'Andres', vehicle: 'Tractor New Holland', fuel_type: 'Petróleo', liters: 100 },
  { date: '2026-01-08', person: 'Andres', vehicle: 'Tractor Massey Ferguson', fuel_type: 'Petróleo', liters: 50 },
  { date: '2026-01-08', person: 'Andres', vehicle: 'Maxus', fuel_type: 'Petróleo', liters: 50 },
  
  // 2026-01-09
  { date: '2026-01-09', person: 'Titan', vehicle: 'Bote aluminio', fuel_type: 'Bencina', liters: 12 },
  { date: '2026-01-09', person: 'Andres', vehicle: 'Retro constructora', fuel_type: 'Petróleo', liters: 132.42 },
  
  // 2026-01-10
  { date: '2026-01-10', person: 'Andres', vehicle: 'Buggy', fuel_type: 'Bencina', liters: 20 },
  { date: '2026-01-10', person: 'Andres', vehicle: 'Generador hotelito', fuel_type: 'Bencina', liters: 5 },
  { date: '2026-01-10', person: 'Titan', vehicle: 'Lanchón', fuel_type: 'Bencina', liters: 25 },
  { date: '2026-01-10', person: 'Luis Miranda', vehicle: 'Fomo 1', fuel_type: 'Bencina', liters: 15 },
  
  // 2026-01-12
  { date: '2026-01-12', person: '.hector', vehicle: 'Motobomba viñas', fuel_type: 'Bencina', liters: 5 },
  { date: '2026-01-12', person: 'Manfred Corcovado', vehicle: 'Nissan Navara', fuel_type: 'Petróleo', liters: 60 },
  { date: '2026-01-12', person: 'Titan', vehicle: 'Lanchón', fuel_type: 'Bencina', liters: 25 },
  { date: '2026-01-12', person: 'Titan', vehicle: 'Bote aluminio', fuel_type: 'Bencina', liters: 12 },
  
  // 2026-01-13
  { date: '2026-01-13', person: 'Andres', vehicle: 'Camioneta Wingle', fuel_type: 'Bencina', liters: 50 },
  { date: '2026-01-13', person: '+56 9 5195 2304', vehicle: 'Moto 1', fuel_type: 'Bencina', liters: 7 },
  { date: '2026-01-13', person: '+56 9 5195 2304', vehicle: 'Moto 2', fuel_type: 'Bencina', liters: 7 },
  { date: '2026-01-13', person: '.hector', vehicle: 'Motobomba viñas', fuel_type: 'Bencina', liters: 5 },
  { date: '2026-01-13', person: '.hector', vehicle: 'Cuatrimoto roja', fuel_type: 'Bencina', liters: 5 },
  
  // 2026-01-14
  { date: '2026-01-14', person: '+56 9 5195 2304', vehicle: 'Buggy', fuel_type: 'Bencina', liters: 25 },
  { date: '2026-01-14', person: 'Luis Miranda', vehicle: 'Corcovado', fuel_type: 'Bencina', liters: 40 },
  
  // 2026-01-15
  { date: '2026-01-15', person: 'Luis Miranda', vehicle: 'Corcovado', fuel_type: 'Bencina', liters: 20 },
  { date: '2026-01-15', person: 'Titan', vehicle: 'Lanchón', fuel_type: 'Bencina', liters: 25 },
  
  // 2026-01-16
  { date: '2026-01-16', person: '.hector', vehicle: 'Motobomba viñas', fuel_type: 'Bencina', liters: 5 },
  { date: '2026-01-16', person: 'Luis Miranda', vehicle: 'Corcovado', fuel_type: 'Bencina', liters: 50 },
  { date: '2026-01-16', person: 'Luis Miranda', vehicle: 'Lanchón', fuel_type: 'Bencina', liters: 15 },
  { date: '2026-01-16', person: 'Ruben', vehicle: 'Corcovado', fuel_type: 'Bencina', liters: 40 },
  
  // 2026-01-17
  { date: '2026-01-17', person: 'Titan', vehicle: 'Maxus', fuel_type: 'Petróleo', liters: 65 },
  { date: '2026-01-17', person: 'Manfred Corcovado', vehicle: 'Nissan Navara', fuel_type: 'Petróleo', liters: 50 },
  { date: '2026-01-17', person: 'Luis Miranda', vehicle: 'Corcovado', fuel_type: 'Bencina', liters: 40 },
  { date: '2026-01-17', person: 'Luis Miranda', vehicle: 'Lanchón', fuel_type: 'Bencina', liters: 10 },
  
  // 2026-01-19
  { date: '2026-01-19', person: 'Titan', vehicle: 'Barcaza Libe', fuel_type: 'Petróleo', liters: 160 },
  { date: '2026-01-19', person: '.hector', vehicle: 'Cuatrimoto', fuel_type: 'Bencina', liters: 5 },
  { date: '2026-01-19', person: '.hector', vehicle: 'Motobomba viñas', fuel_type: 'Bencina', liters: 5 },
  { date: '2026-01-19', person: 'Luis Miranda', vehicle: 'Corcovado', fuel_type: 'Bencina', liters: 50 },
  { date: '2026-01-19', person: 'Luis Miranda', vehicle: 'Lanchón', fuel_type: 'Bencina', liters: 25 },
  { date: '2026-01-19', person: 'Manfred Corcovado', vehicle: 'Lanchón', fuel_type: 'Bencina', liters: 25 },
  
  // 2026-01-21
  { date: '2026-01-21', person: 'Manfred Corcovado', vehicle: 'Buggy', fuel_type: 'Bencina', liters: 20 },
  { date: '2026-01-21', person: '.hector', vehicle: 'Motobomba viñas', fuel_type: 'Bencina', liters: 5 },
  { date: '2026-01-21', person: '.hector', vehicle: 'Cuatrimoto roja', fuel_type: 'Bencina', liters: 5 },
  { date: '2026-01-21', person: '+56 9 5195 2304', vehicle: 'Tractor azul', fuel_type: 'Petróleo', liters: 169 },
  { date: '2026-01-21', person: 'Ruben', vehicle: 'Chipiadora', fuel_type: 'Bencina', liters: 10 },
  
  // 2026-01-22
  { date: '2026-01-22', person: '+56 9 5195 2304', vehicle: 'Tractor azul', fuel_type: 'Petróleo', liters: 124 },
  { date: '2026-01-22', person: 'Ruben', vehicle: 'Desbrozadora jardín', fuel_type: 'Bencina', liters: 5 },
  
  // 2026-01-23
  { date: '2026-01-23', person: 'Andres', vehicle: 'Generador', fuel_type: 'Petróleo', liters: 150 },
  { date: '2026-01-23', person: 'Andres', vehicle: 'Maxus', fuel_type: 'Petróleo', liters: 40 },
  
  // 2026-01-24
  { date: '2026-01-24', person: 'Andres', vehicle: 'Buggy', fuel_type: 'Bencina', liters: 20 },
  { date: '2026-01-24', person: '.hector', vehicle: 'Motobomba viñas', fuel_type: 'Bencina', liters: 5 },
  { date: '2026-01-24', person: '.hector', vehicle: 'Cuatrimoto roja', fuel_type: 'Bencina', liters: 5 },
  { date: '2026-01-24', person: 'Luis Miranda', vehicle: 'Corcovado', fuel_type: 'Bencina', liters: 50 },
  { date: '2026-01-24', person: 'Luis Miranda', vehicle: 'Lanchón', fuel_type: 'Bencina', liters: 10 },
  
  // 2026-01-25
  { date: '2026-01-25', person: 'Andres', vehicle: 'Generador Honda', fuel_type: 'Bencina', liters: 20 },
  
  // 2026-01-26
  { date: '2026-01-26', person: 'Titan', vehicle: 'Tractor azul', fuel_type: 'Petróleo', liters: 44 },
  { date: '2026-01-26', person: 'Andres', vehicle: 'Retro constructora Madlan', fuel_type: 'Petróleo', liters: 120 },
  { date: '2026-01-26', person: '+56 9 5195 2304', vehicle: 'Tractor azul', fuel_type: 'Petróleo', liters: 66 },
  
  // 2026-01-27
  { date: '2026-01-27', person: '.hector', vehicle: 'Cuatrimoto roja', fuel_type: 'Bencina', liters: 5 },
  { date: '2026-01-27', person: '.hector', vehicle: 'Motobomba viñas', fuel_type: 'Bencina', liters: 5 },
  { date: '2026-01-27', person: 'Andres', vehicle: 'Buggy azul', fuel_type: 'Bencina', liters: 25 },
  
  // 2026-01-28
  { date: '2026-01-28', person: 'Luis Miranda', vehicle: 'Corcovado', fuel_type: 'Bencina', liters: 50 },
  { date: '2026-01-28', person: 'Luis Miranda', vehicle: 'Lanchón', fuel_type: 'Bencina', liters: 30 },
  
  // 2026-01-30
  { date: '2026-01-30', person: 'Andres', vehicle: 'Generador', fuel_type: 'Petróleo', liters: 60 },
  { date: '2026-01-30', person: 'Raimundo Colvin', vehicle: 'Generador', fuel_type: 'Petróleo', liters: 60 },
  { date: '2026-01-30', person: 'Manfred Corcovado', vehicle: 'Nissan Navara', fuel_type: 'Petróleo', liters: 60 },
  { date: '2026-01-30', person: 'Luis Miranda', vehicle: 'Lanchón', fuel_type: 'Bencina', liters: 15 },
  
  // 2026-01-31
  { date: '2026-01-31', person: 'Andres', vehicle: 'Generador', fuel_type: 'Petróleo', liters: 50 },
]

async function importFuelData() {
  console.log('[v0] Starting fuel data import for January 2026...')
  
  try {
    // Obtener IDs de employees y vehicles
    const { data: employees } = await supabase.from('employees').select('id, name')
    const { data: vehicles } = await supabase.from('vehicles').select('id, name')
    
    console.log(`[v0] Found ${employees?.length || 0} employees and ${vehicles?.length || 0} vehicles`)
    
    // Mapear nombres a IDs
    const employeeMap = new Map()
    const vehicleMap = new Map()
    
    if (employees) {
      employees.forEach(emp => {
        employeeMap.set(emp.name.toLowerCase(), emp.id)
      })
    }
    
    if (vehicles) {
      vehicles.forEach(veh => {
        vehicleMap.set(veh.name.toLowerCase(), veh.id)
      })
    }
    
    // Preparar registros para insertar
    const recordsToInsert = fuelData.map(record => {
      const employeeId = employeeMap.get(record.person.toLowerCase())
      const vehicleId = vehicleMap.get(record.vehicle.toLowerCase())
      
      if (!employeeId || !vehicleId) {
        console.warn(`[v0] Missing mapping: ${record.person} / ${record.vehicle}`)
      }
      
      return {
        date: record.date,
        employee_id: employeeId,
        vehicle_id: vehicleId,
        fuel_type: record.fuel_type,
        liters: record.liters,
        cost_pesos: 0, // Calcular después si necesario
      }
    }).filter(r => r.employee_id && r.vehicle_id)
    
    console.log(`[v0] Inserting ${recordsToInsert.length} fuel consumption records`)
    
    // Insertar en chunks de 100 para evitar problemas
    for (let i = 0; i < recordsToInsert.length; i += 100) {
      const chunk = recordsToInsert.slice(i, i + 100)
      const { error } = await supabase.from('fuel_consumption').insert(chunk)
      
      if (error) {
        console.error(`[v0] Error inserting chunk ${i / 100 + 1}:`, error)
      } else {
        console.log(`[v0] Inserted chunk ${i / 100 + 1} (${chunk.length} records)`)
      }
    }
    
    console.log('[v0] Fuel data import completed!')
  } catch (error) {
    console.error('[v0] Import error:', error)
  }
}

importFuelData()

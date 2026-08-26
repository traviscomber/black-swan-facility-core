'use client'

import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export interface FuelRecord {
  date: Date
  time: string
  vehicle: string
  person: string
  liters: number
  fuelType: 'Bencina' | 'Petróleo' | 'Gasolina'
  cost: number
  odometer?: number
  location?: string
  notes?: string
}

export async function parseFuelFile(file: File): Promise<FuelRecord[]> {
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith('.csv')) return parseFuelCSV(file)
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) return parseFuelExcel(file)
  throw new Error('Formato de archivo no soportado. Use CSV o Excel.')
}

async function parseFuelCSV(file: File): Promise<FuelRecord[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<unknown>(file, {
      complete: (results) => {
        try {
          resolve(processFuelData(results.data))
        } catch (error) {
          reject(error)
        }
      },
      error: (error) => reject(new Error(`Error parsing CSV: ${error.message}`)),
    })
  })
}

async function parseFuelExcel(file: File): Promise<FuelRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const data = event.target?.result
        if (!(data instanceof ArrayBuffer)) throw new Error('Excel file could not be read as binary data')
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) throw new Error('Excel workbook has no sheets')
        const sheet = workbook.Sheets[sheetName]
        if (!sheet) throw new Error('Excel sheet is unavailable')
        resolve(processFuelData(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })))
      } catch (error) {
        reject(new Error(`Error parsing Excel: ${error instanceof Error ? error.message : 'Unknown error'}`))
      }
    }

    reader.onerror = () => reject(new Error('Error reading file'))
    reader.readAsArrayBuffer(file)
  })
}

function processFuelData(rawData: unknown[]): FuelRecord[] {
  const records: FuelRecord[] = []

  for (let index = 1; index < rawData.length; index += 1) {
    const row = rawData[index]
    if (!Array.isArray(row) || row.length < 6) continue

    try {
      const dateStr = String(row[0] ?? '').trim()
      const timeStr = String(row[1] ?? '').trim()
      const vehicle = String(row[2] ?? '').trim()
      const person = String(row[3] ?? '').trim()
      const litersStr = String(row[4] ?? '').trim()
      const fuelTypeStr = String(row[5] ?? '').trim().toUpperCase()
      const costStr = String(row[6] ?? '').trim()
      const odometerStr = row[7] == null || row[7] === '' ? undefined : String(row[7]).trim()
      const location = row[8] == null || row[8] === '' ? undefined : String(row[8]).trim()
      const notes = row[9] == null || row[9] === '' ? undefined : String(row[9]).trim()

      if (!dateStr || !vehicle || !person || !litersStr || !fuelTypeStr) continue

      const date = parseDate(dateStr)
      if (!date) continue

      const liters = Number.parseFloat(litersStr.replace(/,/g, '.'))
      const cost = Number.parseFloat(costStr.replace(/,/g, '.'))
      const odometer = odometerStr ? Number.parseFloat(odometerStr.replace(/,/g, '.')) : undefined
      if (!Number.isFinite(liters) || !Number.isFinite(cost)) continue

      const fuelType = validateFuelType(fuelTypeStr)
      if (!fuelType) continue

      records.push({
        date,
        time: timeStr,
        vehicle,
        person,
        liters,
        fuelType,
        cost,
        odometer: odometer !== undefined && Number.isFinite(odometer) ? odometer : undefined,
        location,
        notes,
      })
    } catch (error) {
      console.warn(`[fuel-parser] Skipping row ${index} due to error`, error)
    }
  }

  return records
}

function parseDate(dateStr: string): Date | null {
  const slash = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const iso = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const dash = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)

  let day: number
  let month: number
  let year: number

  if (slash) {
    day = Number.parseInt(slash[1], 10)
    month = Number.parseInt(slash[2], 10)
    year = Number.parseInt(slash[3], 10)
  } else if (iso) {
    year = Number.parseInt(iso[1], 10)
    month = Number.parseInt(iso[2], 10)
    day = Number.parseInt(iso[3], 10)
  } else if (dash) {
    day = Number.parseInt(dash[1], 10)
    month = Number.parseInt(dash[2], 10)
    year = Number.parseInt(dash[3], 10)
  } else return null

  const date = new Date(year, month - 1, day)
  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) return null
  return date
}

function validateFuelType(fuelType: string): FuelRecord['fuelType'] | null {
  const normalized = fuelType.toUpperCase()
  if (normalized.includes('BENCINA') || normalized.includes('GASOLINE')) return 'Bencina'
  if (normalized.includes('PETRÓLEO') || normalized.includes('DIESEL') || normalized.includes('PETROLEO')) return 'Petróleo'
  if (normalized.includes('GASOLINA')) return 'Gasolina'
  return null
}

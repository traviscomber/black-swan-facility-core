'use client'

import { useState } from 'react'
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
  
  if (fileName.endsWith('.csv')) {
    return parseFuelCSV(file)
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseFuelExcel(file)
  } else {
    throw new Error('Formato de archivo no soportado. Use CSV o Excel.')
  }
}

async function parseFuelCSV(file: File): Promise<FuelRecord[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        try {
          const records = processFuelData(results.data as any[])
          resolve(records)
        } catch (error) {
          reject(error)
        }
      },
      error: (error) => {
        reject(new Error(`Error parsing CSV: ${error.message}`))
      },
    })
  })
}

async function parseFuelExcel(file: File): Promise<FuelRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (event) => {
      try {
        const data = event.target?.result as ArrayBuffer
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        
        const records = processFuelData(jsonData as any[])
        resolve(records)
      } catch (error) {
        reject(new Error(`Error parsing Excel: ${error instanceof Error ? error.message : 'Unknown error'}`))
      }
    }
    
    reader.onerror = () => reject(new Error('Error reading file'))
    reader.readAsArrayBuffer(file)
  })
}

function processFuelData(rawData: any[]): FuelRecord[] {
  const records: FuelRecord[] = []
  
  // Skip header row (first row)
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i]
    
    if (!row || row.length < 6) continue
    
    try {
      const dateStr = String(row[0] || '').trim()
      const timeStr = String(row[1] || '').trim()
      const vehicle = String(row[2] || '').trim()
      const person = String(row[3] || '').trim()
      const litersStr = String(row[4] || '').trim()
      const fuelTypeStr = String(row[5] || '').trim().toUpperCase()
      const costStr = String(row[6] || '').trim()
      const odometerStr = row[7] ? String(row[7]).trim() : undefined
      const location = row[8] ? String(row[8]).trim() : undefined
      const notes = row[9] ? String(row[9]).trim() : undefined
      
      // Validate required fields
      if (!dateStr || !vehicle || !person || !litersStr || !fuelTypeStr) continue
      
      // Parse date
      const date = parseDate(dateStr)
      if (!date) continue
      
      // Parse numbers
      const liters = parseFloat(litersStr.replace(/,/g, '.'))
      const cost = parseFloat(costStr.replace(/,/g, '.'))
      const odometer = odometerStr ? parseFloat(odometerStr) : undefined
      
      if (isNaN(liters) || isNaN(cost)) continue
      
      // Validate fuel type
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
        odometer,
        location,
        notes,
      })
    } catch (error) {
      console.log(`[v0] Skipping row ${i} due to error:`, error)
      continue
    }
  }
  
  return records
}

function parseDate(dateStr: string): Date | null {
  // Try multiple date formats
  const formats = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // DD/MM/YYYY
    /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
    /(\d{1,2})-(\d{1,2})-(\d{4})/, // DD-MM-YYYY
  ]
  
  for (const format of formats) {
    const match = dateStr.match(format)
    if (match) {
      let day, month, year
      
      if (format === formats[0]) {
        // DD/MM/YYYY
        day = parseInt(match[1])
        month = parseInt(match[2])
        year = parseInt(match[3])
      } else if (format === formats[1]) {
        // YYYY-MM-DD
        year = parseInt(match[1])
        month = parseInt(match[2])
        day = parseInt(match[3])
      } else {
        // DD-MM-YYYY
        day = parseInt(match[1])
        month = parseInt(match[2])
        year = parseInt(match[3])
      }
      
      const date = new Date(year, month - 1, day)
      if (!isNaN(date.getTime())) {
        return date
      }
    }
  }
  
  return null
}

function validateFuelType(fuelType: string): 'Bencina' | 'Petróleo' | 'Gasolina' | null {
  const normalized = fuelType.toUpperCase()
  
  if (normalized.includes('BENCINA') || normalized.includes('GASOLINE')) return 'Bencina'
  if (normalized.includes('PETRÓLEO') || normalized.includes('DIESEL') || normalized.includes('PETROLEO')) return 'Petróleo'
  if (normalized.includes('GASOLINA')) return 'Gasolina'
  
  return null
}

import * as XLSX from 'xlsx'

export interface BusinessPlanData {
  regime: string
  year: number
  month: string
  inventory_count: number
  purchase_amount: number
  sales_amount: number
  operational_cost: number
  profit_loss: number
  business_unit: string
}

export async function parseBusinessPlanExcel(file: File): Promise<BusinessPlanData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const data = event.target?.result as ArrayBuffer
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 })

        console.log('[v0] Parsing business plan Excel:', jsonData.length, 'rows')

        // Parse usando la estructura completa del documento
        const businessPlanData = parseCompleteStructure(jsonData as any[])

        console.log('[v0] Parsed business plan data:', businessPlanData.length)
        resolve(businessPlanData)
      } catch (error) {
        console.error('[v0] Error parsing Excel:', error)
        reject(new Error('Error parsing Excel file'))
      }
    }

    reader.onerror = () => {
      reject(new Error('Error reading file'))
    }

    reader.readAsArrayBuffer(file)
  })
}

function parseCompleteStructure(rows: any[]): BusinessPlanData[] {
  const results: BusinessPlanData[] = []

  // 1. Encontrar la fila de encabezados (contiene 2024, AÑO X - MES, etc)
  let headerRowIndex = -1
  let periodHeaders: string[] = []

  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i] as any[]
    if (!row || row.length < 3) continue

    const cellsText = row.slice(1, 10).map(c => String(c || '')).join(' ').toUpperCase()

    if (cellsText.includes('2024') || cellsText.includes('AÑO') || cellsText.includes('MAR')) {
      headerRowIndex = i
      periodHeaders = row.slice(1).map(c => String(c || '').trim()).filter(c => c.length > 0)
      console.log('[v0] Found header row at', i, 'with', periodHeaders.length, 'periods')
      break
    }
  }

  if (headerRowIndex === -1) {
    console.error('[v0] Could not find header row')
    return results
  }

  // 2. Parsear los períodos de los encabezados
  const periods = parsePeriods(periodHeaders)
  console.log('[v0] Parsed periods:', periods.length, periods.slice(0, 5))

  // 3. Buscar y extraer datos por régimen
  let currentRegime = ''
  const regimeRecords: Map<string, Map<string, Partial<BusinessPlanData>>> = new Map()

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] as any[]
    if (!row || row.length === 0) continue

    const firstCell = String(row[0] || '').trim()
    const firstCellUpper = firstCell.toUpperCase()

    // Detectar cambio de régimen
    if (firstCellUpper.includes('RÉGIMEN') || firstCellUpper.includes('REGIMEN')) {
      currentRegime = firstCell
      if (!regimeRecords.has(currentRegime)) {
        regimeRecords.set(currentRegime, new Map())
      }
      console.log('[v0] Found regime:', currentRegime)
      continue
    }

    if (!currentRegime) continue

    // Identificar qué tipo de fila es (COMPRA, VENTA, COSTO, GANANCIA)
    let dataType: 'purchase' | 'sales' | 'cost' | 'profit' | null = null

    if (firstCellUpper.includes('COMPRA') || firstCellUpper.includes('MONTO DE COMPRA')) {
      dataType = 'purchase'
    } else if (firstCellUpper.includes('VENTA') || firstCellUpper.includes('ENGORDA')) {
      dataType = 'sales'
    } else if (firstCellUpper.includes('COSTO') || firstCellUpper.includes('OPERACIONAL')) {
      dataType = 'cost'
    } else if (firstCellUpper.includes('GANANCIA') || firstCellUpper.includes('PÉRDIDA')) {
      dataType = 'profit'
    }

    if (!dataType) continue

    // Extraer valores de cada período
    const values = row.slice(1)
    const regimeMap = regimeRecords.get(currentRegime)!

    for (let periodIdx = 0; periodIdx < Math.min(values.length, periods.length); periodIdx++) {
      const value = values[periodIdx]
      if (value == null || value === '') continue

      // Limpiar valor
      const cleanValue = cleanNumberValue(value)
      if (isNaN(cleanValue)) continue

      const period = periods[periodIdx]
      if (!period) continue

      const key = `${period.year}-${period.month}`

      if (!regimeMap.has(key)) {
        regimeMap.set(key, {
          regime: currentRegime,
          year: period.year,
          month: period.month,
          inventory_count: 0,
          purchase_amount: 0,
          sales_amount: 0,
          operational_cost: 0,
          profit_loss: 0,
          business_unit: currentRegime,
        })
      }

      const record = regimeMap.get(key)!
      if (dataType === 'purchase') record.purchase_amount = cleanValue
      else if (dataType === 'sales') record.sales_amount = cleanValue
      else if (dataType === 'cost') record.operational_cost = cleanValue
      else if (dataType === 'profit') record.profit_loss = cleanValue
    }
  }

  // 4. Convertir map a array
  for (const [regime, periodMap] of regimeRecords) {
    for (const [key, data] of periodMap) {
      if (data.year !== undefined && data.month) {
        results.push(data as BusinessPlanData)
      }
    }
  }

  console.log('[v0] Total records created:', results.length)
  return results.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month.localeCompare(b.month)
  })
}

function parsePeriods(headers: string[]): Array<{ year: number; month: string }> {
  const periods: Array<{ year: number; month: string }> = []

  for (const header of headers) {
    const h = String(header).trim().toUpperCase()

    // Caso: "2024"
    if (h === '2024') {
      periods.push({ year: 2024, month: 'MAR' })
      continue
    }

    // Caso: "AÑO 1 - MAR", "AÑO 1 - DIC", etc
    const match = h.match(/AÑO\s+(\d+)\s*[-:\s]*([A-Z]{3})/i)
    if (match) {
      const yearOffset = parseInt(match[1])
      const month = match[2].toUpperCase()
      const year = 2024 + (yearOffset - 1)
      periods.push({ year, month })
      continue
    }

    // Si tiene formato "ANO1-MAR" sin espacios
    const match2 = h.match(/A[ÑN]O\s*(\d+)\s*-\s*([A-Z]{3})/i)
    if (match2) {
      const yearOffset = parseInt(match2[1])
      const month = match2[2].toUpperCase()
      const year = 2024 + (yearOffset - 1)
      periods.push({ year, month })
    }
  }

  return periods
}

function cleanNumberValue(value: any): number {
  if (typeof value === 'number') return value

  if (value === null || value === undefined || value === '') return NaN

  const str = String(value).trim()

  // Remover símbolos de moneda
  let cleaned = str.replace(/[$\s]/g, '')

  // Manejar formato con miles: "150.000.000" o "150,000,000"
  // Si tiene múltiples puntos o comas, asumir que es separador de miles
  const dotCount = (cleaned.match(/\./g) || []).length
  const commaCount = (cleaned.match(/,/g) || []).length

  if (dotCount > 1) {
    // Múltiples puntos: "150.000.000" → remover todos y es el número
    cleaned = cleaned.replace(/\./g, '')
  } else if (dotCount === 1 && commaCount === 0) {
    // Un punto solo: puede ser decimal
    // Si hay dígitos después del punto
    const parts = cleaned.split('.')
    if (parts[1] && parts[1].length !== 2) {
      // Probablemente miles separator
      cleaned = cleaned.replace('.', '')
    }
  } else if (commaCount > 0) {
    // Comas presentes: "150,000,000" or "150,50"
    const parts = cleaned.split(',')
    if (parts[parts.length - 1].length === 2) {
      // Última parte tiene 2 dígitos: es decimal
      cleaned = cleaned.replace(/,(?=\d{2}$)/, '.')
      cleaned = cleaned.replace(/,/g, '')
    } else {
      // Es miles separator
      cleaned = cleaned.replace(/,/g, '')
    }
  }

  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}

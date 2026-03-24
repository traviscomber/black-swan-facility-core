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

        const businessPlanData: BusinessPlanData[] = []
        let currentRegime = ''

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i] as any[]
          if (!row || row.length === 0) continue

          const firstCell = String(row[0] || '').trim().toUpperCase()

          // Detectar regímenes
          if (firstCell.includes('RÉGIMEN') || firstCell.includes('REGIMEN')) {
            currentRegime = String(row[0] || '')
            console.log('[v0] Found regime:', currentRegime)
            continue
          }

          // Detectar filas de datos según keywords
          if (!currentRegime) continue

          const isCompraRow = firstCell.includes('COMPRA') || firstCell.includes('MONTO')
          const isVentaRow = firstCell.includes('VENTA')
          const isCostoRow = firstCell.includes('COSTO')
          const isGananciaRow = firstCell.includes('GANANCIA') || firstCell.includes('PÉRDIDA')

          if (isCompraRow) {
            extractDataFromRow(row, currentRegime, 'purchase', businessPlanData)
          } else if (isVentaRow) {
            extractDataFromRow(row, currentRegime, 'sales', businessPlanData)
          } else if (isCostoRow) {
            extractDataFromRow(row, currentRegime, 'operational_cost', businessPlanData)
          } else if (isGananciaRow) {
            extractDataFromRow(row, currentRegime, 'profit_loss', businessPlanData)
          }
        }

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

function extractDataFromRow(
  row: any[],
  regime: string,
  dataType: string,
  resultArray: BusinessPlanData[]
) {
  // Buscar columnas que contengan año y mes
  // Estructura: [label, 2024, AÑO 1 - MAR, AÑO 1 - DIC, ...]

  for (let colIndex = 1; colIndex < row.length; colIndex++) {
    const headerValue = String(row[colIndex] || '').trim()
    const dataValue = row[colIndex]

    // Saltar si el header no es un número o no contiene "AÑO"
    if (isNaN(Number(headerValue)) && !headerValue.includes('AÑO')) continue

    // Obtener el año y mes
    const [year, month] = parseYearMonth(headerValue, colIndex)

    // El valor de datos está en la siguiente fila a menudo, buscar en misma posición
    if (dataValue && !isNaN(Number(dataValue))) {
      const cleanValue = parseFloat(String(dataValue).replace(/[$,\s]/g, ''))

      let existing = resultArray.find(
        (d) =>
          d.regime === regime &&
          d.year === year &&
          d.month === month
      )

      if (!existing) {
        existing = {
          regime,
          year,
          month,
          inventory_count: 0,
          purchase_amount: 0,
          sales_amount: 0,
          operational_cost: 0,
          profit_loss: 0,
          business_unit: regime,
        }
        resultArray.push(existing)
      }

      // Asignar valor según tipo
      if (dataType === 'purchase') existing.purchase_amount = cleanValue
      else if (dataType === 'sales') existing.sales_amount = cleanValue
      else if (dataType === 'operational_cost') existing.operational_cost = cleanValue
      else if (dataType === 'profit_loss') existing.profit_loss = cleanValue
    }
  }
}

function parseYearMonth(header: string, colIndex: number): [number, string] {
  const headerUpper = String(header).trim().toUpperCase()

  // Si es 2024
  if (headerUpper === '2024') {
    return [2024, 'MAR']
  }

  // Buscar patrón como "AÑO 1 - MAR" o "AÑO1-MAR"
  const match = headerUpper.match(/AÑO\s*(\d+)\s*[-:\s]*([A-Z]+)/i)
  if (match) {
    const yearOffset = parseInt(match[1])
    const month = match[2].trim()
    return [2024 + yearOffset - 1, month]
  }

  // Fallback
  return [2024, 'MAR']
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}

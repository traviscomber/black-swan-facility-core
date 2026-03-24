import * as XLSX from 'xlsx'

export interface BusinessPlanData {
  regime: string // "RÉGIMEN CRIANZA, speed up" o "RÉGIMEN ACTUAL / CRIANZA Y ENGORDA"
  year: number
  month: string // "MAR", "DIC", etc
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

        // Parse el archivo según su estructura
        // Buscar los regímenes y extraer datos
        let currentRegime = ''
        let startRow = 0

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i] as any[]

          // Detectar regímenes
          if (row[0]?.includes('RÉGIMEN')) {
            currentRegime = row[0]
            console.log('[v0] Found regime:', currentRegime)
            continue
          }

          // Detectar filas de "MONTO DE COMPRA", "Venta crianza", etc
          if (currentRegime && row[0]?.includes('MONTO DE COMPRA')) {
            extractDataFromRow(row, currentRegime, 'purchase', businessPlanData)
          } else if (currentRegime && row[0]?.includes('Venta crianza')) {
            extractDataFromRow(row, currentRegime, 'sales', businessPlanData)
          } else if (currentRegime && row[0]?.includes('COSTO OPERACIONAL')) {
            extractDataFromRow(row, currentRegime, 'operational_cost', businessPlanData)
          } else if (currentRegime && row[0]?.includes('GANANCIA')) {
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
  // Extraer meses y valores desde la fila
  // Estructura esperada: [label, 2024, AÑO1-MAR, AÑO1-DIC, AÑO2-MAR, ...]

  const monthHeaders = [
    '2024',
    'AÑO 1 - MAR',
    'AÑO 1 - DIC',
    'AÑO 2 - MAR',
    'AÑO 2 - DIC',
    'AÑO 3 - MAR',
    'AÑO 3 - DIC',
    'AÑO 4 - MAR',
    'AÑO 4 - DIC',
    'AÑO 5 - MAR',
    'AÑO 5 - DIC',
    'AÑO 6 - MAR',
    'AÑO 6 - DIC',
    'AÑO 7 - MAR',
  ]

  let colIndex = 1
  for (let i = 0; i < monthHeaders.length && colIndex < row.length; i++) {
    const value = row[colIndex]
    const header = monthHeaders[i]

    if (value && !isNaN(value)) {
      const [year, month] = parseYearMonth(header, i)

      let existing = resultArray.find(
        (d) =>
          d.regime === regime &&
          d.year === year &&
          d.month === month &&
          d.business_unit === dataType
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
          business_unit: dataType,
        }
        resultArray.push(existing)
      }

      // Asignar el valor según el tipo
      const cleanValue = parseFloat(String(value).replace(/[$,]/g, ''))
      if (dataType === 'purchase') existing.purchase_amount = cleanValue
      else if (dataType === 'sales') existing.sales_amount = cleanValue
      else if (dataType === 'operational_cost') existing.operational_cost = cleanValue
      else if (dataType === 'profit_loss') existing.profit_loss = cleanValue
    }

    colIndex++
  }
}

function parseYearMonth(header: string, index: number): [number, string] {
  if (header.includes('2024')) {
    return [2024, 'MAR']
  }

  const match = header.match(/AÑO\s+(\d+).*?([A-Z]+)/)
  if (match) {
    const year = 2024 + parseInt(match[1])
    const month = match[2]
    return [year, month]
  }

  return [2024, 'MAR']
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}

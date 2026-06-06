export interface ExcelParseResult {
  rows: Record<string, any>[]
  headers: string[]
  rowCount: number
}

export async function parseExcelFile(file: File): Promise<ExcelParseResult> {
  const fileExt = file.name.split(".").pop()?.toLowerCase()

  if (fileExt === "csv") {
    return parseCSV(file)
  } else if (fileExt === "xlsx" || fileExt === "xls") {
    return parseXLSX(file)
  } else {
    throw new Error("Unsupported file format")
  }
}

async function parseCSV(file: File): Promise<ExcelParseResult> {
  const text = await file.text()
  const lines = text.trim().split("\n")

  if (lines.length < 1) {
    throw new Error("CSV file is empty")
  }

  const headers = lines[0].split(",").map((h) => h.trim())
  const rows: Record<string, any>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim())
    const row: Record<string, any> = {}

    headers.forEach((header, index) => {
      row[header] = values[index] || ""
    })

    rows.push(row)
  }

  return {
    rows,
    headers,
    rowCount: rows.length,
  }
}

async function parseXLSX(file: File): Promise<ExcelParseResult> {
  // Dynamically import XLSX library to keep bundle small
  const XLSX = await import("xlsx").then((m) => m.default || m)

  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: "array" })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]

  if (!worksheet) {
    throw new Error("No sheet found in Excel file")
  }

  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet)

  if (rows.length === 0) {
    return {
      rows: [],
      headers: [],
      rowCount: 0,
    }
  }

  const headers = Object.keys(rows[0])

  return {
    rows,
    headers,
    rowCount: rows.length,
  }
}

export function validateVineyardData(
  row: Record<string, any>,
  requiredFields: string[]
): string[] {
  const errors: string[] = []

  requiredFields.forEach((field) => {
    if (!row[field] || String(row[field]).trim() === "") {
      errors.push(`Missing required field: ${field}`)
    }
  })

  return errors
}

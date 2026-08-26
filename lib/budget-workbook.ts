import * as XLSX from "xlsx"

export type BudgetLineRole = "cost" | "income"

export type BudgetWorkbookLine = {
  division_key: string
  division_name: string
  parent_division_key: string | null
  parent_division_name: string | null
  division_sort_order: number
  category_key: string
  category_name: string
  category_role: BudgetLineRole
  category_sort_order: number
  month: number
  plan_amount: number
  actual_amount: number
  source_sheet: string
  source_row: number
  source_plan_cell: string
  source_actual_cell: string
  source_plan_formula: string | null
  source_actual_formula: string | null
  warnings: string[]
}

export type BudgetWorkbookDivisionSummary = {
  key: string
  name: string
  parentName: string | null
  categories: number
  annualPlanCost: number
  annualActualCost: number
  annualPlanIncome: number
  annualActualIncome: number
  annualPlanNet: number
  annualActualNet: number
}

export type BudgetWorkbookPreview = {
  fileName: string
  fileHash: string
  fileSize: number
  workbookTitle: string
  fiscalYear: number
  currency: "EUR"
  sourceSheet: string
  sheetNames: string[]
  lines: BudgetWorkbookLine[]
  warnings: string[]
  divisions: BudgetWorkbookDivisionSummary[]
}

type DivisionDefinition = {
  key: string
  label: string
  name: string
  parentKey: string | null
  parentName: string | null
  sortOrder: number
}

type CategoryDefinition = {
  key: string
  label: string
  role: BudgetLineRole
  sortOrder: number
  required: boolean
}

const SOURCE_SHEET = "Budget 26"
const MAX_FILE_SIZE = 25 * 1024 * 1024

const DIVISIONS: DivisionDefinition[] = [
  { key: "admin-general", label: "Admin / General (P&L)", name: "Admin / General", parentKey: null, parentName: null, sortOrder: 10 },
  { key: "hospitality-farm", label: "Farm (P&L)", name: "Farm", parentKey: "hospitality", parentName: "Hospitality", sortOrder: 20 },
  { key: "hospitality-torobayo", label: "Torobayo (P&L)", name: "Torobayo", parentKey: "hospitality", parentName: "Hospitality", sortOrder: 30 },
  { key: "landscaping", label: "Landscaping (P&L)", name: "Landscaping", parentKey: null, parentName: null, sortOrder: 40 },
  { key: "farming-cattle", label: "Cattle (P&L)", name: "Cattle", parentKey: "farming", parentName: "Farming", sortOrder: 50 },
  { key: "farming-vineyard", label: "Vineyard (P&L)", name: "Vineyard", parentKey: "farming", parentName: "Farming", sortOrder: 60 },
  { key: "farming-horses", label: "Horses (P&L)", name: "Horses", parentKey: "farming", parentName: "Farming", sortOrder: 70 },
  { key: "farming-orchard", label: "Orchard (P&L)", name: "Orchard", parentKey: "farming", parentName: "Farming", sortOrder: 80 },
]

const CATEGORIES: CategoryDefinition[] = [
  { key: "hr", label: "HR", role: "cost", sortOrder: 10, required: true },
  { key: "buildings", label: "Buildings", role: "cost", sortOrder: 20, required: true },
  { key: "vehicles-machines-fuel", label: "Vehicles / Machines / Fuel", role: "cost", sortOrder: 30, required: true },
  { key: "variable-consumables-tools", label: "Variable Cost / Consumables / Tools", role: "cost", sortOrder: 40, required: true },
  { key: "legal-financial", label: "Legal & Financial", role: "cost", sortOrder: 50, required: true },
  { key: "planning-investments-hr", label: "Planning Investments HR", role: "cost", sortOrder: 60, required: false },
  { key: "realising-investments", label: "Realising Investments", role: "cost", sortOrder: 70, required: false },
  { key: "income", label: "Income", role: "income", sortOrder: 90, required: true },
]

function normalized(value: unknown) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en")
}

function cell(sheet: XLSX.WorkSheet, row: number, column: number) {
  return sheet[XLSX.utils.encode_cell({ r: row - 1, c: column - 1 })] as XLSX.CellObject | undefined
}

function formula(value: XLSX.CellObject | undefined) {
  return value?.f ? `=${value.f}` : null
}

function numberValue(value: XLSX.CellObject | undefined): number | null {
  if (!value || value.v === null || value.v === undefined || value.v === "") return null
  if (typeof value.v === "number") return Number.isFinite(value.v) ? value.v : null
  if (typeof value.v !== "string") return null

  let raw = value.v.replace(/[€$\s]/g, "")
  if (!raw) return null
  const comma = raw.lastIndexOf(",")
  const dot = raw.lastIndexOf(".")
  if (comma > -1 && dot > -1) {
    raw = comma > dot ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "")
  } else if (comma > -1) {
    const decimalDigits = raw.length - comma - 1
    raw = decimalDigits > 0 && decimalDigits <= 3 ? raw.replace(",", ".") : raw.replace(/,/g, "")
  }
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function dateValue(value: XLSX.CellObject | undefined): Date | null {
  if (!value || value.v === null || value.v === undefined) return null
  if (value.v instanceof Date && !Number.isNaN(value.v.getTime())) return value.v
  if (typeof value.v === "number") {
    const decoded = XLSX.SSF.parse_date_code(value.v)
    if (!decoded) return null
    return new Date(Date.UTC(decoded.y, decoded.m - 1, decoded.d || 1))
  }
  const parsed = new Date(String(value.v))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function findLabelRow(sheet: XLSX.WorkSheet, label: string, maxRow = 240) {
  const target = normalized(label)
  for (let row = 1; row <= maxRow; row += 1) {
    if (normalized(cell(sheet, row, 2)?.v) === target) return row
  }
  return null
}

function findCategoryRow(sheet: XLSX.WorkSheet, definition: CategoryDefinition, startRow: number, endRow: number) {
  const target = normalized(definition.label)
  for (let row = startRow; row <= endRow; row += 1) {
    if (normalized(cell(sheet, row, 2)?.v) === target) return row
  }
  return null
}

async function sha256(buffer: ArrayBuffer) {
  const cryptoApi = globalThis.crypto
  if (!cryptoApi?.subtle) throw new Error("El navegador no permite calcular la huella segura del archivo.")
  const digest = await cryptoApi.subtle.digest("SHA-256", buffer)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function summarize(lines: BudgetWorkbookLine[]): BudgetWorkbookDivisionSummary[] {
  const groups = new Map<string, BudgetWorkbookDivisionSummary>()
  for (const line of lines) {
    const current = groups.get(line.division_key) ?? {
      key: line.division_key,
      name: line.division_name,
      parentName: line.parent_division_name,
      categories: 0,
      annualPlanCost: 0,
      annualActualCost: 0,
      annualPlanIncome: 0,
      annualActualIncome: 0,
      annualPlanNet: 0,
      annualActualNet: 0,
    }
    if (line.month === 1) current.categories += 1
    if (line.category_role === "income") {
      current.annualPlanIncome += line.plan_amount
      current.annualActualIncome += line.actual_amount
    } else {
      current.annualPlanCost += line.plan_amount
      current.annualActualCost += line.actual_amount
    }
    current.annualPlanNet = current.annualPlanCost - current.annualPlanIncome
    current.annualActualNet = current.annualActualCost - current.annualActualIncome
    groups.set(line.division_key, current)
  }
  return Array.from(groups.values())
}

export async function parseBudgetWorkbook(buffer: ArrayBuffer, fileName: string): Promise<BudgetWorkbookPreview> {
  if (buffer.byteLength > MAX_FILE_SIZE) throw new Error("El archivo supera el límite de 25 MB.")

  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    cellFormula: true,
    cellNF: true,
    cellStyles: false,
  })
  const sourceSheetName = workbook.SheetNames.find((name) => normalized(name) === normalized(SOURCE_SHEET))
  if (!sourceSheetName) throw new Error(`No se encontró la hoja canónica “${SOURCE_SHEET}”.`)
  const sheet = workbook.Sheets[sourceSheetName]
  const warnings: string[] = []
  const yearCounts = new Map<number, number>()
  const monthColumns: Array<{ month: number; year: number | null; planColumn: number; actualColumn: number }> = []

  for (let index = 0; index < 12; index += 1) {
    const planColumn = 7 + index * 3
    const actualColumn = planColumn + 1
    const headerDate = dateValue(cell(sheet, 3, planColumn))
    const month = headerDate ? headerDate.getUTCMonth() + 1 : index + 1
    const year = headerDate ? headerDate.getUTCFullYear() : null
    if (year) yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1)
    monthColumns.push({ month, year, planColumn, actualColumn })
  }

  const fiscalYear = Array.from(yearCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!fiscalYear) throw new Error("No fue posible identificar el año fiscal en la fila de meses de Budget 26.")
  if (yearCounts.size > 1) warnings.push("Los encabezados mensuales contienen más de un año fiscal.")

  const locatedDivisions = DIVISIONS.map((definition) => ({ ...definition, row: findLabelRow(sheet, definition.label) }))
  const missingDivisions = locatedDivisions.filter((division) => !division.row)
  if (missingDivisions.length) {
    warnings.push(`No se encontraron estas secciones P&L: ${missingDivisions.map((item) => item.label).join(", ")}.`)
  }

  const presentDivisions = locatedDivisions.filter((division): division is DivisionDefinition & { row: number } => typeof division.row === "number")
  if (!presentDivisions.length) throw new Error("No se encontraron centros P&L reconocibles en Budget 26.")

  const lines: BudgetWorkbookLine[] = []
  for (const division of presentDivisions) {
    const nextDivisionRow = locatedDivisions
      .map((item) => item.row)
      .filter((row): row is number => typeof row === "number" && row > division.row)
      .sort((a, b) => a - b)[0]
    const endRow = (nextDivisionRow ?? 106) - 1

    for (const category of CATEGORIES) {
      const categoryRow = findCategoryRow(sheet, category, division.row + 1, endRow)
      if (!categoryRow) {
        if (category.required) warnings.push(`${division.name}: no se encontró la categoría obligatoria “${category.label}”.`)
        continue
      }

      for (const monthColumn of monthColumns) {
        const planCell = cell(sheet, categoryRow, monthColumn.planColumn)
        const actualCell = cell(sheet, categoryRow, monthColumn.actualColumn)
        const lineWarnings: string[] = []
        const plan = numberValue(planCell)
        const actual = numberValue(actualCell)
        if (planCell?.f && plan === null) lineWarnings.push("plan_formula_without_cached_value")
        if (actualCell?.f && actual === null) lineWarnings.push("actual_formula_without_cached_value")
        if (monthColumn.year && monthColumn.year !== fiscalYear) lineWarnings.push("month_year_mismatch")

        lines.push({
          division_key: division.key,
          division_name: division.name,
          parent_division_key: division.parentKey,
          parent_division_name: division.parentName,
          division_sort_order: division.sortOrder,
          category_key: category.key,
          category_name: category.label,
          category_role: category.role,
          category_sort_order: category.sortOrder,
          month: monthColumn.month,
          plan_amount: plan ?? 0,
          actual_amount: actual ?? 0,
          source_sheet: sourceSheetName,
          source_row: categoryRow,
          source_plan_cell: XLSX.utils.encode_cell({ r: categoryRow - 1, c: monthColumn.planColumn - 1 }),
          source_actual_cell: XLSX.utils.encode_cell({ r: categoryRow - 1, c: monthColumn.actualColumn - 1 }),
          source_plan_formula: formula(planCell),
          source_actual_formula: formula(actualCell),
          warnings: lineWarnings,
        })
      }
    }
  }

  const missingCacheCount = lines.reduce((count, line) => count + line.warnings.filter((warning) => warning.includes("without_cached_value")).length, 0)
  if (missingCacheCount) warnings.push(`${missingCacheCount} celdas con fórmula no contienen un resultado guardado por Excel.`)

  return {
    fileName,
    fileHash: await sha256(buffer),
    fileSize: buffer.byteLength,
    workbookTitle: String(cell(sheet, 1, 2)?.v ?? "Budget & PnL"),
    fiscalYear,
    currency: "EUR",
    sourceSheet: sourceSheetName,
    sheetNames: workbook.SheetNames,
    lines,
    warnings: Array.from(new Set(warnings)),
    divisions: summarize(lines),
  }
}

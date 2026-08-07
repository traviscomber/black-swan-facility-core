import assert from "node:assert/strict"
import test from "node:test"
import * as XLSX from "xlsx"
import { parseBudgetWorkbook } from "../lib/budget-workbook.ts"

function setCell(sheet: XLSX.WorkSheet, address: string, value: string | number | Date) {
  sheet[address] = { t: value instanceof Date ? "d" : typeof value === "number" ? "n" : "s", v: value }
}

test("parses the canonical Budget 26 summary into monthly budget lines", async () => {
  const sheet: XLSX.WorkSheet = { "!ref": "A1:AQ120" }
  setCell(sheet, "B1", "Budget 26 Chile €")
  for (let month = 0; month < 12; month += 1) {
    const planColumn = 7 + month * 3
    const actualColumn = planColumn + 1
    setCell(sheet, XLSX.utils.encode_cell({ r: 2, c: planColumn - 1 }), new Date(Date.UTC(2026, month, 1)))
    setCell(sheet, XLSX.utils.encode_cell({ r: 1, c: planColumn - 1 }), "Plan")
    setCell(sheet, XLSX.utils.encode_cell({ r: 1, c: actualColumn - 1 }), "Actual")
  }

  setCell(sheet, "B10", "Admin / General (P&L)")
  setCell(sheet, "B12", "HR")
  setCell(sheet, "B13", "Buildings")
  setCell(sheet, "B14", "Vehicles / Machines / Fuel")
  setCell(sheet, "B15", "Variable Cost / Consumables / Tools")
  setCell(sheet, "B16", "Legal & Financial")
  setCell(sheet, "B19", "Income")
  setCell(sheet, "G12", 100)
  setCell(sheet, "H12", 90)

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "Budget 26")
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer
  const preview = await parseBudgetWorkbook(bytes, "Budget & PnL 26.xlsx")

  assert.equal(preview.fiscalYear, 2026)
  assert.equal(preview.sourceSheet, "Budget 26")
  const januaryHr = preview.lines.find(
    (line) => line.division_key === "admin-general" && line.category_key === "hr" && line.month === 1,
  )
  assert.ok(januaryHr)
  assert.equal(januaryHr.plan_amount, 100)
  assert.equal(januaryHr.actual_amount, 90)
  assert.equal(januaryHr.source_plan_cell, "G12")
})

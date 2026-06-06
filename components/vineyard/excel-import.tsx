"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileInput } from "./file-input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { parseExcelFile, ExcelParseResult } from "@/lib/vineyard/excel-parser"
import { Loader2, AlertCircle, CheckCircle } from "lucide-react"

interface ExcelImportProps {
  dataType: "vines" | "plots" | "harvest" | "care" | "pests"
  onDataParsed: (data: ExcelParseResult) => void
}

export function ExcelImport({ dataType, onDataParsed }: ExcelImportProps) {
  const [loading, setLoading] = useState(false)
  const [parseResult, setParseResult] = useState<ExcelParseResult | null>(null)
  const [error, setError] = useState("")

  const handleFileSelect = async (file: File) => {
    setLoading(true)
    setError("")
    setParseResult(null)

    try {
      const result = await parseExcelFile(file)

      if (result.rowCount === 0) {
        setError("Excel file is empty or has no data rows")
        setLoading(false)
        return
      }

      setParseResult(result)
      onDataParsed(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Parse failed"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const getTemplateHeaders = () => {
    const templates: Record<string, string[]> = {
      vines: ["vine_number", "variety", "rootstock", "health_status", "age_years"],
      plots: ["name", "area_hectares", "vine_variety", "soil_type", "ph_level"],
      harvest: ["harvest_date", "quantity_kg", "sugar_level_brix", "acidity_ph", "quality_rating"],
      care: ["activity_date", "care_type", "irrigation_mm", "labor_hours", "effectiveness_rating"],
      pests: ["detection_date", "pest_disease_name", "severity_level", "treatment_date", "cost"],
    }
    return templates[dataType] || []
  }

  const templateHeaders = getTemplateHeaders()

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-2">Import {dataType.charAt(0).toUpperCase() + dataType.slice(1)} Data</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Expected columns: {templateHeaders.join(", ")}
        </p>
      </div>

      <FileInput
        onFileSelect={handleFileSelect}
        accept=".xlsx,.xls,.csv"
        fileType="excel"
        label="Upload Excel or CSV File"
        disabled={loading}
      />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Parsing file...
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {parseResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Found {parseResult.rowCount} rows with {parseResult.headers.length} columns
              </p>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-sm border border-secondary rounded">
                  <thead className="bg-muted">
                    <tr>
                      {parseResult.headers.map((header) => (
                        <th key={header} className="border border-secondary p-2 text-left">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.rows.slice(0, 5).map((row, idx) => (
                      <tr key={idx}>
                        {parseResult.headers.map((header) => (
                          <td key={`${idx}-${header}`} className="border border-secondary p-2">
                            {String(row[header] || "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parseResult.rowCount > 5 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ... and {parseResult.rowCount - 5} more rows
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

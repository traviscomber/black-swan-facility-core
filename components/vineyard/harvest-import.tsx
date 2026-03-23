"use client"

import { useState } from "react"
import { ExcelImport } from "./excel-import"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ExcelParseResult } from "@/lib/vineyard/excel-parser"
import { Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { createClient } from "@supabase/supabase-js"

interface HarvestImportProps {
  plotId: string
  onImportSuccess?: () => void
}

export function HarvestImport({ plotId, onImportSuccess }: HarvestImportProps) {
  const [parseResult, setParseResult] = useState<ExcelParseResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleDataParsed = (data: ExcelParseResult) => {
    setParseResult(data)
  }

  const handleImport = async () => {
    if (!parseResult) return

    setImporting(true)
    setError("")
    setSuccess(false)

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const recordsToInsert = parseResult.rows.map((row) => ({
        plot_id: plotId,
        harvest_date: row.harvest_date || new Date().toISOString().split("T")[0],
        quantity_kg: parseFloat(row.quantity_kg) || 0,
        sugar_level_brix: parseFloat(row.sugar_level_brix) || null,
        acidity_ph: parseFloat(row.acidity_ph) || null,
        quality_rating: parseInt(row.quality_rating) || null,
        yield_per_hectare: parseFloat(row.yield_per_hectare) || null,
        notes: row.notes || "",
      }))

      const { error: insertError } = await supabase
        .from("vineyard_harvest_records")
        .insert(recordsToInsert)

      if (insertError) throw insertError

      setSuccess(true)
      setParseResult(null)
      onImportSuccess?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed"
      setError(message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <ExcelImport dataType="harvest" onDataParsed={handleDataParsed} />

      {parseResult && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              Ready to Import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              {parseResult.rowCount} harvest records will be imported
            </p>
            <Button
              onClick={handleImport}
              disabled={importing}
              className="w-full"
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                "Confirm Import"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600 p-3 rounded border border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-sm text-green-600 p-3 rounded border border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4" />
          Harvest data imported successfully!
        </div>
      )}
    </div>
  )
}

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, Loader2, CheckCircle } from "lucide-react"
import { parseBusinessPlanExcel, BusinessPlanData } from "@/lib/cattle/business-plan-parser"
import { createBrowserClient } from "@/lib/supabase/client"

interface BusinessPlanUploadProps {
  onDataLoaded?: (data: BusinessPlanData[]) => void
}

export function BusinessPlanUpload({ onDataLoaded }: BusinessPlanUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [fileName, setFileName] = useState("")
  const supabase = createBrowserClient()

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError("")
    setSuccess(false)

    try {
      console.log("[v0] Parsing Excel file:", file.name)
      
      // Parse the Excel file
      const businessPlanData = await parseBusinessPlanExcel(file)
      
      if (businessPlanData.length === 0) {
        throw new Error("No data found in Excel file")
      }

      console.log("[v0] Parsed data:", businessPlanData.length, "records")

      // Save data to Supabase
      const { error: insertError } = await supabase
        .from("cattle_business_plan")
        .insert(
          businessPlanData.map((item) => ({
            year: item.year,
            month: item.month,
            inventory_count: item.inventory_count,
            purchase_amount: item.purchase_amount,
            sales_amount: item.sales_amount,
            operational_cost: item.operational_cost,
            profit_loss: item.profit_loss,
            business_unit: item.regime,
          }))
        )

      if (insertError) {
        console.error("[v0] Insert error:", insertError)
        throw insertError
      }

      setFileName(file.name)
      setSuccess(true)
      
      if (onDataLoaded) {
        onDataLoaded(businessPlanData)
      }

      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error processing file"
      console.error("[v0] Upload error:", message)
      setError(message)
    } finally {
      setUploading(false)
      event.target.value = "" // Reset file input
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Importar Plan de Negocios
        </CardTitle>
        <CardDescription>
          Carga un archivo Excel con los proyecciones de dos regímenes (crianza y engorda)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition">
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-gray-400" />
              <p className="text-sm font-medium text-gray-700">
                {uploading ? "Procesando..." : "Arrastra tu archivo Excel aquí"}
              </p>
              <p className="text-xs text-gray-500">
                Soporta .xlsx, .xls y .csv
              </p>
              <Button disabled={uploading} type="button" variant="outline" size="sm" className="mt-2">
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  "Seleccionar Archivo"
                )}
              </Button>
            </div>
          </label>
        </div>

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-900">Plan importado exitosamente</p>
              <p className="text-xs text-green-700 mt-1">{fileName}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-900">Error al procesar archivo</p>
            <p className="text-xs text-red-700 mt-1">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

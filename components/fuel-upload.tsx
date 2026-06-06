'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { parseFuelFile, type FuelRecord } from '@/lib/fuel-parser'
import { detectAnomaliesAction } from '@/app/combustibles/actions'

interface FuelUploadProps {
  onRecordsLoaded?: (records: FuelRecord[]) => void
  onAnomaliesDetected?: (anomalies: any[]) => void
}

export function FuelUploadComponent({ onRecordsLoaded, onAnomaliesDetected }: FuelUploadProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [parsedRecords, setParsedRecords] = useState<FuelRecord[]>([])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      console.log('[v0] Parsing fuel file:', file.name)
      const records = await parseFuelFile(file)
      console.log('[v0] Parsed records:', records.length)

      if (records.length === 0) {
        throw new Error('No se encontraron registros válidos en el archivo')
      }

      setParsedRecords(records)

      // Detect anomalies using server action
      console.log('[v0] Detecting anomalies...')
      const anomalies = await detectAnomaliesAction(records)
      console.log('[v0] Found anomalies:', anomalies.length)

      onRecordsLoaded?.(records)
      onAnomaliesDetected?.(anomalies)

      setSuccess(`✓ Se cargaron ${records.length} registros. ${anomalies.length} anomalías detectadas.`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      console.error('[v0] Upload error:', errorMessage)
      setError(`Error: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Cargar Reporte de Combustible
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border rounded-md"
          />
          <Button disabled={isLoading} variant="outline">
            {isLoading ? 'Cargando...' : 'Cargar'}
          </Button>
        </div>

        <p className="text-sm text-gray-500">Formatos soportados: CSV, Excel (.xlsx, .xls)</p>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {parsedRecords.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-semibold text-blue-900">Registros cargados:</p>
            <p className="text-sm text-blue-800">
              {parsedRecords.length} registros - {parsedRecords.reduce((sum, r) => sum + r.liters, 0).toFixed(2)}L total
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

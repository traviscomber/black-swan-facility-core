'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, AlertTriangle, CheckCircle2, FileCheck2 } from 'lucide-react'
import { parseFuelFile, type FuelRecord } from '@/lib/fuel-parser'
import { detectAnomaliesAction } from '@/app/combustibles/actions'
import { useLanguage } from '@/lib/hooks/use-language'

interface FuelUploadProps {
  onRecordsLoaded?: (records: FuelRecord[]) => void
  onAnomaliesDetected?: (anomalies: unknown[]) => void
}

const copy = {
  es: {
    title: 'Validar reporte de combustible',
    description: 'El archivo se analiza localmente y se revisa contra vehículos y personas registradas. Esta acción no guarda datos en Supabase.',
    choose: 'Seleccionar archivo',
    validating: 'Validando…',
    validate: 'Validar archivo',
    formats: 'Formatos admitidos: CSV y Excel (.xlsx, .xls).',
    noFile: 'Seleccione un archivo antes de validar.',
    noRecords: 'No se encontraron registros válidos en el archivo.',
    unknownError: 'Error desconocido',
    success: (records: number, anomalies: number) => `${records.toLocaleString('es-CL')} registros fueron analizados y ${anomalies.toLocaleString('es-CL')} posibles anomalías fueron detectadas. Ningún registro fue guardado.`,
    previewTitle: 'Resultado de validación',
    records: 'registros analizados',
    total: 'litros totales declarados',
    safeguard: 'Para persistir una importación se requiere un flujo separado de revisión, confirmación y control de duplicados.',
  },
  en: {
    title: 'Validate fuel report',
    description: 'The file is parsed locally and checked against registered vehicles and people. This action does not save data to Supabase.',
    choose: 'Select file',
    validating: 'Validating…',
    validate: 'Validate file',
    formats: 'Supported formats: CSV and Excel (.xlsx, .xls).',
    noFile: 'Select a file before validating.',
    noRecords: 'No valid records were found in the file.',
    unknownError: 'Unknown error',
    success: (records: number, anomalies: number) => `${records.toLocaleString('en-US')} records were analyzed and ${anomalies.toLocaleString('en-US')} possible anomalies were detected. No records were saved.`,
    previewTitle: 'Validation result',
    records: 'records analyzed',
    total: 'declared total liters',
    safeguard: 'Persisting an import requires a separate review, confirmation and duplicate-control workflow.',
  },
  de: {
    title: 'Kraftstoffbericht validieren',
    description: 'Die Datei wird lokal ausgewertet und mit registrierten Fahrzeugen und Personen abgeglichen. Diese Aktion speichert keine Daten in Supabase.',
    choose: 'Datei auswählen',
    validating: 'Wird validiert…',
    validate: 'Datei validieren',
    formats: 'Unterstützte Formate: CSV und Excel (.xlsx, .xls).',
    noFile: 'Wählen Sie vor der Validierung eine Datei aus.',
    noRecords: 'In der Datei wurden keine gültigen Datensätze gefunden.',
    unknownError: 'Unbekannter Fehler',
    success: (records: number, anomalies: number) => `${records.toLocaleString('de-DE')} Datensätze wurden analysiert und ${anomalies.toLocaleString('de-DE')} mögliche Anomalien erkannt. Es wurden keine Datensätze gespeichert.`,
    previewTitle: 'Validierungsergebnis',
    records: 'Datensätze analysiert',
    total: 'deklarierte Liter gesamt',
    safeguard: 'Für das dauerhafte Speichern eines Imports ist ein separater Ablauf für Prüfung, Bestätigung und Duplikatkontrolle erforderlich.',
  },
} as const

const locales = { es: 'es-CL', en: 'en-US', de: 'de-DE' } as const

export function FuelUploadComponent({ onRecordsLoaded, onAnomaliesDetected }: FuelUploadProps) {
  const { language } = useLanguage()
  const text = copy[language]
  const locale = locales[language]
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [parsedRecords, setParsedRecords] = useState<FuelRecord[]>([])

  const handleValidation = async () => {
    if (!selectedFile) {
      setError(text.noFile)
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)
    setParsedRecords([])

    try {
      const records = await parseFuelFile(selectedFile)
      if (records.length === 0) throw new Error(text.noRecords)

      const anomalies = await detectAnomaliesAction(records)
      setParsedRecords(records)
      onRecordsLoaded?.(records)
      onAnomaliesDetected?.(anomalies)
      setSuccess(text.success(records.length, anomalies.length))
    } catch (err) {
      setError(err instanceof Error ? err.message : text.unknownError)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />{text.title}</CardTitle>
        <CardDescription>{text.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(event) => {
            setSelectedFile(event.target.files?.[0] ?? null)
            setError(null)
            setSuccess(null)
            setParsedRecords([])
          }}
          disabled={isLoading}
          className="hidden"
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="button" variant="outline" disabled={isLoading} onClick={() => inputRef.current?.click()}>
            <FileCheck2 className="mr-2 h-4 w-4" />{text.choose}
          </Button>
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{selectedFile?.name ?? text.formats}</p>
          <Button type="button" disabled={isLoading || !selectedFile} onClick={() => void handleValidation()}>
            {isLoading ? text.validating : text.validate}
          </Button>
        </div>

        {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
        {success && <Alert><CheckCircle2 className="h-4 w-4" /><AlertDescription>{success}</AlertDescription></Alert>}

        {parsedRecords.length > 0 && (
          <div className="rounded-lg border p-4">
            <p className="font-medium">{text.previewTitle}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {parsedRecords.length.toLocaleString(locale)} {text.records} · {parsedRecords.reduce((sum, record) => sum + Number(record.liters || 0), 0).toLocaleString(locale, { maximumFractionDigits: 2 })} {text.total}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">{text.safeguard}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

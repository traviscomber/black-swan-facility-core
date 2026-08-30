"use client"

import { AlertTriangle, BarChart3, FileUp, ListChecks, ShieldCheck } from "lucide-react"
import { FuelAnalyticsTab } from "@/components/fuel-analytics"
import { MonthlySummaryTab } from "@/components/fuel-monthly-summary"
import { FuelUploadComponent } from "@/components/fuel-upload"
import { FuelValidationReview } from "@/components/fuel-validation-review"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLanguage } from "@/lib/hooks/use-language"

type Vehicle = { id: string; name: string | null; code: string | null; vehicle_type: string | null; plate_number: string | null; status: string | null }
type FuelRecord = {
  id: string
  date_recorded: string
  liters: number | null
  cost_pesos: number | null
  fuel_type: string | null
  vehicle_id: string | null
  submitted_by: string | null
  is_verified: boolean | null
  validation_status: string | null
  source: string | null
  location: string | null
  odometer_reading: number | null
  employee_name?: string | null
  vehicle?: { name?: string | null; code?: string | null } | null
}

const COPY = {
  en: {
    title: "Fuel",
    description: "Fuel consumption records, validation, and analysis for Fundo Corcovado.",
    pendingTitle: "Pending fuel records do not affect operational indicators.",
    pending: (pending: string, incomplete: string) => `${pending} records await review and ${incomplete} are missing location or odometer data. Only verified records feed KPIs, costs, and analysis.`,
    rejected: (count: string) => ` ${count} records were rejected and remain available for audit.`,
    fuelError: "Fuel records could not be loaded.",
    verifiedError: "Verified fuel consumption could not be loaded.",
    validation: "Validation",
    summary: "Summary",
    analytics: "Analysis",
    upload: "Import",
  },
  es: {
    title: "Combustibles",
    description: "Registro, validación y análisis de consumos del Fundo Corcovado.",
    pendingTitle: "Los consumos pendientes no afectan indicadores operacionales.",
    pending: (pending: string, incomplete: string) => `${pending} registros esperan revisión y ${incomplete} no incluyen ubicación u odómetro. Solo los registros verificados ingresan a KPI, costos y análisis.`,
    rejected: (count: string) => ` ${count} registros fueron rechazados y permanecen disponibles para auditoría.`,
    fuelError: "No fue posible cargar los registros de combustible.",
    verifiedError: "No fue posible cargar los consumos verificados.",
    validation: "Validación",
    summary: "Resumen",
    analytics: "Análisis",
    upload: "Importar",
  },
  de: {
    title: "Kraftstoff",
    description: "Erfassung, Prüfung und Analyse des Kraftstoffverbrauchs von Fundo Corcovado.",
    pendingTitle: "Ausstehende Kraftstoffdatensätze beeinflussen die Betriebskennzahlen nicht.",
    pending: (pending: string, incomplete: string) => `${pending} Datensätze warten auf Prüfung; bei ${incomplete} fehlen Standort- oder Kilometerstanddaten. Nur verifizierte Datensätze fließen in KPIs, Kosten und Analysen ein.`,
    rejected: (count: string) => ` ${count} Datensätze wurden abgelehnt und bleiben für Prüfzwecke verfügbar.`,
    fuelError: "Die Kraftstoffdatensätze konnten nicht geladen werden.",
    verifiedError: "Die verifizierten Kraftstoffverbräuche konnten nicht geladen werden.",
    validation: "Prüfung",
    summary: "Übersicht",
    analytics: "Analyse",
    upload: "Importieren",
  },
} as const

const LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const

export function LocalizedFuelPageShell({
  verifiedRecords,
  pendingRecords,
  rejectedCount,
  incompleteCount,
  anomalies,
  vehicles,
  fuelLoadFailed,
  verifiedLoadFailed,
}: {
  verifiedRecords: FuelRecord[]
  pendingRecords: FuelRecord[]
  rejectedCount: number
  incompleteCount: number
  anomalies: unknown[]
  vehicles: Vehicle[]
  fuelLoadFailed: boolean
  verifiedLoadFailed: boolean
}) {
  const { language } = useLanguage()
  const copy = COPY[language]
  const number = new Intl.NumberFormat(LOCALES[language])

  return (
    <>
      <PageHeader title={copy.title} description={copy.description} />
      <div className="space-y-6 p-4 sm:p-8">
        {(pendingRecords.length > 0 || incompleteCount > 0) && (
          <Card className="border-amber-300">
            <CardContent className="flex gap-3 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">{copy.pendingTitle}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {copy.pending(number.format(pendingRecords.length), number.format(incompleteCount))}
                  {rejectedCount > 0 ? copy.rejected(number.format(rejectedCount)) : ""}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        {fuelLoadFailed && <Card className="border-destructive/50"><CardContent className="p-4 text-sm text-destructive">{copy.fuelError}</CardContent></Card>}
        {verifiedLoadFailed && <Card className="border-destructive/50"><CardContent className="p-4 text-sm text-destructive">{copy.verifiedError}</CardContent></Card>}
        <Tabs defaultValue="validation" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="validation" className="flex min-h-10 items-center gap-2"><ShieldCheck className="h-4 w-4" /><span>{copy.validation}</span></TabsTrigger>
            <TabsTrigger value="summary" className="flex min-h-10 items-center gap-2"><BarChart3 className="h-4 w-4" /><span>{copy.summary}</span></TabsTrigger>
            <TabsTrigger value="analytics" className="flex min-h-10 items-center gap-2"><ListChecks className="h-4 w-4" /><span>{copy.analytics}</span></TabsTrigger>
            <TabsTrigger value="upload" className="flex min-h-10 items-center gap-2"><FileUp className="h-4 w-4" /><span>{copy.upload}</span></TabsTrigger>
          </TabsList>
          <div className="mt-6">
            <TabsContent value="validation"><FuelValidationReview records={pendingRecords} /></TabsContent>
            <TabsContent value="summary"><MonthlySummaryTab records={verifiedRecords} summary={[]} anomalies={anomalies} pendingCount={pendingRecords.length} /></TabsContent>
            <TabsContent value="analytics"><FuelAnalyticsTab records={verifiedRecords} vehicles={vehicles} /></TabsContent>
            <TabsContent value="upload"><FuelUploadComponent /></TabsContent>
          </div>
        </Tabs>
      </div>
    </>
  )
}

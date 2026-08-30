'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useLanguage } from '@/lib/hooks/use-language'

interface FuelRecord {
  id?: string
  date_recorded: string
  liters: number | null
  cost_pesos: number | null
  fuel_type: string | null
  vehicle_id: string | null
  submitted_by: string | null
  employee_name?: string | null
}

interface Vehicle {
  id: string
  name: string | null
}

interface FuelAnalyticsTabProps {
  records: FuelRecord[]
  vehicles: Vehicle[]
}

const copy = {
  es: {
    title: 'Período de análisis',
    description: 'Todas las métricas siguientes corresponden exclusivamente al mes seleccionado.',
    showing: 'Mostrando',
    records: 'Registros del período',
    liters: 'Litros registrados',
    cost: 'Gasto registrado',
    average: 'Costo promedio por litro',
    noData: 'No existen registros para este período.',
    byFuel: 'Consumo por combustible',
    fuel: 'Combustible',
    byVehicle: 'Vehículos con mayor consumo',
    vehicle: 'Vehículo',
    transactions: 'Registros',
    unknown: 'No identificado',
    dataNote: 'Las cifras provienen de registros almacenados. No representan telemetría automática ni inventario físico de estanques.',
  },
  en: {
    title: 'Analysis period',
    description: 'All metrics below correspond exclusively to the selected month.',
    showing: 'Showing',
    records: 'Period records',
    liters: 'Recorded liters',
    cost: 'Recorded expenditure',
    average: 'Average cost per liter',
    noData: 'No records exist for this period.',
    byFuel: 'Consumption by fuel type',
    fuel: 'Fuel',
    byVehicle: 'Highest-consumption vehicles',
    vehicle: 'Vehicle',
    transactions: 'Records',
    unknown: 'Unidentified',
    dataNote: 'Figures come from stored records. They do not represent automatic telemetry or physical tank inventory.',
  },
  de: {
    title: 'Analysezeitraum',
    description: 'Alle folgenden Kennzahlen beziehen sich ausschließlich auf den ausgewählten Monat.',
    showing: 'Angezeigt',
    records: 'Datensätze im Zeitraum',
    liters: 'Erfasste Liter',
    cost: 'Erfasste Ausgaben',
    average: 'Durchschnittskosten pro Liter',
    noData: 'Für diesen Zeitraum liegen keine Datensätze vor.',
    byFuel: 'Verbrauch nach Kraftstoffart',
    fuel: 'Kraftstoff',
    byVehicle: 'Fahrzeuge mit höchstem Verbrauch',
    vehicle: 'Fahrzeug',
    transactions: 'Datensätze',
    unknown: 'Nicht identifiziert',
    dataNote: 'Die Werte stammen aus gespeicherten Datensätzen. Sie stellen weder automatische Telemetrie noch den physischen Tankbestand dar.',
  },
} as const

const locales = { es: 'es-CL', en: 'en-US', de: 'de-DE' } as const

export function FuelAnalyticsTab({ records, vehicles }: FuelAnalyticsTabProps) {
  const { language } = useLanguage()
  const lang = language
  const text = copy[lang]
  const locale = locales[lang]

  const availablePeriods = useMemo(() => {
    return Array.from(new Set(records.map((record) => record.date_recorded?.slice(0, 7)).filter(Boolean))).sort().reverse()
  }, [records])

  const [periodIndex, setPeriodIndex] = useState(0)
  const selectedPeriod = availablePeriods[periodIndex] ?? ''

  const filteredRecords = useMemo(
    () => records.filter((record) => record.date_recorded?.startsWith(selectedPeriod)),
    [records, selectedPeriod],
  )

  const totalLiters = filteredRecords.reduce((sum, record) => sum + Number(record.liters ?? 0), 0)
  const totalCost = filteredRecords.reduce((sum, record) => sum + Number(record.cost_pesos ?? 0), 0)
  const averageCost = totalLiters > 0 ? totalCost / totalLiters : 0

  const fuelRows = useMemo(() => {
    const totals = new Map<string, { liters: number; records: number }>()
    filteredRecords.forEach((record) => {
      const key = record.fuel_type || text.unknown
      const current = totals.get(key) ?? { liters: 0, records: 0 }
      current.liters += Number(record.liters ?? 0)
      current.records += 1
      totals.set(key, current)
    })
    return Array.from(totals.entries()).map(([name, values]) => ({ name, ...values })).sort((a, b) => b.liters - a.liters)
  }, [filteredRecords, text.unknown])

  const vehicleRows = useMemo(() => {
    const vehicleNames = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.name || text.unknown]))
    const totals = new Map<string, { liters: number; records: number }>()
    filteredRecords.forEach((record) => {
      const key = record.vehicle_id ? vehicleNames.get(record.vehicle_id) || record.vehicle_id : text.unknown
      const current = totals.get(key) ?? { liters: 0, records: 0 }
      current.liters += Number(record.liters ?? 0)
      current.records += 1
      totals.set(key, current)
    })
    return Array.from(totals.entries()).map(([name, values]) => ({ name, ...values })).sort((a, b) => b.liters - a.liters).slice(0, 10)
  }, [filteredRecords, vehicles, text.unknown])

  const periodLabel = selectedPeriod
    ? new Date(`${selectedPeriod}-15T12:00:00`).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
    : '—'

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>{text.title}</CardTitle><CardDescription>{text.description}</CardDescription></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <Button variant="outline" size="icon" disabled={periodIndex >= availablePeriods.length - 1} onClick={() => setPeriodIndex((index) => Math.min(index + 1, availablePeriods.length - 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="text-center"><p className="text-sm text-muted-foreground">{text.showing}</p><p className="font-medium capitalize">{periodLabel}</p></div>
            <Button variant="outline" size="icon" disabled={periodIndex <= 0} onClick={() => setPeriodIndex((index) => Math.max(index - 1, 0))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title={text.records} value={filteredRecords.length.toLocaleString(locale)} />
        <Metric title={text.liters} value={`${totalLiters.toLocaleString(locale, { maximumFractionDigits: 2 })} L`} />
        <Metric title={text.cost} value={totalCost.toLocaleString(locale, { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })} />
        <Metric title={text.average} value={averageCost.toLocaleString(locale, { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })} />
      </div>

      {filteredRecords.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{text.noData}</CardContent></Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <DataTable title={text.byFuel} firstColumn={text.fuel} rows={fuelRows} litersLabel={text.liters} recordsLabel={text.transactions} locale={locale} />
          <DataTable title={text.byVehicle} firstColumn={text.vehicle} rows={vehicleRows} litersLabel={text.liters} recordsLabel={text.transactions} locale={locale} />
        </div>
      )}

      <Card><CardContent className="p-4 text-xs text-muted-foreground">{text.dataNote}</CardContent></Card>
    </div>
  )
}

function Metric({ title, value }: { title: string; value: string }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{value}</p></CardContent></Card>
}

function DataTable({ title, firstColumn, rows, litersLabel, recordsLabel, locale }: { title: string; firstColumn: string; rows: { name: string; liters: number; records: number }[]; litersLabel: string; recordsLabel: string; locale: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>{firstColumn}</TableHead><TableHead className="text-right">{litersLabel}</TableHead><TableHead className="text-right">{recordsLabel}</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((row) => <TableRow key={row.name}><TableCell className="font-medium"><Badge variant="outline">{row.name}</Badge></TableCell><TableCell className="text-right">{row.liters.toLocaleString(locale, { maximumFractionDigits: 2 })} L</TableCell><TableCell className="text-right">{row.records.toLocaleString(locale)}</TableCell></TableRow>)}</TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

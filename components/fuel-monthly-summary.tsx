'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useLanguage } from '@/lib/hooks/use-language'

interface MonthlySummaryTabProps {
  records: any[]
  summary: any[]
  anomalies: any[]
  pendingCount?: number
}

const copy = {
  es: {
    verifiedOnly: 'KPI calculados solo con registros verificados.',
    pendingExcluded: (count: number) => `${count.toLocaleString('es-CL')} registros pendientes fueron excluidos de litros, costos y promedios.`,
    totalRecords: 'Registros verificados',
    totalLiters: 'Litros verificados',
    totalSpend: 'Gasto verificado',
    anomalies: 'Anomalías detectadas',
    critical: 'de severidad alta',
    alert: (count: number) => `Se detectaron ${count.toLocaleString('es-CL')} anomalías de severidad alta. Deben revisarse antes de confirmar nuevos consumos.`,
    monthly: 'Resumen mensual verificado',
    month: 'Mes',
    records: 'Registros',
    liters: 'Litros',
    cost: 'Costo CLP',
    costLiter: 'CLP/L',
    types: 'Combustibles',
    detected: 'Anomalías detectadas',
    type: 'Tipo',
    description: 'Descripción',
    severity: 'Severidad',
    status: 'Revisada',
    yes: 'Sí',
    no: 'No',
    unknown: 'Desconocido',
    noData: 'Todavía no existen consumos verificados para calcular indicadores operacionales.',
  },
  en: {
    verifiedOnly: 'KPIs are calculated only from verified records.',
    pendingExcluded: (count: number) => `${count.toLocaleString('en-US')} pending records were excluded from liters, costs, and averages.`,
    totalRecords: 'Verified records',
    totalLiters: 'Verified liters',
    totalSpend: 'Verified spend',
    anomalies: 'Detected anomalies',
    critical: 'high-severity',
    alert: (count: number) => `${count.toLocaleString('en-US')} high-severity anomalies were detected. They must be reviewed before confirming new consumption.`,
    monthly: 'Verified monthly summary',
    month: 'Month',
    records: 'Records',
    liters: 'Liters',
    cost: 'Cost CLP',
    costLiter: 'CLP/L',
    types: 'Fuel types',
    detected: 'Detected anomalies',
    type: 'Type',
    description: 'Description',
    severity: 'Severity',
    status: 'Reviewed',
    yes: 'Yes',
    no: 'No',
    unknown: 'Unknown',
    noData: 'There are no verified fuel records available for operational KPIs yet.',
  },
  de: {
    verifiedOnly: 'Kennzahlen werden ausschließlich aus verifizierten Datensätzen berechnet.',
    pendingExcluded: (count: number) => `${count.toLocaleString('de-DE')} ausstehende Datensätze wurden von Litern, Kosten und Durchschnittswerten ausgeschlossen.`,
    totalRecords: 'Verifizierte Datensätze',
    totalLiters: 'Verifizierte Liter',
    totalSpend: 'Verifizierte Ausgaben',
    anomalies: 'Erkannte Anomalien',
    critical: 'mit hoher Schwere',
    alert: (count: number) => `${count.toLocaleString('de-DE')} Anomalien mit hoher Schwere wurden erkannt. Sie müssen vor der Bestätigung neuer Verbräuche geprüft werden.`,
    monthly: 'Verifizierte Monatsübersicht',
    month: 'Monat',
    records: 'Datensätze',
    liters: 'Liter',
    cost: 'Kosten CLP',
    costLiter: 'CLP/L',
    types: 'Kraftstoffarten',
    detected: 'Erkannte Anomalien',
    type: 'Typ',
    description: 'Beschreibung',
    severity: 'Schweregrad',
    status: 'Geprüft',
    yes: 'Ja',
    no: 'Nein',
    unknown: 'Unbekannt',
    noData: 'Es liegen noch keine verifizierten Kraftstoffdatensätze für betriebliche Kennzahlen vor.',
  },
} as const

const severityLabels = {
  es: { high: 'Alta', medium: 'Media', low: 'Baja' },
  en: { high: 'High', medium: 'Medium', low: 'Low' },
  de: { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' },
} as const

const locales = { es: 'es-CL', en: 'en-US', de: 'de-DE' } as const

export function MonthlySummaryTab({ records, anomalies, pendingCount = 0 }: MonthlySummaryTabProps) {
  const { language } = useLanguage()
  const lang = language
  const text = copy[lang]
  const locale = locales[lang]
  const monthlyData = new Map<string, any>()

  records.forEach((record: any) => {
    const date = new Date(record.date_recorded)
    if (Number.isNaN(date.getTime())) return
    const monthKey = date.toISOString().substring(0, 7)
    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { month: monthKey, totalLiters: 0, totalCost: 0, recordCount: 0, fuelTypes: {} as Record<string, number> })
    }
    const data = monthlyData.get(monthKey)!
    data.totalLiters += Number(record.liters || 0)
    data.totalCost += Number(record.cost_pesos || 0)
    data.recordCount += 1
    const fuelType = record.fuel_type || text.unknown
    data.fuelTypes[fuelType] = (data.fuelTypes[fuelType] || 0) + Number(record.liters || 0)
  })

  const months = Array.from(monthlyData.values()).sort((a, b) => b.month.localeCompare(a.month))
  const totalAnomalies = anomalies.length
  const criticalAnomalies = anomalies.filter((a: any) => a.severity === 'high').length
  const totalLiters = records.reduce((sum: number, record: any) => sum + Number(record.liters || 0), 0)
  const totalCost = records.reduce((sum: number, record: any) => sum + Number(record.cost_pesos || 0), 0)
  const currency = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>
          {text.verifiedOnly} {pendingCount > 0 ? text.pendingExcluded(pendingCount) : ''}
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric title={text.totalRecords} value={records.length.toLocaleString(locale)} />
        <Metric title={text.totalLiters} value={`${totalLiters.toLocaleString(locale, { maximumFractionDigits: 1 })} L`} />
        <Metric title={text.totalSpend} value={currency.format(totalCost)} />
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{text.anomalies}</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{totalAnomalies.toLocaleString(locale)}</p><p className="text-xs text-muted-foreground">{criticalAnomalies.toLocaleString(locale)} {text.critical}</p></CardContent></Card>
      </div>

      {criticalAnomalies > 0 && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{text.alert(criticalAnomalies)}</AlertDescription></Alert>}

      <Card>
        <CardHeader><CardTitle>{text.monthly}</CardTitle></CardHeader>
        <CardContent>
          {months.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">{text.noData}</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>{text.month}</TableHead><TableHead className="text-right">{text.records}</TableHead><TableHead className="text-right">{text.liters}</TableHead><TableHead className="text-right">{text.cost}</TableHead><TableHead className="text-right">{text.costLiter}</TableHead><TableHead>{text.types}</TableHead></TableRow></TableHeader><TableBody>{months.map((month: any) => { const costPerLiter = month.totalLiters > 0 ? month.totalCost / month.totalLiters : 0; const monthLabel = monthFormatter.format(new Date(`${month.month}-15T12:00:00`)); return <TableRow key={month.month}><TableCell className="font-medium capitalize">{monthLabel}</TableCell><TableCell className="text-right">{month.recordCount.toLocaleString(locale)}</TableCell><TableCell className="text-right">{month.totalLiters.toLocaleString(locale, { maximumFractionDigits: 2 })} L</TableCell><TableCell className="text-right">{currency.format(month.totalCost)}</TableCell><TableCell className="text-right">{currency.format(costPerLiter)}</TableCell><TableCell><div className="flex flex-wrap gap-1">{Object.entries(month.fuelTypes).map(([type, liters]: [string, any]) => <Badge key={type} variant="outline" className="text-xs">{type}: {Number(liters).toLocaleString(locale, { maximumFractionDigits: 1 })} L</Badge>)}</div></TableCell></TableRow> })}</TableBody></Table></div>}
        </CardContent>
      </Card>

      {anomalies.length > 0 && <Card><CardHeader><CardTitle>{text.detected}</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>{text.type}</TableHead><TableHead>{text.description}</TableHead><TableHead>{text.severity}</TableHead><TableHead>{text.status}</TableHead></TableRow></TableHeader><TableBody>{anomalies.slice(0, 20).map((anomaly: any) => <TableRow key={anomaly.id}><TableCell className="font-medium capitalize text-xs">{anomaly.anomaly_type?.replace(/_/g, ' ') || text.unknown}</TableCell><TableCell className="text-sm">{anomaly.description || '—'}</TableCell><TableCell><Badge variant={anomaly.severity === 'high' ? 'destructive' : anomaly.severity === 'medium' ? 'outline' : 'secondary'}>{severityLabels[lang][anomaly.severity as keyof typeof severityLabels.es] || anomaly.severity || text.unknown}</Badge></TableCell><TableCell>{anomaly.confirmed ? <span className="inline-flex items-center gap-1 text-sm"><CheckCircle2 className="h-4 w-4" />{text.yes}</span> : <span className="text-sm text-muted-foreground">{text.no}</span>}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>}
    </div>
  )
}

function Metric({ title, value }: { title: string; value: string }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{value}</p></CardContent></Card>
}

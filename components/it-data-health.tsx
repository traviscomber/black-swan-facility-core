'use client'

import { CalendarCheck2, CarFront, ClipboardList, Sprout } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/lib/hooks/use-language'

export type ItDataHealthSnapshot = {
  observed_at: string
  booking: {
    run_count: number
    latest: null | { status: string; total_checks: number; passed_checks: number; warning_checks: number; critical_checks: number; executed_at: string }
  }
  vehicles: { total: number; with_missing_fields: number; missing_identity: number; missing_classification: number; missing_cost_center: number; missing_responsible_team: number }
  orchard: { canonical_profiles: number; missing_dtm: number; missing_plant_spacing: number; missing_row_spacing: number; missing_yield: number; missing_yield_unit: number }
  tasks: { total: number; sourced: number; sourced_missing_id: number; sourced_missing_path: number }
}

const COPY = {
  en: {
    title: 'Canonical data health', description: 'Observed coverage and missing canonical fields. These are counts, not synthetic quality scores.', unavailable: 'Data-health snapshot unavailable.',
    booking: 'Bookings', bookingDescription: 'Latest canonical booking-health execution.', noRun: 'No booking-health run has been recorded.', runs: 'Runs', checks: 'Checks', passed: 'Passed', warnings: 'Warnings', critical: 'Critical', latest: 'Latest run',
    vehicles: 'Vehicle registry', vehiclesDescription: 'Coverage reported by the canonical vehicle registry health view.', total: 'Total', incomplete: 'With missing fields', identity: 'Identity', classification: 'Classification', costCenter: 'Cost center', team: 'Responsible team',
    orchard: 'Fundo Corcovado crop library', orchardDescription: 'Completeness of the 70-profile canonical Orchard layer; absence is shown as unknown, not inferred.', profiles: 'Canonical profiles', dtm: 'Missing DTM', plantSpacing: 'Missing plant spacing', rowSpacing: 'Missing row spacing', yield: 'Missing yield', yieldUnit: 'Missing yield unit',
    tasks: 'Task lineage', tasksDescription: 'Explicit source lineage on canonical operational tasks.', sourced: 'With source', missingId: 'Source without ID', missingPath: 'Source without path', observed: 'Observed',
  },
  es: {
    title: 'Salud de datos canónicos', description: 'Cobertura observada y campos canónicos faltantes. Son conteos, no scores sintéticos de calidad.', unavailable: 'Snapshot de salud de datos no disponible.',
    booking: 'Reservas', bookingDescription: 'Última ejecución canónica de booking health.', noRun: 'No hay ninguna ejecución de booking health registrada.', runs: 'Ejecuciones', checks: 'Checks', passed: 'Aprobados', warnings: 'Advertencias', critical: 'Críticos', latest: 'Última ejecución',
    vehicles: 'Registro de vehículos', vehiclesDescription: 'Cobertura informada por la vista canónica de salud del registro vehicular.', total: 'Total', incomplete: 'Con campos faltantes', identity: 'Identidad', classification: 'Clasificación', costCenter: 'Centro de costo', team: 'Equipo responsable',
    orchard: 'Biblioteca de cultivos · Fundo Corcovado', orchardDescription: 'Completitud de la capa canónica de 70 perfiles de Orchard; lo ausente se muestra como desconocido, no se infiere.', profiles: 'Perfiles canónicos', dtm: 'Sin DTM', plantSpacing: 'Sin distancia de planta', rowSpacing: 'Sin distancia de hilera', yield: 'Sin rendimiento', yieldUnit: 'Sin unidad de rendimiento',
    tasks: 'Lineage de tareas', tasksDescription: 'Origen explícito de las tareas operativas canónicas.', sourced: 'Con origen', missingId: 'Origen sin ID', missingPath: 'Origen sin ruta', observed: 'Observado',
  },
  de: {
    title: 'Kanonische Datenqualität', description: 'Beobachtete Abdeckung und fehlende kanonische Felder. Dies sind Zählwerte, keine synthetischen Qualitätsscores.', unavailable: 'Snapshot zur Datenqualität nicht verfügbar.',
    booking: 'Reservierungen', bookingDescription: 'Letzte kanonische Ausführung der Booking-Prüfung.', noRun: 'Es wurde noch keine Booking-Prüfung aufgezeichnet.', runs: 'Ausführungen', checks: 'Prüfungen', passed: 'Bestanden', warnings: 'Warnungen', critical: 'Kritisch', latest: 'Letzte Ausführung',
    vehicles: 'Fahrzeugregister', vehiclesDescription: 'Abdeckung aus der kanonischen Zustandsansicht des Fahrzeugregisters.', total: 'Gesamt', incomplete: 'Mit fehlenden Feldern', identity: 'Identität', classification: 'Klassifizierung', costCenter: 'Kostenstelle', team: 'Verantwortliches Team',
    orchard: 'Pflanzenbibliothek · Fundo Corcovado', orchardDescription: 'Vollständigkeit der kanonischen Orchard-Schicht mit 70 Profilen; fehlende Werte werden als unbekannt angezeigt und nicht abgeleitet.', profiles: 'Kanonische Profile', dtm: 'DTM fehlt', plantSpacing: 'Pflanzabstand fehlt', rowSpacing: 'Reihenabstand fehlt', yield: 'Ertrag fehlt', yieldUnit: 'Ertragseinheit fehlt',
    tasks: 'Aufgabenherkunft', tasksDescription: 'Explizite Quellenbeziehung kanonischer operativer Aufgaben.', sourced: 'Mit Quelle', missingId: 'Quelle ohne ID', missingPath: 'Quelle ohne Pfad', observed: 'Beobachtet',
  },
} as const
const LOCALES = { en: 'en-US', es: 'es-CL', de: 'de-DE' } as const

export function ItDataHealth({ snapshot }: { snapshot: ItDataHealthSnapshot | null }) {
  const { language } = useLanguage()
  const text = COPY[language]
  const number = new Intl.NumberFormat(LOCALES[language])
  const observed = snapshot ? new Intl.DateTimeFormat(LOCALES[language], { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Santiago' }).format(new Date(snapshot.observed_at)) : null

  return <section className="space-y-4 px-4 pb-8 md:px-8">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">{text.title}</h2><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{text.description}</p></div>{observed && <p className="text-xs text-muted-foreground">{text.observed}: {observed}</p>}</div>
    {!snapshot ? <Card><CardContent className="py-6 text-sm text-muted-foreground">{text.unavailable}</CardContent></Card> : <div className="grid gap-4 xl:grid-cols-2">
      <HealthCard icon={CalendarCheck2} title={text.booking} description={text.bookingDescription}>
        <Metrics values={[[text.runs, snapshot.booking.run_count], [text.checks, snapshot.booking.latest?.total_checks ?? 0], [text.passed, snapshot.booking.latest?.passed_checks ?? 0], [text.warnings, snapshot.booking.latest?.warning_checks ?? 0], [text.critical, snapshot.booking.latest?.critical_checks ?? 0]]} number={number} />
        {snapshot.booking.latest ? <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline">{snapshot.booking.latest.status}</Badge><span>{text.latest}: {new Intl.DateTimeFormat(LOCALES[language], { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santiago' }).format(new Date(snapshot.booking.latest.executed_at))}</span></div> : <p className="mt-3 text-xs text-muted-foreground">{text.noRun}</p>}
      </HealthCard>
      <HealthCard icon={CarFront} title={text.vehicles} description={text.vehiclesDescription}><Metrics values={[[text.total,snapshot.vehicles.total],[text.incomplete,snapshot.vehicles.with_missing_fields],[text.identity,snapshot.vehicles.missing_identity],[text.classification,snapshot.vehicles.missing_classification],[text.costCenter,snapshot.vehicles.missing_cost_center],[text.team,snapshot.vehicles.missing_responsible_team]]} number={number}/></HealthCard>
      <HealthCard icon={Sprout} title={text.orchard} description={text.orchardDescription}><Metrics values={[[text.profiles,snapshot.orchard.canonical_profiles],[text.dtm,snapshot.orchard.missing_dtm],[text.plantSpacing,snapshot.orchard.missing_plant_spacing],[text.rowSpacing,snapshot.orchard.missing_row_spacing],[text.yield,snapshot.orchard.missing_yield],[text.yieldUnit,snapshot.orchard.missing_yield_unit]]} number={number}/></HealthCard>
      <HealthCard icon={ClipboardList} title={text.tasks} description={text.tasksDescription}><Metrics values={[[text.total,snapshot.tasks.total],[text.sourced,snapshot.tasks.sourced],[text.missingId,snapshot.tasks.sourced_missing_id],[text.missingPath,snapshot.tasks.sourced_missing_path]]} number={number}/></HealthCard>
    </div>}
  </section>
}
function HealthCard({icon:Icon,title,description,children}:{icon:typeof CalendarCheck2;title:string;description:string;children:React.ReactNode}){return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4"/>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent>{children}</CardContent></Card>}
function Metrics({values,number}:{values:Array<[string,number]>;number:Intl.NumberFormat}){return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{values.map(([label,value])=><div key={label} className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{number.format(value)}</p></div>)}</div>}

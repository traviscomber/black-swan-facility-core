'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Fuel, Loader2, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/hooks/use-language'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export type FleetRegistryRow = {
  id: string
  code: string | null
  name: string
  vehicle_type: string | null
  plate_number: string | null
  vin: string | null
  serial_number: string | null
  operational_class: string | null
  operational_subtype: string | null
  suggested_operational_class: string
  classification_status: string
  fuel_tracking_enabled: boolean
  maintenance_tracking_enabled: boolean
  missing_fields: string[] | null
}

type Locale = 'en' | 'es' | 'de'

const copy = {
  en: {
    legacyWarning: 'Historical truck/van classification is preserved only as reference. Fuel and maintenance costs must use the confirmed operational class.',
    registered: 'Registered equipment', pending: 'Pending classification', missingIdentity: 'Missing identity', fuelReady: 'Fuel tracking enabled',
    registry: 'Operational registry', equipment: 'Equipment', legacy: 'Legacy', operationalClass: 'Operational class', identity: 'Identity', control: 'Control',
    noCode: 'No code', noType: 'No type', other: 'Other', suggested: 'Suggested, not confirmed', identityPending: 'Pending',
    confirmTitle: 'Confirm classification', selectEquipment: 'Select equipment to review its classification.', legacyType: 'Legacy type', subtype: 'Subtype',
    subtypePlaceholder: 'e.g. buggy, generator, support boat', serial: 'Plate, VIN or serial', serialPlaceholder: 'Physical identifier',
    fuelTracking: 'Enable fuel tracking', reason: 'Classification reason', reasonPlaceholder: 'Physical review, technical sheet, inventory…', confirm: 'Confirm and audit',
    success: 'Classification confirmed and recorded in the audit trail.', saveError: 'Unable to confirm the classification.',
    classes: { road_vehicle: 'Road vehicle', machinery: 'Machinery', vessel: 'Vessel', small_equipment: 'Small equipment', drone: 'Drone', trailer: 'Trailer', other: 'Other' },
  },
  es: {
    legacyWarning: 'La clasificación histórica truck/van se conserva solo como referencia. Los costos de combustible y mantenimiento deben usar la clase operacional confirmada.',
    registered: 'Equipos registrados', pending: 'Pendientes de clasificar', missingIdentity: 'Sin identidad', fuelReady: 'Habilitados para combustible',
    registry: 'Registro operacional', equipment: 'Equipo', legacy: 'Legado', operationalClass: 'Clase operacional', identity: 'Identidad', control: 'Control',
    noCode: 'Sin código', noType: 'Sin tipo', other: 'Otro', suggested: 'Sugerida, no confirmada', identityPending: 'Pendiente',
    confirmTitle: 'Confirmar clasificación', selectEquipment: 'Selecciona un equipo para revisar su clasificación.', legacyType: 'Tipo legado', subtype: 'Subtipo',
    subtypePlaceholder: 'Ej. buggy, generador, bote de apoyo', serial: 'Patente, VIN o serie', serialPlaceholder: 'Identificador físico',
    fuelTracking: 'Habilitar seguimiento de combustible', reason: 'Motivo de clasificación', reasonPlaceholder: 'Revisión física, ficha técnica, inventario…', confirm: 'Confirmar y auditar',
    success: 'Clasificación confirmada y registrada en auditoría.', saveError: 'No fue posible confirmar la clasificación.',
    classes: { road_vehicle: 'Vehículo vial', machinery: 'Maquinaria', vessel: 'Embarcación', small_equipment: 'Equipo menor', drone: 'Dron', trailer: 'Remolque', other: 'Otro' },
  },
  de: {
    legacyWarning: 'Die historische Truck/Van-Klassifizierung bleibt nur als Referenz erhalten. Kraftstoff- und Wartungskosten müssen die bestätigte Betriebsklasse verwenden.',
    registered: 'Registrierte Geräte', pending: 'Klassifizierung ausstehend', missingIdentity: 'Identität fehlt', fuelReady: 'Für Kraftstoff freigegeben',
    registry: 'Betriebsregister', equipment: 'Gerät', legacy: 'Altklassifizierung', operationalClass: 'Betriebsklasse', identity: 'Identität', control: 'Kontrolle',
    noCode: 'Kein Code', noType: 'Kein Typ', other: 'Sonstige', suggested: 'Vorgeschlagen, nicht bestätigt', identityPending: 'Ausstehend',
    confirmTitle: 'Klassifizierung bestätigen', selectEquipment: 'Wähle ein Gerät aus, um seine Klassifizierung zu prüfen.', legacyType: 'Alter Typ', subtype: 'Untertyp',
    subtypePlaceholder: 'z. B. Buggy, Generator, Begleitboot', serial: 'Kennzeichen, VIN oder Seriennummer', serialPlaceholder: 'Physische Kennung',
    fuelTracking: 'Kraftstoffverfolgung aktivieren', reason: 'Begründung der Klassifizierung', reasonPlaceholder: 'Physische Prüfung, Datenblatt, Inventar…', confirm: 'Bestätigen und protokollieren',
    success: 'Klassifizierung bestätigt und im Audit-Protokoll erfasst.', saveError: 'Klassifizierung konnte nicht bestätigt werden.',
    classes: { road_vehicle: 'Straßenfahrzeug', machinery: 'Maschine', vessel: 'Wasserfahrzeug', small_equipment: 'Kleingerät', drone: 'Drohne', trailer: 'Anhänger', other: 'Sonstige' },
  },
} as const

export function FleetRegistryConsole({ rows }: { rows: FleetRegistryRow[] }) {
  const router = useRouter()
  const supabase = createClient()
  const { language } = useLanguage()
  const lang = language as Locale
  const text = copy[lang]
  const locale = lang === 'es' ? 'es-CL' : lang === 'de' ? 'de-DE' : 'en-US'
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [operationalClass, setOperationalClass] = useState('')
  const [subtype, setSubtype] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [reason, setReason] = useState('')
  const [fuelEnabled, setFuelEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const pending = rows.filter((row) => row.classification_status !== 'confirmed').length
  const missingIdentity = rows.filter((row) => row.missing_fields?.includes('identity')).length
  const fuelReady = rows.filter((row) => row.classification_status === 'confirmed' && row.fuel_tracking_enabled).length
  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId])

  const classLabel = (value: string) => text.classes[value as keyof typeof text.classes] ?? text.other

  const choose = (row: FleetRegistryRow) => {
    setSelectedId(row.id)
    setOperationalClass(row.operational_class || row.suggested_operational_class)
    setSubtype(row.operational_subtype || '')
    setSerialNumber(row.serial_number || row.vin || '')
    setFuelEnabled(row.fuel_tracking_enabled)
    setReason('')
    setMessage(null)
  }

  const save = async () => {
    if (!selected || !operationalClass || !reason.trim()) return
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.rpc('confirm_vehicle_classification', {
      p_vehicle_id: selected.id,
      p_operational_class: operationalClass,
      p_operational_subtype: subtype || null,
      p_serial_number: serialNumber || null,
      p_fuel_tracking_enabled: fuelEnabled,
      p_reason: reason.trim(),
    })
    setSaving(false)
    if (error) {
      console.error('[fleet] classification confirmation failed', error)
      setMessage(text.saveError)
      return
    }
    setMessage(text.success)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Alert className="border-amber-300">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription>{text.legacyWarning}</AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title={text.registered} value={rows.length} locale={locale} />
        <Metric title={text.pending} value={pending} warning={pending > 0} locale={locale} />
        <Metric title={text.missingIdentity} value={missingIdentity} warning={missingIdentity > 0} locale={locale} />
        <Metric title={text.fuelReady} value={fuelReady} locale={locale} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <Card>
          <CardHeader><CardTitle>{text.registry}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>{text.equipment}</TableHead><TableHead>{text.legacy}</TableHead><TableHead>{text.operationalClass}</TableHead><TableHead>{text.identity}</TableHead><TableHead>{text.control}</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className={selectedId === row.id ? 'bg-muted/60' : undefined}>
                    <TableCell><button className="text-left" onClick={() => choose(row)}><span className="block font-medium">{row.name}</span><span className="text-xs text-muted-foreground">{row.code || text.noCode}</span></button></TableCell>
                    <TableCell><Badge variant="outline">{row.vehicle_type || text.noType}</Badge></TableCell>
                    <TableCell><div className="space-y-1"><Badge variant={row.classification_status === 'confirmed' ? 'secondary' : 'outline'}>{classLabel(row.operational_class || row.suggested_operational_class)}</Badge>{row.classification_status !== 'confirmed' && <p className="text-xs text-amber-700">{text.suggested}</p>}</div></TableCell>
                    <TableCell className="text-sm">{row.plate_number || row.vin || row.serial_number || <span className="text-amber-700">{text.identityPending}</span>}</TableCell>
                    <TableCell><div className="flex gap-2">{row.fuel_tracking_enabled && <Fuel className="h-4 w-4" />}{row.maintenance_tracking_enabled && <Wrench className="h-4 w-4" />}{row.classification_status === 'confirmed' && <CheckCircle2 className="h-4 w-4" />}</div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{text.confirmTitle}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!selected ? <p className="text-sm text-muted-foreground">{text.selectEquipment}</p> : <>
              <div><p className="font-medium">{selected.name}</p><p className="text-xs text-muted-foreground">{text.legacyType}: {selected.vehicle_type || text.noType.toLocaleLowerCase(locale)}</p></div>
              <div className="space-y-2"><Label>{text.operationalClass}</Label><Select value={operationalClass} onValueChange={setOperationalClass}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.keys(text.classes).map((value) => <SelectItem key={value} value={value}>{classLabel(value)}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>{text.subtype}</Label><Input value={subtype} onChange={(event) => setSubtype(event.target.value)} placeholder={text.subtypePlaceholder} /></div>
              <div className="space-y-2"><Label>{text.serial}</Label><Input value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} placeholder={text.serialPlaceholder} /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fuelEnabled} onChange={(event) => setFuelEnabled(event.target.checked)} /> {text.fuelTracking}</label>
              <div className="space-y-2"><Label>{text.reason}</Label><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={text.reasonPlaceholder} /></div>
              {message && <p className="text-sm text-muted-foreground">{message}</p>}
              <Button className="w-full" disabled={saving || !operationalClass || !reason.trim()} onClick={save}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{text.confirm}</Button>
            </>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Metric({ title, value, locale, warning = false }: { title: string; value: number; locale: string; warning?: boolean }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><p className={warning ? 'text-2xl font-semibold text-amber-700' : 'text-2xl font-semibold'}>{value.toLocaleString(locale)}</p></CardContent></Card>
}

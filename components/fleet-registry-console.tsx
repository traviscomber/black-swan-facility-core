'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Fuel, Loader2, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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

const classLabels: Record<string, string> = {
  road_vehicle: 'Vehículo vial',
  machinery: 'Maquinaria',
  vessel: 'Embarcación',
  small_equipment: 'Equipo menor',
  drone: 'Dron',
  trailer: 'Remolque',
  other: 'Otro',
}

export function FleetRegistryConsole({ rows }: { rows: FleetRegistryRow[] }) {
  const router = useRouter()
  const supabase = createClient()
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
      setMessage(error.message)
      return
    }
    setMessage('Clasificación confirmada y registrada en auditoría.')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Alert className="border-amber-300">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription>
          La clasificación histórica truck/van se conserva solo como referencia. Costos de combustible y mantenimiento deben usar la clase operacional confirmada.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Equipos registrados" value={rows.length} />
        <Metric title="Pendientes de clasificar" value={pending} warning={pending > 0} />
        <Metric title="Sin identidad" value={missingIdentity} warning={missingIdentity > 0} />
        <Metric title="Habilitados para combustible" value={fuelReady} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <Card>
          <CardHeader><CardTitle>Registro operacional</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Equipo</TableHead><TableHead>Legado</TableHead><TableHead>Clase operacional</TableHead><TableHead>Identidad</TableHead><TableHead>Control</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className={selectedId === row.id ? 'bg-muted/60' : undefined}>
                    <TableCell><button className="text-left" onClick={() => choose(row)}><span className="block font-medium">{row.name}</span><span className="text-xs text-muted-foreground">{row.code || 'Sin código'}</span></button></TableCell>
                    <TableCell><Badge variant="outline">{row.vehicle_type || 'Sin tipo'}</Badge></TableCell>
                    <TableCell>
                      <div className="space-y-1"><Badge variant={row.classification_status === 'confirmed' ? 'secondary' : 'outline'}>{classLabels[row.operational_class || row.suggested_operational_class] || 'Otro'}</Badge>{row.classification_status !== 'confirmed' && <p className="text-xs text-amber-700">Sugerida, no confirmada</p>}</div>
                    </TableCell>
                    <TableCell className="text-sm">{row.plate_number || row.vin || row.serial_number || <span className="text-amber-700">Pendiente</span>}</TableCell>
                    <TableCell><div className="flex gap-2">{row.fuel_tracking_enabled && <Fuel className="h-4 w-4" />}{row.maintenance_tracking_enabled && <Wrench className="h-4 w-4" />}{row.classification_status === 'confirmed' && <CheckCircle2 className="h-4 w-4" />}</div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Confirmar clasificación</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!selected ? <p className="text-sm text-muted-foreground">Selecciona un equipo para revisar su clasificación.</p> : <>
              <div><p className="font-medium">{selected.name}</p><p className="text-xs text-muted-foreground">Tipo legado: {selected.vehicle_type || 'sin tipo'}</p></div>
              <div className="space-y-2"><Label>Clase operacional</Label><Select value={operationalClass} onValueChange={setOperationalClass}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(classLabels).map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Subtipo</Label><Input value={subtype} onChange={(event) => setSubtype(event.target.value)} placeholder="Ej. buggy, generador, bote de apoyo" /></div>
              <div className="space-y-2"><Label>Patente, VIN o serie</Label><Input value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} placeholder="Identificador físico" /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fuelEnabled} onChange={(event) => setFuelEnabled(event.target.checked)} /> Habilitar seguimiento de combustible</label>
              <div className="space-y-2"><Label>Motivo de clasificación</Label><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Revisión física, ficha técnica, inventario..." /></div>
              {message && <p className="text-sm text-muted-foreground">{message}</p>}
              <Button className="w-full" disabled={saving || !operationalClass || !reason.trim()} onClick={save}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar y auditar</Button>
            </>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Metric({ title, value, warning = false }: { title: string; value: number; warning?: boolean }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><p className={warning ? 'text-2xl font-semibold text-amber-700' : 'text-2xl font-semibold'}>{value.toLocaleString('es-CL')}</p></CardContent></Card>
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type FuelRecord = {
  id: string
  date_recorded: string
  liters: number | null
  cost_pesos: number | null
  fuel_type: string | null
  location: string | null
  odometer_reading: number | null
  source: string | null
  validation_status: string | null
  vehicle?: { name?: string | null; code?: string | null } | null
}

export function FuelValidationReview({ records }: { records: FuelRecord[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const review = async (id: string, decision: 'verified' | 'rejected') => {
    const note = notes[id]?.trim() || null
    if (decision === 'rejected' && !note) {
      setError('Debes registrar el motivo para rechazar un consumo.')
      return
    }

    setBusyId(id)
    setError(null)
    const { error: rpcError } = await supabase.rpc('review_fuel_consumption', {
      p_fuel_consumption_id: id,
      p_decision: decision,
      p_notes: note,
    })
    setBusyId(null)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    router.refresh()
  }

  if (records.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Validación de consumos</CardTitle>
          <CardDescription>No existen registros pendientes de revisión.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Validación de consumos</CardTitle>
        <CardDescription>
          Solo los registros aprobados ingresan a KPI, costos y análisis operacionales. El rechazo exige motivo y conserva el registro para auditoría.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Vehículo</TableHead>
                <TableHead className="text-right">Litros</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead>Calidad de datos</TableHead>
                <TableHead>Observación</TableHead>
                <TableHead className="text-right">Decisión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => {
                const incomplete = !record.location || record.odometer_reading == null
                const busy = busyId === record.id
                return (
                  <TableRow key={record.id}>
                    <TableCell>{new Date(`${record.date_recorded}T12:00:00`).toLocaleDateString('es-CL')}</TableCell>
                    <TableCell>
                      <p className="font-medium">{record.vehicle?.name || 'Vehículo no identificado'}</p>
                      <p className="text-xs text-muted-foreground">{record.vehicle?.code || record.source || 'Sin código'}</p>
                    </TableCell>
                    <TableCell className="text-right">{Number(record.liters || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 })} L</TableCell>
                    <TableCell className="text-right">{Number(record.cost_pesos || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}</TableCell>
                    <TableCell><Badge variant={incomplete ? 'outline' : 'secondary'}>{incomplete ? 'Incompleto' : 'Completo'}</Badge></TableCell>
                    <TableCell className="min-w-64">
                      <Input
                        value={notes[record.id] || ''}
                        onChange={(event) => setNotes((current) => ({ ...current, [record.id]: event.target.value }))}
                        placeholder={incomplete ? 'Completar o justificar datos faltantes' : 'Observación opcional'}
                        disabled={busy}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => review(record.id, 'rejected')} disabled={busy}>
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                          Rechazar
                        </Button>
                        <Button size="sm" onClick={() => review(record.id, 'verified')} disabled={busy || incomplete}>
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Verificar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

interface MaintenanceQuickAddDrawerProps {
  isOpen: boolean
  onClose: () => void
  onTaskCreated: () => void
}

type Option = { id: string; name: string }

const initialForm = () => ({
  title: '',
  description: '',
  asset_id: 'none',
  assigned_to: 'none',
  prioridad: 'medium',
  duracion_estimada_minutos: '30',
  tipo_trabajo: 'maintenance',
  fecha_objetivo: new Date().toISOString().slice(0, 10),
})

export function MaintenanceQuickAddDrawer({ isOpen, onClose, onTaskCreated }: MaintenanceQuickAddDrawerProps) {
  const supabase = useMemo(() => createClient(), [])
  const [assets, setAssets] = useState<Option[]>([])
  const [employees, setEmployees] = useState<Option[]>([])
  const [formData, setFormData] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    async function loadOptions() {
      setLoadingOptions(true)
      setError(null)
      const [assetsResult, employeesResult] = await Promise.all([
        supabase.from('assets').select('id, name').order('name'),
        supabase.from('employees').select('id, name').eq('is_active', true).order('name'),
      ])

      if (cancelled) return
      const loadError = assetsResult.error || employeesResult.error
      if (loadError) setError(`No fue posible cargar activos o responsables: ${loadError.message}`)
      setAssets((assetsResult.data ?? []) as Option[])
      setEmployees((employeesResult.data ?? []) as Option[])
      setLoadingOptions(false)
    }

    void loadOptions()
    return () => { cancelled = true }
  }, [isOpen, supabase])

  function updateField(name: string, value: string) {
    setFormData((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!formData.title.trim()) {
      setError('El título del trabajo es obligatorio.')
      return
    }

    const duration = Number.parseInt(formData.duracion_estimada_minutos, 10)
    if (!Number.isFinite(duration) || duration < 5) {
      setError('La duración estimada debe ser de al menos 5 minutos.')
      return
    }

    setLoading(true)
    setError(null)
    const { error: insertError } = await supabase.from('maintenance_tasks').insert({
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      asset_id: formData.asset_id === 'none' ? null : formData.asset_id,
      assigned_to: formData.assigned_to === 'none' ? null : formData.assigned_to,
      prioridad: formData.prioridad,
      estado_extendido: formData.assigned_to === 'none' ? 'scheduled' : 'assigned',
      status: formData.assigned_to === 'none' ? 'scheduled' : 'assigned',
      duracion_estimada_minutos: duration,
      tipo_trabajo: formData.tipo_trabajo,
      fecha_objetivo: formData.fecha_objetivo,
      next_run: formData.fecha_objetivo,
      bloqueado: false,
    })

    if (insertError) {
      setError(`No fue posible registrar el trabajo: ${insertError.message}`)
      setLoading(false)
      return
    }

    setFormData(initialForm())
    setLoading(false)
    onTaskCreated()
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      <button type="button" aria-label="Cerrar formulario" className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l bg-background shadow-xl">
        <div className="flex items-start justify-between border-b p-5">
          <div>
            <h2 className="text-lg font-semibold">Registrar trabajo</h2>
            <p className="mt-1 text-sm text-muted-foreground">Crea una orden preventiva o correctiva para Fundo Corcovado.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar"><X className="h-4 w-4" /></Button>
        </div>

        <form id="maintenance-quick-add" onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-5">
          {error && <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}

          <Field label="Título" required><Input value={formData.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Ej. Revisar bomba de agua" /></Field>
          <Field label="Descripción"><textarea value={formData.description} onChange={(event) => updateField('description', event.target.value)} rows={4} className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Detalle del trabajo, condición observada y resultado esperado" /></Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de trabajo">
              <select value={formData.tipo_trabajo} onChange={(event) => updateField('tipo_trabajo', event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="cleaning">Limpieza</option><option value="inspection">Inspección</option><option value="repair">Reparación</option><option value="maintenance">Mantenimiento</option><option value="installation">Instalación</option>
              </select>
            </Field>
            <Field label="Prioridad">
              <select value={formData.prioridad} onChange={(event) => updateField('prioridad', event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha objetivo" required><Input type="date" value={formData.fecha_objetivo} onChange={(event) => updateField('fecha_objetivo', event.target.value)} /></Field>
            <Field label="Duración estimada (min)" required><Input type="number" min="5" step="5" value={formData.duracion_estimada_minutos} onChange={(event) => updateField('duracion_estimada_minutos', event.target.value)} /></Field>
          </div>

          <Field label="Activo asociado">
            <select disabled={loadingOptions} value={formData.asset_id} onChange={(event) => updateField('asset_id', event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="none">Sin activo asociado</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
          </Field>

          <Field label="Responsable">
            <select disabled={loadingOptions} value={formData.assigned_to} onChange={(event) => updateField('assigned_to', event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="none">Sin responsable asignado</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
          </Field>
        </form>

        <div className="flex gap-2 border-t p-5">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="maintenance-quick-add" className="flex-1" disabled={loading || loadingOptions || !formData.title.trim()}><Plus className="mr-2 h-4 w-4" />{loading ? 'Registrando…' : 'Registrar trabajo'}</Button>
        </div>
      </aside>
    </>
  )
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}{required ? ' *' : ''}</Label>{children}</div>
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useEffectiveAccess } from '@/lib/hooks/use-effective-access'
import { createClient } from '@/lib/supabase/client'

interface MaintenanceQuickAddDrawerProps {
  isOpen: boolean
  onClose: () => void
  onTaskCreated: () => void
}

type AssetOption = { id: string; name: string; asset_code: string; warehouse_location_id: string | null; status: string | null }
type EmployeeOption = { employee_id: string; employee_name: string; employee_role: string | null }

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
  const { access, loading: loadingAccess, error: accessError, can } = useEffectiveAccess()
  const [assets, setAssets] = useState<AssetOption[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [formData, setFormData] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const locationScoped = access.has_explicit_scopes && access.location_ids.length > 0
  const canMaintain = can('maintenance.operate')
  const canMaintainAssets = canMaintain && can('inventory.process')

  useEffect(() => {
    if (!isOpen || loadingAccess) return
    let cancelled = false

    async function loadOptions() {
      if (accessError) {
        setError('No fue posible validar tus permisos de mantenimiento.')
        return
      }
      if (!canMaintain) {
        setError('No tienes permiso para registrar trabajos de mantenimiento.')
        return
      }
      setLoadingOptions(true)
      setError(null)
      const [assetsResult, employeesResult] = await Promise.all([
        supabase.from('assets').select('id, name, asset_code, warehouse_location_id, status').neq('status', 'deprecated').order('name'),
        supabase.rpc('list_maintenance_assignees'),
      ])

      if (cancelled) return
      const loadError = assetsResult.error || employeesResult.error
      if (loadError) setError(`No fue posible cargar activos o responsables: ${loadError.message}`)
      setAssets((assetsResult.data ?? []) as AssetOption[])
      setEmployees((employeesResult.data ?? []) as EmployeeOption[])
      setLoadingOptions(false)
    }

    void loadOptions()
    return () => { cancelled = true }
  }, [accessError, canMaintain, isOpen, loadingAccess, supabase])

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

    const selectedAsset = formData.asset_id === 'none' ? null : assets.find((asset) => asset.id === formData.asset_id) ?? null
    if (formData.asset_id !== 'none' && !selectedAsset) {
      setError('El activo seleccionado ya no está disponible.')
      return
    }
    if (selectedAsset && !selectedAsset.warehouse_location_id) {
      setError('El activo debe tener una posición de bodega antes de programar mantenimiento.')
      return
    }
    if (locationScoped && !selectedAsset) {
      setError('Tu acceso está limitado por ubicación. Selecciona un activo con posición registrada.')
      return
    }
    if (selectedAsset && !canMaintainAssets) {
      setError('El mantenimiento de activos requiere permisos de Mantenimiento e Inventario.')
      return
    }

    setLoading(true)
    setError(null)

    let saveError: { message: string } | null = null
    if (selectedAsset) {
      const result = await supabase.rpc('create_inventory_asset_maintenance_task', {
        p_asset_id: selectedAsset.id,
        p_title: formData.title.trim(),
        p_description: formData.description.trim() || null,
        p_assigned_to: formData.assigned_to === 'none' ? null : formData.assigned_to,
        p_priority: formData.prioridad,
        p_duration_minutes: duration,
        p_work_type: formData.tipo_trabajo,
        p_target_date: formData.fecha_objetivo,
      })
      saveError = result.error
    } else {
      const result = await supabase.from('maintenance_tasks').insert({
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        asset_id: null,
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
      saveError = result.error
    }

    if (saveError) {
      setError(`No fue posible registrar el trabajo: ${saveError.message}`)
      setLoading(false)
      return
    }

    setFormData(initialForm())
    setLoading(false)
    onTaskCreated()
    onClose()
  }

  if (!isOpen) return null

  const selectedAsset = formData.asset_id === 'none' ? null : assets.find((asset) => asset.id === formData.asset_id) ?? null

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
            <Field label="Fecha objetivo" required><Input type="date" min={new Date().toISOString().slice(0, 10)} value={formData.fecha_objetivo} onChange={(event) => updateField('fecha_objetivo', event.target.value)} /></Field>
            <Field label="Duración estimada (min)" required><Input type="number" min="5" step="5" value={formData.duracion_estimada_minutos} onChange={(event) => updateField('duracion_estimada_minutos', event.target.value)} /></Field>
          </div>

          <Field label="Activo asociado">
            <select disabled={loadingOptions} value={formData.asset_id} onChange={(event) => updateField('asset_id', event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="none">{locationScoped ? 'Selecciona un activo con ubicación' : 'Sin activo asociado'}</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.asset_code} · {asset.name}{asset.warehouse_location_id ? '' : ' · Sin posición'}</option>)}
            </select>
          </Field>

          {locationScoped && !selectedAsset && <p className="text-xs text-amber-800">Tu perfil está limitado por ubicación; el activo establece el alcance operativo del trabajo.</p>}
          {selectedAsset && !canMaintainAssets && <p className="text-xs text-destructive">Necesitas permisos de Mantenimiento e Inventario para programar trabajo sobre activos.</p>}

          {selectedAsset && <div className={`rounded-lg border p-3 text-sm ${selectedAsset.warehouse_location_id ? 'bg-muted/20' : 'border-amber-300 bg-amber-50/60'}`}>
            <p className="font-medium">Orden vinculada a Inventario</p>
            <p className="mt-1 text-xs text-muted-foreground">La creación y los cambios de estado se ejecutan de forma atómica y quedan en la bitácora del activo.</p>
            {!selectedAsset.warehouse_location_id && <p className="mt-2 text-xs text-amber-800">Completa primero la ubicación física del activo.</p>}
          </div>}

          <Field label="Responsable">
            <select disabled={loadingOptions} value={formData.assigned_to} onChange={(event) => updateField('assigned_to', event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="none">Sin responsable asignado</option>{employees.map((employee) => <option key={employee.employee_id} value={employee.employee_id}>{employee.employee_name}{employee.employee_role ? ` · ${employee.employee_role}` : ''}</option>)}
            </select>
          </Field>
        </form>

        <div className="flex gap-2 border-t p-5">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="maintenance-quick-add" className="flex-1" disabled={loading || loadingOptions || loadingAccess || Boolean(accessError) || !canMaintain || !formData.title.trim() || Boolean(locationScoped && !selectedAsset) || Boolean(selectedAsset && (!selectedAsset.warehouse_location_id || !canMaintainAssets))}><Plus className="mr-2 h-4 w-4" />{loading ? 'Registrando…' : 'Registrar trabajo'}</Button>
        </div>
      </aside>
    </>
  )
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}{required ? ' *' : ''}</Label>{children}</div>
}

'use client'

import React from "react"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createBrowserClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

interface Activity {
  id: string
  title: string
  activity_type_id: string
  start_date: string
  start_time: string | null
  end_date: string | null
  end_time: string | null
  description: string
  location: string
  capacity: number
  current_attendees: number
  color_override: string | null
  status: string
  recurring: boolean
  recurring_pattern: string | null
  recurring_end_date: string | null
  notes: any[]
}

interface ActivityType {
  id: string
  name: string
  color: string
  icon: string
}

interface ActivityFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activityTypes: ActivityType[]
  editingActivity: Activity | null
  selectedDate: Date | null
  onActivitySaved?: () => void
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

export function ActivityFormDialog({
  open,
  onOpenChange,
  activityTypes,
  editingActivity,
  selectedDate,
  onActivitySaved,
}: ActivityFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createBrowserClient()

  const [formData, setFormData] = useState({
    title: '',
    activity_type_id: '',
    start_date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    start_time: '10:00',
    end_date: '',
    end_time: '12:00',
    description: '',
    location: '',
    capacity: '',
    current_attendees: '',
    color_override: '',
    status: 'scheduled',
    recurring: false,
    recurring_pattern: 'weekly',
    recurring_end_date: '',
  })

  useEffect(() => {
    if (editingActivity) {
      setFormData({
        title: editingActivity.title,
        activity_type_id: editingActivity.activity_type_id,
        start_date: editingActivity.start_date,
        start_time: editingActivity.start_time || '10:00',
        end_date: editingActivity.end_date || '',
        end_time: editingActivity.end_time || '12:00',
        description: editingActivity.description,
        location: editingActivity.location,
        capacity: editingActivity.capacity?.toString() || '',
        current_attendees: editingActivity.current_attendees?.toString() || '',
        color_override: editingActivity.color_override || '',
        status: editingActivity.status,
        recurring: editingActivity.recurring,
        recurring_pattern: editingActivity.recurring_pattern || 'weekly',
        recurring_end_date: editingActivity.recurring_end_date || '',
      })
    } else {
      // Initialize with first activity type when dialog opens
      const firstTypeId = activityTypes.length > 0 ? activityTypes[0].id : ''
      setFormData((prev) => ({
        ...prev,
        activity_type_id: firstTypeId,
        start_date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      }))
    }
  }, [editingActivity, selectedDate, open, activityTypes])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Validate required fields
      if (!formData.title.trim()) {
        throw new Error('El título es requerido')
      }
      if (!formData.activity_type_id) {
        throw new Error('El tipo de actividad es requerido')
      }
      if (!formData.start_date) {
        throw new Error('La fecha de inicio es requerida')
      }

      // Get current user for created_by field (only on insert)
      let userId: string | null = null
      if (!editingActivity) {
        const { data: { user } } = await supabase.auth.getUser()
        userId = user?.id || null
      }

      const payload: any = {
        title: formData.title.trim(),
        activity_type_id: formData.activity_type_id,
        start_date: formData.start_date,
        start_time: formData.start_time || null,
        end_date: formData.end_date?.trim() ? formData.end_date : null,
        end_time: formData.end_time || null,
        description: formData.description?.trim() || null,
        location: formData.location?.trim() || null,
        capacity: formData.capacity ? parseInt(formData.capacity, 10) : null,
        current_attendees: formData.current_attendees ? parseInt(formData.current_attendees, 10) : 0,
        color_override: formData.color_override?.trim() || null,
        status: formData.status,
        recurring: formData.recurring,
        recurring_pattern: formData.recurring ? formData.recurring_pattern : null,
        recurring_end_date: formData.recurring && formData.recurring_end_date?.trim() ? formData.recurring_end_date : null,
      }

      if (!editingActivity && userId) {
        payload.created_by = userId
      }

      if (editingActivity) {
        const { error: updateError } = await supabase
          .from('activities')
          .update(payload)
          .eq('id', editingActivity.id)

        if (updateError) {
          console.error('[v0] Update error:', updateError)
          throw updateError
        }
      } else {
        const { data, error: insertError } = await supabase
          .from('activities')
          .insert([payload])
          .select()

        if (insertError) {
          console.error('[v0] Insert error:', insertError)
          throw insertError
        }

        console.log('[v0] Activity created:', data)
      }

      onOpenChange(false)
      onActivitySaved?.()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error guardando actividad'
      console.error('[v0] Save error:', errorMessage)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl max-h-[95vh] overflow-y-auto p-4 md:p-6">
        <DialogHeader>
          <DialogTitle>{editingActivity ? 'Editar Actividad' : 'Nueva Actividad'}</DialogTitle>
          <DialogDescription>Crea o modifica una actividad del calendario</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-destructive/20 text-destructive rounded-md text-sm">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Título" required>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: Fiesta de Verano"
                required
              />
            </FormField>

            <FormField label="Tipo de Actividad" required>
              <select
                value={formData.activity_type_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, activity_type_id: e.target.value }))}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                required
              >
                <option value="">-- Selecciona un tipo --</option>
                {activityTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.icon} {type.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Fecha Inicio" required>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value }))}
                required
              />
            </FormField>

            <FormField label="Hora Inicio">
              <Input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData((prev) => ({ ...prev, start_time: e.target.value }))}
              />
            </FormField>

            <FormField label="Fecha Fin">
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, end_date: e.target.value }))}
              />
            </FormField>

            <FormField label="Hora Fin">
              <Input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData((prev) => ({ ...prev, end_time: e.target.value }))}
              />
            </FormField>

            <FormField label="Ubicación">
              <Input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="Ej: Jardín trasero"
              />
            </FormField>

            <FormField label="Capacidad (Personas)">
              <Input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData((prev) => ({ ...prev, capacity: e.target.value }))}
                placeholder="0"
              />
            </FormField>

            <FormField label="Asistentes Confirmados">
              <Input
                type="number"
                value={formData.current_attendees}
                onChange={(e) => setFormData((prev) => ({ ...prev, current_attendees: e.target.value }))}
                placeholder="0"
              />
            </FormField>

            <FormField label="Estado">
              <select
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
              >
                <option value="scheduled">Programada</option>
                <option value="in_progress">En Curso</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </FormField>

            <FormField label="Color Personalizado">
              <Input
                type="color"
                value={formData.color_override || '#726658'}
                onChange={(e) => setFormData((prev) => ({ ...prev, color_override: e.target.value }))}
              />
            </FormField>
          </div>

          <FormField label="Descripción">
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm resize-none"
              placeholder="Detalles adicionales sobre la actividad"
              rows={3}
            />
          </FormField>

          {/* Recurring Options */}
          <div className="space-y-3 p-3 bg-secondary/20 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.recurring}
                onChange={(e) => setFormData((prev) => ({ ...prev, recurring: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm font-medium">¿Es una actividad recurrente?</span>
            </label>

            {formData.recurring && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Patrón de Recurrencia">
                  <select
                    value={formData.recurring_pattern}
                    onChange={(e) => setFormData((prev) => ({ ...prev, recurring_pattern: e.target.value }))}
                    className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                  >
                    <option value="daily">Diaria</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                  </select>
                </FormField>

                <FormField label="Terminar En">
                  <Input
                    type="date"
                    value={formData.recurring_end_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, recurring_end_date: e.target.value }))}
                  />
                </FormField>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? 'Guardando...' : editingActivity ? 'Actualizar' : 'Crear Actividad'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

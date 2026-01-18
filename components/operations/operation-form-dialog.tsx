'use client'

import React from "react"

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/form-field'
import { createBrowserClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

interface Vehicle {
  id: string
  name: string
  code: string
}

interface OperationFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicles: Vehicle[]
  onOperationCreated?: () => void
}

export function OperationFormDialog({
  open,
  onOpenChange,
  vehicles,
  onOperationCreated,
}: OperationFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [kmzFile, setKmzFile] = useState<File | null>(null)
  const [uploadingKmz, setUploadingKmz] = useState(false)
  const supabase = createBrowserClient()

  const [formData, setFormData] = useState({
    title: '',
    operation_type: 'vehicle_trip',
    vehicle_id: vehicles[0]?.id || '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '09:00',
    end_date: format(new Date(), 'yyyy-MM-dd'),
    end_time: '17:00',
    location: '',
    distance_km: '',
    duration_hours: '',
    assigned_to: '',
    notes: '',
  })

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '').slice(0, 10)
    setFormData((prev) => ({
      ...prev,
      assigned_to: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const month = format(new Date(formData.start_date), 'yyyy-MM-01')
      const start_datetime = `${formData.start_date}T${formData.start_time}:00`
      const end_datetime = `${formData.end_date}T${formData.end_time}:00`

      // Generate operation code
      const timestamp = Date.now().toString().slice(-6)
      const operation_code = `OP-${timestamp}`

      const { data: operationData, error: insertError } = await supabase.from('operations').insert({
        operation_code,
        title: formData.title,
        operation_type: formData.operation_type,
        vehicle_id: formData.vehicle_id,
        start_date: start_datetime,
        end_date: end_datetime,
        location: formData.location,
        distance_km: formData.distance_km ? parseFloat(formData.distance_km) : null,
        duration_hours: formData.duration_hours ? parseFloat(formData.duration_hours) : null,
        assigned_to: formData.assigned_to || null,
        status: 'planned',
        month,
        notes: formData.notes,
      }).select().single()

      if (insertError) throw insertError

      // Upload KMZ file if provided
      if (kmzFile && operationData) {
        setUploadingKmz(true)
        const fileName = `${operation_code}/${kmzFile.name}`
        
        const { error: uploadError } = await supabase.storage
          .from('operations-kmz')
          .upload(fileName, kmzFile, { upsert: false })

        if (uploadError) throw uploadError

        // Get public URL
        const { data: publicUrl } = supabase.storage
          .from('operations-kmz')
          .getPublicUrl(fileName)

        // Save KMZ reference to database
        await supabase.from('operation_kmz_files').insert({
          operation_id: operationData.id,
          kmz_name: kmzFile.name,
          file_url: publicUrl.publicUrl,
          file_path: fileName,
          file_size: kmzFile.size,
          file_type: 'kmz',
        })
      }

      // Reset form
      setFormData({
        title: '',
        operation_type: 'vehicle_trip',
        vehicle_id: vehicles[0]?.id || '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '09:00',
        end_date: format(new Date(), 'yyyy-MM-dd'),
        end_time: '17:00',
        location: '',
        distance_km: '',
        duration_hours: '',
        assigned_to: '',
        notes: '',
      })
      setKmzFile(null)

      onOpenChange(false)
      onOperationCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando operación')
    } finally {
      setLoading(false)
      setUploadingKmz(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl max-h-[95vh] overflow-y-auto p-4 md:p-6">
        <DialogHeader>
          <DialogTitle>Nueva Operación</DialogTitle>
          <DialogDescription>Crear una nueva operación o viaje</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/20 text-destructive rounded-md text-sm">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Título" required>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                placeholder="Ej: Viaje a Finca"
                required
              />
            </FormField>

            <FormField label="Tipo de Operación" required>
              <select
                value={formData.operation_type}
                onChange={(e) => setFormData((prev) => ({ ...prev, operation_type: e.target.value }))}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
              >
                <option value="vehicle_trip">Viaje de Vehículo</option>
                <option value="field_operation">Operación de Campo</option>
                <option value="survey">Levantamiento</option>
                <option value="inspection">Inspección</option>
                <option value="maintenance">Mantenimiento</option>
                <option value="other">Otro</option>
              </select>
            </FormField>

            <FormField label="Vehículo" required>
              <select
                value={formData.vehicle_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, vehicle_id: e.target.value }))}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.code})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Ubicación">
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                placeholder="Ej: Finca Norte"
              />
            </FormField>

            <FormField label="Fecha Inicio" required>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value }))}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                required
              />
            </FormField>

            <FormField label="Hora Inicio" required>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData((prev) => ({ ...prev, start_time: e.target.value }))}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                required
              />
            </FormField>

            <FormField label="Fecha Fin">
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, end_date: e.target.value }))}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
              />
            </FormField>

            <FormField label="Hora Fin">
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData((prev) => ({ ...prev, end_time: e.target.value }))}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
              />
            </FormField>

            <FormField label="Distancia (km)">
              <input
                type="number"
                step="0.1"
                value={formData.distance_km}
                onChange={(e) => setFormData((prev) => ({ ...prev, distance_km: e.target.value }))}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                placeholder="0.0"
              />
            </FormField>

            <FormField label="Duración (horas)">
              <input
                type="number"
                step="0.1"
                value={formData.duration_hours}
                onChange={(e) => setFormData((prev) => ({ ...prev, duration_hours: e.target.value }))}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                placeholder="0.0"
              />
            </FormField>

            <FormField label="Responsable">
              <input
                type="text"
                value={formData.assigned_to}
                onChange={(e) => setFormData((prev) => ({ ...prev, assigned_to: e.target.value }))}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                placeholder="Nombre del responsable"
              />
            </FormField>
          </div>

          <FormField label="Notas">
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm resize-none"
              placeholder="Notas adicionales sobre la operación"
              rows={3}
            />
          </FormField>

          <FormField label="Archivo KMZ (Opcional)">
            <div className="space-y-2">
              <input
                type="file"
                accept=".kmz"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file && file.name.endsWith('.kmz')) {
                    setKmzFile(file)
                  } else {
                    setError('Por favor selecciona un archivo .kmz válido')
                    setKmzFile(null)
                  }
                }}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm cursor-pointer"
              />
              {kmzFile && (
                <div className="flex items-center justify-between p-2 bg-accent/10 rounded-md text-sm">
                  <span className="text-foreground">{kmzFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setKmzFile(null)}
                    className="text-destructive hover:underline"
                  >
                    Remover
                  </button>
                </div>
              )}
            </div>
          </FormField>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || uploadingKmz} className="w-full sm:w-auto">
              {loading || uploadingKmz ? 'Procesando...' : 'Crear Operación'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

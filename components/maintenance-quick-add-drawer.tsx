'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/hooks/use-language'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface MaintenanceQuickAddDrawerProps {
  isOpen: boolean
  onClose: () => void
  onTaskCreated: () => void
}

export function MaintenanceQuickAddDrawer({
  isOpen,
  onClose,
  onTaskCreated,
}: MaintenanceQuickAddDrawerProps) {
  const { t } = useLanguage()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    asset_id: '',
    priority: 'medium',
    duration_minutes: '30',
    type: 'maintenance',
  })

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      alert('Task title is required')
      return
    }

    try {
      setLoading(true)
      
      const { error } = await supabase.from('maintenance_tasks').insert([
        {
          title: formData.title,
          asset_id: formData.asset_id || null,
          priority: formData.priority,
          estado_extendido: 'scheduled',
          duracion_estimada_minutos: parseInt(formData.duration_minutes),
          tipo_trabajo: formData.type,
          fecha_objetivo: new Date().toISOString().split('T')[0],
          status: 'scheduled',
        },
      ])

      if (error) throw error

      // Reset form
      setFormData({
        title: '',
        asset_id: '',
        priority: 'medium',
        duration_minutes: '30',
        type: 'maintenance',
      })

      onTaskCreated()
      onClose()
    } catch (error) {
      console.error('[v0] Error creating task:', error)
      alert('Error creating task')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">{t('maintenance.add_task')}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Title */}
          <div>
            <Label htmlFor="title" className="text-sm font-medium">
              {t('common.name')} *
            </Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Task description"
              className="mt-1"
            />
          </div>

          {/* Priority */}
          <div>
            <Label htmlFor="priority" className="text-sm font-medium">
              {t('common.status')}
            </Label>
            <select
              id="priority"
              name="priority"
              value={formData.priority}
              onChange={handleInputChange}
              className="w-full mt-1 px-3 py-2 border rounded-md"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Duration */}
          <div>
            <Label htmlFor="duration_minutes" className="text-sm font-medium">
              {t('workorder.duration')}
            </Label>
            <Input
              id="duration_minutes"
              name="duration_minutes"
              type="number"
              value={formData.duration_minutes}
              onChange={handleInputChange}
              min="5"
              step="5"
              className="mt-1"
            />
          </div>

          {/* Type */}
          <div>
            <Label htmlFor="type" className="text-sm font-medium">
              {t('workorder.type')}
            </Label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className="w-full mt-1 px-3 py-2 border rounded-md"
            >
              <option value="cleaning">{t('workorder.cleaning')}</option>
              <option value="inspection">{t('workorder.inspection')}</option>
              <option value="repair">{t('workorder.repair')}</option>
              <option value="maintenance">{t('workorder.maintenance')}</option>
              <option value="installation">{t('workorder.installation')}</option>
            </select>
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t space-y-2">
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.title.trim()}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('maintenance.add_task')}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full"
          >
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </>
  )
}

'use client'

import React from "react"
import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createBrowserClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { Fuel, Upload, Plus, Eye, Download, Trash2 } from 'lucide-react'

interface FuelRecord {
  id: string
  fuel_code: string
  vehicle_id: string
  date_recorded: string
  liters: number
  fuel_type: string
  cost_pesos: number
  location: string
  photo_url?: string
  source: string
  is_verified: boolean
  created_at: string
  notes?: string
}

interface Vehicle {
  id: string
  name: string
  code: string
}

export default function FuelConsumptionPage() {
  const [records, setRecords] = useState<FuelRecord[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterVehicle, setFilterVehicle] = useState('all')
  const [supabaseClient] = useState(() => createBrowserClient())
  const [formData, setFormData] = useState({
    vehicle_id: '',
    date_recorded: format(new Date(), 'yyyy-MM-dd'),
    liters: '',
    fuel_type: 'diesel',
    cost_pesos: '',
    location: '',
    notes: '',
    photo: null as File | null,
    source: 'manual',
  })

  const loadData = async () => {
    let isMounted = true

    try {
      setLoading(true)
      const [vehiclesData, recordsData] = await Promise.all([
        supabaseClient.from('vehicles').select('*'),
        supabaseClient.from('fuel_consumption').select('*').order('date_recorded', { ascending: false }),
      ])

      if (isMounted) {
        setVehicles(vehiclesData.data || [])
        setRecords(recordsData.data || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      if (isMounted) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    loadData()

    return () => {
      // Cleanup if necessary
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      let photoUrl = null

      // Upload photo if provided
      if (formData.photo) {
        const timestamp = Date.now()
        const fileName = `fuel-${timestamp}-${formData.photo.name}`

        const { error: uploadError } = await supabaseClient.storage.from('fuel-photos').upload(fileName, formData.photo)

        if (uploadError) throw uploadError

        const { data: publicUrl } = supabaseClient.storage.from('fuel-photos').getPublicUrl(fileName)
        photoUrl = publicUrl.publicUrl
      }

      // Generate fuel code
      const fuelCode = `FUEL-${Date.now().toString().slice(-6)}`

      const { error: insertError } = await supabaseClient.from('fuel_consumption').insert({
        fuel_code: fuelCode,
        vehicle_id: formData.vehicle_id,
        date_recorded: formData.date_recorded,
        liters: parseFloat(formData.liters),
        fuel_type: formData.fuel_type,
        cost_pesos: formData.cost_pesos ? parseFloat(formData.cost_pesos) : null,
        location: formData.location,
        notes: formData.notes,
        photo_url: photoUrl,
        source: formData.source,
        submitted_by: (await supabaseClient.auth.getUser()).data.user?.id,
      })

      if (insertError) throw insertError

      // Reset form
      setFormData({
        vehicle_id: '',
        date_recorded: format(new Date(), 'yyyy-MM-dd'),
        liters: '',
        fuel_type: 'diesel',
        cost_pesos: '',
        location: '',
        notes: '',
        photo: null,
        source: 'manual',
      })

      setShowForm(false)
      loadData() // Call loadData function
    } catch (error) {
      console.error('Error saving fuel record:', error)
      alert('Error guardando registro de combustible')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este registro de combustible?')) return

    try {
      const { error } = await supabaseClient.from('fuel_consumption').delete().eq('id', id)
      if (error) throw error
      loadData() // Call loadData function
    } catch (error) {
      console.error('Error deleting record:', error)
    }
  }

  const filteredRecords = filterVehicle === 'all' ? records : records.filter((r) => r.vehicle_id === filterVehicle)

  const stats = {
    totalLiters: filteredRecords.reduce((sum, r) => sum + r.liters, 0),
    totalCost: filteredRecords.reduce((sum, r) => sum + (r.cost_pesos || 0), 0),
    avgCostPerLiter:
      filteredRecords.length > 0
        ? (filteredRecords.reduce((sum, r) => sum + (r.cost_pesos || 0), 0) / filteredRecords.reduce((sum, r) => sum + r.liters, 0)).toFixed(2)
        : 0,
  }

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-accent flex items-center gap-2">
              <Fuel className="h-6 w-6" />
              Consumo de Combustible
            </h1>
            <p className="text-muted-foreground mt-1">Registra consumos de combustible del campo por WhatsApp o manualmente</p>
          </div>

          <Button onClick={() => setShowForm(!showForm)} className="gap-2 w-full md:w-auto">
            <Plus className="h-4 w-4" />
            Nuevo Registro
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Litros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{stats.totalLiters.toFixed(1)} L</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Costo Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">${stats.totalCost.toFixed(0)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Costo x Litro</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">${stats.avgCostPerLiter}</div>
            </CardContent>
          </Card>
        </div>

        {/* Form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Registrar Consumo de Combustible</CardTitle>
              <CardDescription>Puedes subir imágenes del recibo o ingresar los datos manualmente</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Vehículo*</label>
                    <select
                      value={formData.vehicle_id}
                      onChange={(e) => setFormData((prev) => ({ ...prev, vehicle_id: e.target.value }))}
                      className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                      required
                    >
                      <option value="">Seleccionar vehículo</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Fecha*</label>
                    <input
                      type="date"
                      value={formData.date_recorded}
                      onChange={(e) => setFormData((prev) => ({ ...prev, date_recorded: e.target.value }))}
                      className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Litros*</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.liters}
                      onChange={(e) => setFormData((prev) => ({ ...prev, liters: e.target.value }))}
                      className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                      placeholder="0.0"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Tipo de Combustible*</label>
                    <select
                      value={formData.fuel_type}
                      onChange={(e) => setFormData((prev) => ({ ...prev, fuel_type: e.target.value }))}
                      className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                    >
                      <option value="diesel">Diésel</option>
                      <option value="gasoline">Gasolina</option>
                      <option value="premium_gas">Gasolina Premium</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Costo (pesos)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.cost_pesos}
                      onChange={(e) => setFormData((prev) => ({ ...prev, cost_pesos: e.target.value }))}
                      className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Ubicación</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                      className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                      placeholder="Ej: Finca Norte"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Notas</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm resize-none"
                    rows={3}
                    placeholder="Notas adicionales sobre el consumo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Foto de Recibo (Opcional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFormData((prev) => ({ ...prev, photo: e.target.files?.[0] || null }))}
                    className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                  />
                  {formData.photo && <p className="text-xs text-accent mt-1">{formData.photo.name}</p>}
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="w-full sm:w-auto">
                    Cancelar
                  </Button>
                  <Button type="submit" className="w-full sm:w-auto gap-2">
                    <Upload className="h-4 w-4" />
                    Guardar Registro
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Filter */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <label className="text-sm font-medium">Filtrar por vehículo:</label>
          <select
            value={filterVehicle}
            onChange={(e) => setFilterVehicle(e.target.value)}
            className="px-3 py-2 bg-input border border-border rounded-md text-sm max-w-xs"
          >
            <option value="all">Todos los vehículos</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.code})
              </option>
            ))}
          </select>
        </div>

        {/* Records Table */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Registros de Combustible</h2>

          {loading ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">Cargando registros...</CardContent>
            </Card>
          ) : filteredRecords.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">No hay registros de combustible</CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left p-3 font-semibold">Código</th>
                    <th className="text-left p-3 font-semibold">Vehículo</th>
                    <th className="text-left p-3 font-semibold">Fecha</th>
                    <th className="text-left p-3 font-semibold">Litros</th>
                    <th className="text-left p-3 font-semibold">Tipo</th>
                    <th className="text-left p-3 font-semibold">Costo</th>
                    <th className="text-left p-3 font-semibold">Ubicación</th>
                    <th className="text-center p-3 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRecords.map((record) => {
                    const vehicle = vehicles.find((v) => v.id === record.vehicle_id)
                    return (
                      <tr key={record.id} className="hover:bg-card/50">
                        <td className="p-3 text-accent font-mono">{record.fuel_code}</td>
                        <td className="p-3">{vehicle?.name}</td>
                        <td className="p-3">{format(new Date(record.date_recorded), 'dd/MM/yyyy')}</td>
                        <td className="p-3 font-semibold">{record.liters} L</td>
                        <td className="p-3 capitalize">{record.fuel_type}</td>
                        <td className="p-3">${record.cost_pesos ? record.cost_pesos.toFixed(0) : '-'}</td>
                        <td className="p-3 text-muted-foreground">{record.location || '-'}</td>
                        <td className="p-3">
                          <div className="flex justify-center gap-2">
                            {record.photo_url && (
                              <a href={record.photo_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                                <Eye className="h-4 w-4" />
                              </a>
                            )}
                            <button onClick={() => handleDelete(record.id)} className="text-destructive hover:underline">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

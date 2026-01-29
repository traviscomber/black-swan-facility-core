'use client'

import React from "react"

import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createBrowserClient } from '@/lib/supabase/client'
import { AlertTriangle, Plus, TrendingDown, Heart, Droplet, Zap } from 'lucide-react'

type BiometricRecord = {
  id: string
  animal_id: string
  test_date: string
  bhb: number | null
  total_protein: number | null
  magnesium: number | null
  calcium: number | null
  glucose: number | null
}

type CattleAnimal = {
  id: string
  animal_id: string
  name: string
  breed: string
  status: string
}

export default function CattleHealthPage() {
  const [animals, setAnimals] = useState<CattleAnimal[]>([])
  const [records, setRecords] = useState<BiometricRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAnimal, setSelectedAnimal] = useState<string>('all')
  const [showDialog, setShowDialog] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [formData, setFormData] = useState({
    animal_id: '',
    test_date: new Date().toISOString().split('T')[0],
    bhb: '',
    total_protein: '',
    magnesium: '',
    calcium: '',
    glucose: '',
    notes: '',
  })
  const supabase = createBrowserClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

      // Load animals - remove status filter to debug
      const { data: animalsData, error: animalsError } = await supabase
        .from('cattle_animals')
        .select('id, animal_id, name, breed, status')
        .order('animal_id', { ascending: true })

      console.log('[v0] Animals data:', animalsData, 'Count:', animalsData?.length)
      console.log('[v0] Animals error:', animalsError)

      setAnimals(animalsData || [])

      // Load recent records
      const { data: recordsData, error: recordsError } = await supabase
        .from('cattle_biometric_records')
        .select('*')
        .order('test_date', { ascending: false })
        .limit(100)

      console.log('[v0] Records data:', recordsData, 'Count:', recordsData?.length)
      console.log('[v0] Records error:', recordsError)

      setRecords(recordsData || [])
    } catch (error) {
      console.error('[v0] Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)

    try {
      if (!formData.animal_id) {
        throw new Error('Selecciona un animal')
      }

      const { error } = await supabase.from('cattle_biometric_records').insert({
        animal_id: formData.animal_id,
        test_date: formData.test_date,
        bhb: formData.bhb ? parseFloat(formData.bhb) : null,
        total_protein: formData.total_protein ? parseFloat(formData.total_protein) : null,
        magnesium: formData.magnesium ? parseFloat(formData.magnesium) : null,
        calcium: formData.calcium ? parseFloat(formData.calcium) : null,
        glucose: formData.glucose ? parseFloat(formData.glucose) : null,
        notes: formData.notes || null,
      })

      if (error) throw error

      // Reset form and reload data
      setFormData({
        animal_id: '',
        test_date: new Date().toISOString().split('T')[0],
        bhb: '',
        total_protein: '',
        magnesium: '',
        calcium: '',
        glucose: '',
        notes: '',
      })
      setShowDialog(false)
      await loadData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setFormLoading(false)
    }
  }

  // Filtrar registros por animal
  const filteredRecords =
    selectedAnimal === 'all'
      ? records
      : records.filter((r) => {
          const animal = animals.find((a) => a.id === r.animal_id)
          return animal?.animal_id === selectedAnimal
        })

  // Detectar alertas
  const detectAlerts = (record: BiometricRecord) => {
    const alerts = []

    if (record.bhb && record.bhb > 0.6) {
      alerts.push({
        type: 'Cetosis/Movilización de grasa',
        severity: record.bhb > 1.0 ? 'critical' : 'high',
        value: record.bhb.toFixed(2),
      })
    }

    if (record.total_protein && record.total_protein < 65) {
      alerts.push({
        type: 'Proteína baja - desnutrición',
        severity: record.total_protein < 55 ? 'critical' : 'high',
        value: record.total_protein.toFixed(1),
      })
    }

    if (record.magnesium && record.magnesium < 0.8) {
      alerts.push({
        type: 'Hipomagnesemia - riesgo tetania',
        severity: record.magnesium < 0.5 ? 'critical' : 'medium',
        value: record.magnesium.toFixed(2),
      })
    }

    if (record.glucose && (record.glucose < 40 || record.glucose > 100)) {
      alerts.push({
        type: 'Glucosa anormal',
        severity: record.glucose < 30 ? 'critical' : 'medium',
        value: record.glucose.toFixed(1),
      })
    }

    return alerts
  }

  // Estadísticas generales
  const stats = {
    totalAnimals: animals.length,
    recentRecords: records.length,
    animalsWithAlerts: records.filter((r) => detectAlerts(r).length > 0).length,
    criticalAlerts: records.reduce((sum, r) => sum + detectAlerts(r).filter((a) => a.severity === 'critical').length, 0),
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <div className="h-10 bg-muted animate-pulse rounded" />
          <div className="h-20 bg-muted animate-pulse rounded" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Monitoreo de Salud - Ganado</h1>
            <p className="text-muted-foreground mt-1">Análisis veterinario y alertas automáticas de bienestar animal</p>
          </div>
          <Button size="lg" className="gap-2" onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4" />
            Registrar Análisis
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Heart className="h-4 w-4" /> Animales Activos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAnimals}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Droplet className="h-4 w-4" /> Análisis Recientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentRecords}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Con Alertas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.animalsWithAlerts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4" /> Críticos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.criticalAlerts}</div>
            </CardContent>
          </Card>
        </div>

        {/* Critical Alerts */}
        {stats.criticalAlerts > 0 && (
          <Alert className="border-red-500 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Hay {stats.criticalAlerts} alertas críticas que requieren atención inmediata. Revisa los registros abajo.
            </AlertDescription>
          </Alert>
        )}

        {/* Filtro */}
        <div className="flex gap-2">
          <select
            value={selectedAnimal}
            onChange={(e) => setSelectedAnimal(e.target.value)}
            className="px-3 py-2 bg-input border border-border rounded-md text-sm"
          >
            <option value="all">Todos los animales</option>
            {animals.map((a) => (
              <option key={a.id} value={a.animal_id}>
                {a.name || a.animal_id} ({a.breed})
              </option>
            ))}
          </select>
        </div>

        {/* Registros */}
        <Card>
          <CardHeader>
            <CardTitle>Últimos Análisis Bioquímicos</CardTitle>
            <CardDescription>Parámetros de salud e indicadores de riesgo</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredRecords.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">Sin registros de análisis bioquímicos</p>
                <p className="text-sm text-muted-foreground mb-4">Comienza registrando un nuevo análisis para ver datos aquí</p>
                <Button size="sm" onClick={() => setShowDialog(true)}>
                  Registrar Primer Análisis
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRecords.slice(0, 20).map((record) => {
                  const animal = animals.find((a) => a.id === record.animal_id)
                  const alerts = detectAlerts(record)

                  return (
                    <div
                      key={record.id}
                      className="border rounded-lg p-4 space-y-3 hover:bg-accent/5 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-foreground">
                            {animal?.name || animal?.animal_id || record.animal_id}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Fecha: {new Date(record.test_date).toLocaleDateString('es-CL')}
                          </p>
                        </div>
                        {alerts.length > 0 && (
                          <div className="flex gap-1">
                            {alerts.map((a, i) => (
                              <span
                                key={i}
                                className={`text-xs font-semibold px-2 py-1 rounded ${
                                  a.severity === 'critical'
                                    ? 'bg-red-100 text-red-800'
                                    : a.severity === 'high'
                                      ? 'bg-orange-100 text-orange-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {a.severity.toUpperCase()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Parámetros */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        {record.bhb !== null && (
                          <div>
                            <p className="text-muted-foreground text-xs">BHB</p>
                            <p className={`font-semibold ${record.bhb > 0.6 ? 'text-red-600' : 'text-green-600'}`}>
                              {record.bhb.toFixed(2)} mmol/L
                            </p>
                          </div>
                        )}
                        {record.total_protein !== null && (
                          <div>
                            <p className="text-muted-foreground text-xs">Proteína</p>
                            <p className={`font-semibold ${record.total_protein < 65 ? 'text-red-600' : 'text-green-600'}`}>
                              {record.total_protein.toFixed(1)} g/L
                            </p>
                          </div>
                        )}
                        {record.magnesium !== null && (
                          <div>
                            <p className="text-muted-foreground text-xs">Magnesio</p>
                            <p className={`font-semibold ${record.magnesium < 0.8 ? 'text-red-600' : 'text-green-600'}`}>
                              {record.magnesium.toFixed(2)} mmol/L
                            </p>
                          </div>
                        )}
                        {record.glucose !== null && (
                          <div>
                            <p className="text-muted-foreground text-xs">Glucosa</p>
                            <p
                              className={`font-semibold ${
                                record.glucose < 40 || record.glucose > 100 ? 'text-red-600' : 'text-green-600'
                              }`}
                            >
                              {record.glucose.toFixed(1)} mg/dL
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Alertas detalladas */}
                      {alerts.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded p-2 space-y-1">
                          {alerts.map((alert, i) => (
                            <p key={i} className="text-sm text-red-800">
                              ⚠️ {alert.type}: {alert.value}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recomendaciones */}
        <Card>
          <CardHeader>
            <CardTitle>Recomendaciones de Mitigación</CardTitle>
            <CardDescription>Basadas en análisis de Valdivia, NOV-DIC 2025</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="border-l-4 border-blue-500 pl-4 py-2">
                <p className="font-semibold text-foreground">1. Mejora de Alimentación Invernal</p>
                <p className="text-sm text-muted-foreground">
                  Aumenta ensilaje de calidad, suplementa proteína (30-40% PC) desde abril-mayo. Agrega grano en últimas
                  8 semanas de gestación.
                </p>
              </div>

              <div className="border-l-4 border-green-500 pl-4 py-2">
                <p className="font-semibold text-foreground">2. Mineralización</p>
                <p className="text-sm text-muted-foreground">
                  Suplementa 50-60g Mg/día en invierno. Usa pastas, bloques o polvo en alimento. Evita pastos jóvenes
                  con K alto.
                </p>
              </div>

              <div className="border-l-4 border-orange-500 pl-4 py-2">
                <p className="font-semibold text-foreground">3. Monitoreo Temprano</p>
                <p className="text-sm text-muted-foreground">
                  Muestreos de sangre cada 4 semanas en otoño-invierno. Mide BHB, proteína, urea, calcio, magnesio.
                </p>
              </div>

              <div className="border-l-4 border-purple-500 pl-4 py-2">
                <p className="font-semibold text-foreground">4. Plan Estacional para Valdivia</p>
                <p className="text-sm text-muted-foreground">
                  Marzo-Abril: Reservar forraje. Mayo-Junio: Suplementación leve. Julio-Agosto: Aumentar suplemento.
                  Sept-Oct: Reducir según pasto.
                </p>
              </div>

              <div className="border-l-4 border-red-500 pl-4 py-2">
                <p className="font-semibold text-foreground">5. Prevención de Infecciones</p>
                <p className="text-sm text-muted-foreground">
                  Nutrición correcta mejora inmunidad. Revisa alojamientos, densidad animal, ventilación. Aísla animales
                  enfermos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog para registrar análisis */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar Análisis Bioquímico</DialogTitle>
            <DialogDescription>Ingresa los parámetros del análisis veterinario</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 bg-destructive/20 text-destructive rounded-md text-sm">{formError}</div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Animal *</label>
                {animals.length === 0 ? (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md text-sm text-yellow-700">
                    <p>No hay animales registrados. Por favor crea animales en el módulo de ganado primero.</p>
                  </div>
                ) : (
                  <select
                    value={formData.animal_id}
                    onChange={(e) => setFormData({ ...formData, animal_id: e.target.value })}
                    className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                    required
                  >
                    <option value="">Selecciona un animal</option>
                    {animals.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.animal_id} - {a.name || 'Sin nombre'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha del Análisis *</label>
                <input
                  type="date"
                  value={formData.test_date}
                  onChange={(e) => setFormData({ ...formData, test_date: e.target.value })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">BHB (mmol/L)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="ej: 0.6"
                  value={formData.bhb}
                  onChange={(e) => setFormData({ ...formData, bhb: e.target.value })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Proteína Total (g/L)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="ej: 65"
                  value={formData.total_protein}
                  onChange={(e) => setFormData({ ...formData, total_protein: e.target.value })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Magnesio (mmol/L)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="ej: 0.8"
                  value={formData.magnesium}
                  onChange={(e) => setFormData({ ...formData, magnesium: e.target.value })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Calcio (mmol/L)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="ej: 2.2"
                  value={formData.calcium}
                  onChange={(e) => setFormData({ ...formData, calcium: e.target.value })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Glucosa (mg/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="ej: 80"
                  value={formData.glucose}
                  onChange={(e) => setFormData({ ...formData, glucose: e.target.value })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notas</label>
              <textarea
                placeholder="Observaciones adicionales..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm resize-none"
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={formLoading}>
                {formLoading ? 'Guardando...' : 'Guardar Análisis'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

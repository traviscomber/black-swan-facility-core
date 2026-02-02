'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, TrendingDown, Lightbulb, CheckCircle2, Clock } from 'lucide-react'

export function HealthInsightsPanel() {
  return (
    <div className="space-y-4">
      {/* Hallazgos Principales */}
      <Card className="border-orange-500 bg-orange-100">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-700" />
            <CardTitle className="text-lg text-orange-950">Hallazgos Principales</CardTitle>
          </div>
          <CardDescription className="text-orange-800">Análisis de 17 animales Angus - Valdivia, 23-01-2026</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm text-orange-950">
            <p className="font-semibold">Grupo 1: 8 Vacas</p>
            <ul className="ml-4 space-y-1 text-orange-900 list-disc text-xs">
              <li>75% movilización grasa (BHB 0.43-0.67)</li>
              <li>87.5% deficiencia proteica (76-122 g/L)</li>
              <li>100% hipomagnesemia (0.48-0.75)</li>
              <li>1 vaca con infección inespecífica</li>
            </ul>

            <p className="font-semibold mt-3">Grupo 2: 9 Vaquillas</p>
            <ul className="ml-4 space-y-1 text-orange-900 list-disc text-xs">
              <li>77.8% movilización grasa (BHB 0.38-0.64)</li>
              <li>88.9% deficiencia proteica (64-97 g/L)</li>
              <li>100% hipomagnesemia (0.54-0.68)</li>
              <li>1 vaquilla con infección inespecífica</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Causas Raíz */}
      <Card className="border-red-500 bg-red-100">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-700" />
            <CardTitle className="text-lg text-red-950">Causa Raíz</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm text-red-950">
            <p className="font-semibold">Síndrome de Desnutrición Energético-Proteica Invernal</p>
            <p className="text-red-900 ml-4 text-xs mt-1">
              Durante NOV-DIC 2025 (invierno austral), los animales no recibieron suficiente energía y proteína, forzando sus cuerpos a quemar reservas de grasa. El magnesio bajo los expone a riesgo de tetania hipomagnésemica.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Acciones Inmediatas */}
      <Card className="border-yellow-600 bg-yellow-100">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-800" />
            <CardTitle className="text-lg text-yellow-950">Acciones Inmediatas</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm text-yellow-950">
            <div className="p-2 bg-yellow-200 rounded border border-yellow-700 text-xs">
              <p className="font-semibold">1. Magnesio Suplementado</p>
              <p className="text-yellow-900">50-60g Mg/día en invierno (pastas, bloques, polvo)</p>
            </div>
            <div className="p-2 bg-yellow-200 rounded border border-yellow-700 text-xs">
              <p className="font-semibold">2. Proteína Degradable Ruminal</p>
              <p className="text-yellow-900">Habas, alfalfa henificada, leguminosas (30-40% PC)</p>
            </div>
            <div className="p-2 bg-yellow-200 rounded border border-yellow-700 text-xs">
              <p className="font-semibold">3. Suplementación Energética</p>
              <p className="text-yellow-900">Grano especialmente en últimas 8 semanas de gestación</p>
            </div>
            <div className="p-2 bg-yellow-200 rounded border border-yellow-700 text-xs">
              <p className="font-semibold">4. Monitoreo Clínico</p>
              <p className="text-yellow-900">Muestreos de sangre cada 4 semanas en otoño-invierno</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Preventivo Largo Plazo */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-green-600" />
            <CardTitle className="text-lg text-green-900">Plan Preventivo 2026 (Próximo Invierno)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-3 text-sm text-green-800">
            <div className="p-3 bg-green-100 rounded-lg border border-green-300">
              <p className="font-semibold">Marzo-Abril 2026</p>
              <p className="ml-4 mt-1 text-green-700">Producir ensilaje de maíz o pasto de excelente calidad (digestibilidad &gt;65%)</p>
            </div>
            
            <div className="p-3 bg-green-100 rounded-lg border border-green-300">
              <p className="font-semibold">Mayo-Junio 2026</p>
              <p className="ml-4 mt-1 text-green-700">Realizar muestreos de sangre cada 4 semanas para detectar déficits temprano</p>
            </div>
            
            <div className="p-3 bg-green-100 rounded-lg border border-green-300">
              <p className="font-semibold">Julio-Agosto 2026</p>
              <p className="ml-4 mt-1 text-green-700">Iniciar suplementación preventiva (NO esperar síntomas). Mg, proteína, energía</p>
            </div>
            
            <div className="p-3 bg-green-100 rounded-lg border border-green-300">
              <p className="font-semibold">Resultados Esperados</p>
              <p className="ml-4 mt-1 text-green-700">
                BHB &lt;0.4, Proteína &gt;75 g/L, Mg &gt;0.8 mmol/L, mejor fertilidad, menor morbilidad
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparativa Grupo 1 vs Grupo 2 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Análisis Comparativo</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="font-semibold text-blue-900 mb-2">Grupo 1: 8 Vacas</p>
              <ul className="space-y-1 text-blue-800 text-xs list-disc ml-4">
                <li>BHB promedio: 0.56 mmol/L (alto)</li>
                <li>Proteína promedio: 84 g/L</li>
                <li>Mg promedio: 0.66 mmol/L (bajo)</li>
                <li>1 con infección inespecífica</li>
              </ul>
            </div>
            
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="font-semibold text-blue-900 mb-2">Grupo 2: 9 Vaquillas</p>
              <ul className="space-y-1 text-blue-800 text-xs list-disc ml-4">
                <li>BHB promedio: 0.52 mmol/L (alto)</li>
                <li>Proteína promedio: 76 g/L (más baja)</li>
                <li>Mg promedio: 0.59 mmol/L (más crítico)</li>
                <li>1 con infección inespecífica</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

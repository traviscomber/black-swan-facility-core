'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, TrendingDown, Lightbulb, CheckCircle2, Clock } from 'lucide-react'

export function HealthInsightsPanel() {
  return (
    <div className="space-y-4">
      {/* Hallazgos Principales */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <CardTitle className="text-lg text-orange-900">Hallazgos Principales</CardTitle>
          </div>
          <CardDescription>Análisis de 17 animales Angus - Valdivia, 23-01-2026</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm text-orange-800">
            <p className="font-semibold">1. Movilización de Grasa (Ketosis Subclínica)</p>
            <p className="ml-4 text-orange-700">
              BHB elevado en 75% de los animales (0.51-0.67 mmol/L). Indica movilización excesiva de reserves lipídicas.
            </p>
            
            <p className="font-semibold mt-3">2. Deficiencia de Proteína Degradable</p>
            <p className="ml-4 text-orange-700">
              Proteína total baja (64-86 g/L) en 80% del rebaño. Refleja aporte insuficiente de proteína ruminal.
            </p>
            
            <p className="font-semibold mt-3">3. Hipomagnesemia Subclínica (CRÍTICO)</p>
            <p className="ml-4 text-orange-700">
              Magnesio bajo (0.48-0.68 mmol/L) en 100% de los animales. Riesgo de tetania hipomagnésemica.
            </p>
            
            <p className="font-semibold mt-3">4. Procesos Infecciosos</p>
            <p className="ml-4 text-orange-700">
              2 animales con infecciones inespecíficas (Vaca 22027424, Vaquilla 23526062).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Causas Raíz */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-600" />
            <CardTitle className="text-lg text-red-900">Causas Raíz</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm text-red-800">
            <p className="font-semibold">Desnutrición Energético-Proteica Invernal</p>
            <ul className="ml-4 space-y-1 text-red-700 list-disc">
              <li>Forraje de baja calidad en invierno austral (NOV-DIC 2025)</li>
              <li>Disponibilidad insuficiente de suplementación proteica</li>
              <li>Falta de ensilaje de calidad durante la época crítica</li>
              <li>Ausencia de suplementación mineral preventiva (Mg)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Acciones Inmediatas */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-700" />
            <CardTitle className="text-lg text-yellow-900">Acciones Inmediatas (Próximas 2-4 semanas)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-3 text-sm text-yellow-800">
            <div className="p-3 bg-yellow-100 rounded-lg border border-yellow-300">
              <p className="font-semibold">1. Suplementación de Magnesio</p>
              <p className="ml-4 mt-1 text-yellow-700">
                50-60g Mg/día vía pastas, bloques o polvo en alimento. Crítico para prevenir tetania.
              </p>
            </div>
            
            <div className="p-3 bg-yellow-100 rounded-lg border border-yellow-300">
              <p className="font-semibold">2. Incremento Proteico</p>
              <p className="ml-4 mt-1 text-yellow-700">
                Agregar habas, alfalfa henificada, o pellets de leguminosas (30-40% PC). Meta: &gt;75 g/L proteína.
              </p>
            </div>
            
            <div className="p-3 bg-yellow-100 rounded-lg border border-yellow-300">
              <p className="font-semibold">3. Suplementación Energética</p>
              <p className="ml-4 mt-1 text-yellow-700">
                Grano (cebada/avena) especialmente en últimas 8 semanas de gestación.
              </p>
            </div>
            
            <div className="p-3 bg-yellow-100 rounded-lg border border-yellow-300">
              <p className="font-semibold">4. Monitoreo Clínico</p>
              <p className="ml-4 mt-1 text-yellow-700">
                Observar signos: temblores musculares, caminar rígido, hipersensibilidad = URGENCIA veterinaria.
              </p>
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

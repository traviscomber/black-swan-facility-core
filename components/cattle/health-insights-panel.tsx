'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, TrendingDown, Lightbulb, CheckCircle2, Clock } from 'lucide-react'

export function HealthInsightsPanel() {
  return (
    <div className="space-y-4">
      {/* Hallazgos Principales */}
      <Card className="border-primary bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg text-foreground">Hallazgos Principales</CardTitle>
          </div>
          <CardDescription>Análisis de 17 animales Angus - Valdivia, 23-01-2026</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-foreground">Grupo 1: 8 Vacas</p>
            <ul className="ml-4 space-y-1 text-muted-foreground list-disc text-xs">
              <li>75% movilización grasa (BHB 0.43-0.67)</li>
              <li>87.5% deficiencia proteica (76-122 g/L)</li>
              <li>100% hipomagnesemia (0.48-0.75)</li>
              <li>1 vaca con infección inespecífica</li>
            </ul>

            <p className="font-semibold text-foreground mt-3">Grupo 2: 9 Vaquillas</p>
            <ul className="ml-4 space-y-1 text-muted-foreground list-disc text-xs">
              <li>77.8% movilización grasa (BHB 0.38-0.64)</li>
              <li>88.9% deficiencia proteica (64-97 g/L)</li>
              <li>100% hipomagnesemia (0.54-0.68)</li>
              <li>1 vaquilla con infección inespecífica</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Causas Raíz */}
      <Card className="border-destructive bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-destructive" />
            <CardTitle className="text-lg text-foreground">Causa Raíz</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-foreground">Síndrome de Desnutrición Energético-Proteica Invernal</p>
            <p className="text-muted-foreground ml-4 text-xs mt-2">
              Durante NOV-DIC 2025 (invierno austral), los animales no recibieron suficiente energía y proteína, forzando sus cuerpos a quemar reservas de grasa. El magnesio bajo los expone a riesgo de tetania hipomagnésemica.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Acciones Inmediatas */}
      <Card className="border-primary bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg text-foreground">Acciones Inmediatas</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="p-3 bg-secondary rounded border border-border">
              <p className="font-semibold text-foreground text-sm">1. Magnesio Suplementado</p>
              <p className="text-muted-foreground text-xs mt-1">50-60g Mg/día en invierno (pastas, bloques, polvo)</p>
            </div>
            <div className="p-3 bg-secondary rounded border border-border">
              <p className="font-semibold text-foreground text-sm">2. Proteína Degradable Ruminal</p>
              <p className="text-muted-foreground text-xs mt-1">Habas, alfalfa henificada, leguminosas (30-40% PC)</p>
            </div>
            <div className="p-3 bg-secondary rounded border border-border">
              <p className="font-semibold text-foreground text-sm">3. Suplementación Energética</p>
              <p className="text-muted-foreground text-xs mt-1">Grano especialmente en últimas 8 semanas de gestación</p>
            </div>
            <div className="p-3 bg-secondary rounded border border-border">
              <p className="font-semibold text-foreground text-sm">4. Monitoreo Clínico</p>
              <p className="text-muted-foreground text-xs mt-1">Muestreos de sangre cada 4 semanas en otoño-invierno</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Preventivo 2026 */}
      <Card className="border-primary bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg text-foreground">Plan Preventivo para Próximo Invierno (2026)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-3 text-xs">
            <div className="pb-3 border-b border-border">
              <p className="font-semibold text-foreground">Marzo-Abril: Preparación</p>
              <p className="text-muted-foreground mt-1">Reservar 30% más forraje. Producir ensilaje de buena calidad.</p>
            </div>
            <div className="pb-3 border-b border-border">
              <p className="font-semibold text-foreground">Mayo-Junio: Monitoreo</p>
              <p className="text-muted-foreground mt-1">Análisis de 5-8 animales cada 4 semanas. Revisar condición corporal.</p>
            </div>
            <div className="pb-3 border-b border-border">
              <p className="font-semibold text-foreground">Julio-Agosto: Crítico</p>
              <p className="text-muted-foreground mt-1">Máxima suplementación proteica y energética. Monitoreo quincenal.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Septiembre-Octubre: Transición</p>
              <p className="text-muted-foreground mt-1">Reducir suplementación según disponibilidad de pasto.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen Comparativo */}
      <Card className="border-primary bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg text-foreground">Comparación por Grupo</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 font-semibold text-foreground">Parámetro</th>
                  <th className="text-left p-2 font-semibold text-foreground">Vacas (8)</th>
                  <th className="text-left p-2 font-semibold text-foreground">Vaquillas (9)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="p-2 font-semibold text-foreground">BHB Promedio</td>
                  <td className="p-2 text-muted-foreground">0.56</td>
                  <td className="p-2 text-muted-foreground">0.51</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-2 font-semibold text-foreground">Proteína Promedio</td>
                  <td className="p-2 text-muted-foreground">84 g/L</td>
                  <td className="p-2 text-muted-foreground">74 g/L</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-2 font-semibold text-foreground">Mg Promedio</td>
                  <td className="p-2 text-muted-foreground">0.63</td>
                  <td className="p-2 text-muted-foreground">0.59</td>
                </tr>
                <tr>
                  <td className="p-2 font-semibold text-foreground">Infecciones</td>
                  <td className="p-2 text-muted-foreground">1/8 (12.5%)</td>
                  <td className="p-2 text-muted-foreground">1/9 (11.1%)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

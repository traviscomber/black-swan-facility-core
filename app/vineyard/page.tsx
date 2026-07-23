"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Grape, Images, RefreshCw, Sprout } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { AddPlotDialog } from "@/components/vineyard/add-plot-dialog"

interface VineyardPlot {
  id: string
  name: string
  location: string | null
  area_hectares: number | null
  vine_variety: string | null
  planted_year: number | null
  rootstock: string | null
  spacing_meters: number | null
  vine_density_per_hectare: number | null
  trellis_system: string | null
  orientation: string | null
  aspect: string | null
  soil_type: string | null
  ph_level: number | null
  drainage_quality: string | null
  status: string | null
  notes: string | null
}

const australCatalog = {
  principales: [
    { variety: "Pinot Noir", profile: "Tinta de ciclo relativamente corto y alta afinidad con climas fríos." },
    { variety: "Chardonnay", profile: "Blanca ampliamente usada en zonas frías y base potencial para vino tranquilo o espumante." },
    { variety: "Sauvignon Blanc", profile: "Blanca aromática con buen desempeño en sectores frescos y ventilados." },
    { variety: "Riesling", profile: "Blanca de clima frío; requiere evaluación de madurez y manejo de humedad." },
  ],
  experimentales: [
    { variety: "Gewürztraminer", profile: "Alternativa aromática para ensayos pequeños y sitios protegidos." },
    { variety: "Pinot Gris", profile: "Blanca adaptable a clima frío, sujeta a validación de sitio y material vegetal." },
    { variety: "Chasselas", profile: "Cepa temprana observada en experiencias vitícolas australes; apta para evaluación experimental." },
  ],
}

const statusEs: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
  planned: "Planificado",
  establishment: "En establecimiento",
}

export default function VineyardPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [plots, setPlots] = useState<VineyardPlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPlots = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from("vineyard_plots")
      .select("id, name, location, area_hectares, vine_variety, planted_year, rootstock, spacing_meters, vine_density_per_hectare, trellis_system, orientation, aspect, soil_type, ph_level, drainage_quality, status, notes")
      .order("name")

    if (loadError) {
      setError(loadError.message)
      setPlots([])
    } else {
      setPlots((data ?? []) as VineyardPlot[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void fetchPlots() }, [fetchPlots])

  const totalArea = plots.reduce((sum, plot) => sum + Number(plot.area_hectares ?? 0), 0)
  const active = plots.filter((plot) => plot.status === "active").length
  const varieties = new Set(plots.map((plot) => plot.vine_variety?.trim()).filter(Boolean)).size
  const missingTechnicalData = plots.filter((plot) => !plot.vine_variety || !plot.soil_type || !plot.drainage_quality).length

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <PageHeader
        title="Viñedo y vinos"
        description="Registro de cuarteles del Fundo Corcovado y catálogo técnico de cepas para evaluación en viticultura austral."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/vineyard/photos"><Images className="mr-2 h-4 w-4" />Fotos</Link></Button>
            <AddPlotDialog onPlotAdded={fetchPlots} />
          </div>
        }
      />

      <Card className="border-amber-300">
        <CardContent className="flex gap-3 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">Cepas de referencia, no plantaciones confirmadas</p>
            <p className="mt-1 text-sm text-muted-foreground">El catálogo resume variedades compatibles con viticultura fría y experiencias australes. No afirma que estén plantadas en Fundo Corcovado. Cada cepa requiere evaluación de suelo, drenaje, heladas, exposición, material vegetal y madurez.</p>
          </div>
        </CardContent>
      </Card>

      {missingTechnicalData > 0 && (
        <Card className="border-amber-300"><CardContent className="p-5 text-sm"><p className="font-medium">{missingTechnicalData} cuartel{missingTechnicalData === 1 ? "" : "es"} con ficha técnica incompleta.</p><p className="mt-1 text-muted-foreground">Antes de decisiones de plantación deben registrarse al menos cepa, tipo de suelo y calidad de drenaje.</p></CardContent></Card>
      )}

      {error && <Card className="border-destructive/60"><CardContent className="flex items-center justify-between gap-4 p-5"><p className="text-sm text-destructive">No fue posible cargar el viñedo: {error}</p><Button variant="outline" size="sm" onClick={() => void fetchPlots()}><RefreshCw className="mr-2 h-4 w-4" />Reintentar</Button></CardContent></Card>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Cuarteles registrados" value={plots.length} />
        <Metric title="Superficie declarada" value={`${totalArea.toLocaleString("es-CL", { maximumFractionDigits: 2 })} ha`} />
        <Metric title="Cuarteles activos" value={active} />
        <Metric title="Cepas declaradas" value={varieties} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <VarietyCard title="Cepas prioritarias para evaluar" description="Variedades de clima frío con mayor respaldo para una evaluación técnica inicial." varieties={australCatalog.principales} />
        <VarietyCard title="Cepas para ensayo controlado" description="Alternativas que conviene probar primero en microparcelas, sin asumir viabilidad comercial." varieties={australCatalog.experimentales} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cuarteles declarados</CardTitle>
          <CardDescription>Solo esta sección representa registros existentes en Supabase. Actualmente no se generan rendimientos ni producción estimada sin datos de cosecha.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Cargando cuarteles…</p>
          ) : plots.length === 0 ? (
            <div className="py-12 text-center"><Grape className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium">No hay cuarteles de viñedo registrados.</p><p className="mt-1 text-sm text-muted-foreground">El catálogo superior es únicamente una referencia para diseñar ensayos y futuras plantaciones.</p></div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {plots.map((plot) => (
                <Card key={plot.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3"><CardTitle className="text-base">{plot.name}</CardTitle><Badge variant="outline">{statusEs[plot.status ?? ""] ?? plot.status ?? "Sin estado"}</Badge></div>
                    <CardDescription>{plot.location || "Ubicación no registrada"}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><span className="text-muted-foreground">Cepa:</span> {plot.vine_variety || "Sin definir"}</p>
                    <p><span className="text-muted-foreground">Superficie:</span> {Number(plot.area_hectares ?? 0).toLocaleString("es-CL", { maximumFractionDigits: 2 })} ha</p>
                    <p><span className="text-muted-foreground">Año de plantación:</span> {plot.planted_year ?? "Sin registro"}</p>
                    <p><span className="text-muted-foreground">Suelo:</span> {plot.soil_type || "Sin registro"}</p>
                    <p><span className="text-muted-foreground">Drenaje:</span> {plot.drainage_quality || "Sin registro"}</p>
                    <p><span className="text-muted-foreground">Densidad:</span> {plot.vine_density_per_hectare ? `${plot.vine_density_per_hectare.toLocaleString("es-CL")} plantas/ha` : "Sin registro"}</p>
                    <p><span className="text-muted-foreground">Sistema de conducción:</span> {plot.trellis_system || "Sin registro"}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{typeof value === "number" ? value.toLocaleString("es-CL") : value}</div></CardContent></Card>
}

function VarietyCard({ title, description, varieties }: { title: string; description: string; varieties: { variety: string; profile: string }[] }) {
  return <Card><CardHeader><div className="flex items-center gap-2"><Sprout className="h-5 w-5" /><CardTitle className="text-base">{title}</CardTitle></div><CardDescription>{description}</CardDescription></CardHeader><CardContent className="space-y-3">{varieties.map((item) => <div key={item.variety} className="rounded-lg border p-3"><p className="font-medium">{item.variety}</p><p className="mt-1 text-sm text-muted-foreground">{item.profile}</p></div>)}</CardContent></Card>
}

"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Brain, ClipboardPlus, MapPinned, RefreshCw } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import { buildOperationalTaskHref } from "@/lib/operational-task-links"

type CattleArea = {
  id: string
  name: string
  description: string | null
  status: string | null
  specifications: {
    hectares?: number
    capacity?: number
    business_unit?: string
    grass_type?: string
  } | null
}

export default function CattlePage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [areas, setAreas] = useState<CattleArea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadAreas() {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from("infrastructure_plans")
      .select("id, name, description, status, specifications")
      .eq("category", "Cattle")
      .order("name")

    if (loadError) setError(loadError.message)
    else setAreas((data ?? []) as CattleArea[])
    setLoading(false)
  }

  useEffect(() => { void loadAreas() }, [])

  return (
    <AppLayout>
      <PageHeader
        title="Ganadería"
        description="Acceso operativo a potreros, manejo ganadero y herramientas de apoyo del Fundo Corcovado."
        actions={<Button variant="outline" onClick={() => void loadAreas()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar</Button>}
      />

      <div className="space-y-6 p-4 sm:p-8">
        {error && <Card className="border-destructive/50"><CardContent className="p-4 text-sm text-destructive">No fue posible cargar las áreas ganaderas: {error}</CardContent></Card>}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><MapPinned className="h-5 w-5" />Áreas ganaderas</CardTitle>
            <CardDescription>Potreros y unidades de manejo registrados. Cada área puede originar una tarea trazable sin duplicar el inventario animal.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Cargando áreas…</p> : areas.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No hay áreas ganaderas registradas.</p> : <div className="grid gap-3 md:grid-cols-2">{areas.map((area) => {
              const taskHref = buildOperationalTaskHref({
                template: "ganado-ronda",
                area: "ganaderia",
                title: `Ronda operativa · ${area.name}`,
                description: area.description ? `Revisar ${area.name}. Contexto registrado: ${area.description}` : `Realizar ronda de observación y revisión operativa en ${area.name}.`,
                category: "Observación animal",
                priority: "alta",
                sourceType: "cattle_area",
                sourceId: area.id,
                sourceLabel: area.name,
                sourcePath: "/cattle",
              })
              return <div key={area.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{area.name}</h2>{area.description && <p className="mt-1 text-sm text-muted-foreground">{area.description}</p>}</div><Badge variant="outline">{area.specifications?.business_unit === "Breeding" ? "Crianza" : area.specifications?.business_unit === "Fattening" ? "Engorda" : "Sin clasificar"}</Badge></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{Number(area.specifications?.hectares ?? 0).toLocaleString("es-CL")} ha</span><span>Capacidad declarada: {Number(area.specifications?.capacity ?? 0).toLocaleString("es-CL")}</span>{area.specifications?.grass_type && <span>Pradera: {area.specifications.grass_type}</span>}</div><Button asChild size="sm" variant="outline" className="mt-4"><Link href={taskHref}><ClipboardPlus className="mr-2 h-4 w-4" />Crear tarea para esta área</Link></Button></div>
            })}</div>}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Brain className="h-5 w-5" />Apoyo técnico</CardTitle><CardDescription>Herramientas separadas para análisis y recomendaciones. Los reportes clínicos no forman parte de esta portada.</CardDescription></CardHeader><CardContent><Button asChild variant="outline"><Link href="/cattle/expert-agent">Abrir asistente ganadero</Link></Button></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Planificación económica</CardTitle><CardDescription>Costos, precios y supuestos de la unidad ganadera.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/cattle/pricing-costs">Costos y precios</Link></Button><Button asChild variant="outline"><Link href="/cattle/business-plan">Plan de negocio</Link></Button></CardContent></Card>
        </div>
      </div>
    </AppLayout>
  )
}

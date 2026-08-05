"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Brain, ClipboardPlus, MapPinned, RefreshCw } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LinkedOperationalTask } from "@/components/linked-operational-task"
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

  useEffect(() => {
    void loadAreas()
  }, [])

  return (
    <AppLayout>
      <PageHeader
        title="Ganadería"
        description="Potreros, unidades de manejo, tareas y herramientas de apoyo del Fundo Corcovado."
        actions={
          <Button variant="outline" onClick={() => void loadAreas()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        }
      />

      <div className="space-y-10 px-4 py-6 sm:px-8 sm:py-8">
        {error && (
          <div className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            No fue posible cargar las áreas ganaderas: {error}
          </div>
        )}

        <section>
          <div className="mb-5 flex items-start gap-3 border-b border-border pb-4">
            <MapPinned className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="text-base font-semibold">Áreas ganaderas</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Potreros y unidades de manejo registradas con su seguimiento operativo vinculado.
              </p>
            </div>
          </div>

          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Cargando áreas…</p>
          ) : areas.length === 0 ? (
            <p className="border border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
              No hay áreas ganaderas registradas.
            </p>
          ) : (
            <div className="grid gap-px overflow-hidden border border-border bg-border md:grid-cols-2">
              {areas.map((area) => {
                const taskHref = buildOperationalTaskHref({
                  template: "ganado-ronda",
                  area: "ganaderia",
                  title: `Ronda operativa · ${area.name}`,
                  description: area.description
                    ? `Revisar ${area.name}. Contexto registrado: ${area.description}`
                    : `Realizar ronda de observación y revisión operativa en ${area.name}.`,
                  category: "Observación animal",
                  priority: "alta",
                  sourceType: "cattle_area",
                  sourceId: area.id,
                  sourceLabel: area.name,
                  sourcePath: "/cattle",
                })

                const unitLabel =
                  area.specifications?.business_unit === "Breeding"
                    ? "Crianza"
                    : area.specifications?.business_unit === "Fattening"
                      ? "Engorda"
                      : "Sin clasificar"

                return (
                  <article key={area.id} className="flex min-h-64 flex-col justify-between bg-card p-5 sm:p-6">
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold tracking-[-0.02em]">{area.name}</h3>
                          {area.description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{area.description}</p>}
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px] uppercase tracking-[0.12em]">
                          {unitLabel}
                        </Badge>
                      </div>

                      <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-border py-4 text-xs sm:grid-cols-3">
                        <div>
                          <dt className="text-muted-foreground">Superficie</dt>
                          <dd className="mt-1 font-medium text-foreground">
                            {Number(area.specifications?.hectares ?? 0).toLocaleString("es-CL")} ha
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Capacidad declarada</dt>
                          <dd className="mt-1 font-medium text-foreground">
                            {Number(area.specifications?.capacity ?? 0).toLocaleString("es-CL")}
                          </dd>
                        </div>
                        {area.specifications?.grass_type && (
                          <div className="col-span-2 sm:col-span-1">
                            <dt className="text-muted-foreground">Pradera</dt>
                            <dd className="mt-1 font-medium text-foreground">{area.specifications.grass_type}</dd>
                          </div>
                        )}
                      </dl>

                      <div className="mt-4">
                        <LinkedOperationalTask sourceType="cattle_area" sourceId={area.id} />
                      </div>
                    </div>

                    <Button asChild size="sm" variant="outline" className="mt-5 w-fit">
                      <Link href={taskHref}>
                        <ClipboardPlus className="mr-2 h-4 w-4" />
                        Crear tarea
                      </Link>
                    </Button>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="grid gap-px overflow-hidden border border-border bg-border lg:grid-cols-2">
          <div className="bg-card p-6">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="mt-5 text-base font-semibold">Apoyo técnico</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Herramientas separadas para análisis y recomendaciones ganaderas.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link href="/cattle/expert-agent">Abrir asistente ganadero</Link>
            </Button>
          </div>

          <div className="bg-card p-6">
            <h2 className="text-base font-semibold">Planificación económica</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Costos, precios y supuestos de la unidad ganadera.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/cattle/pricing-costs">Costos y precios</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/cattle/business-plan">Plan de negocio</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  )
}

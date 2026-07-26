"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Activity, AlertTriangle, Beef, CalendarDays, MapPinned, RefreshCw, Stethoscope } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"

type Animal = {
  id: string
  animal_id: string
  name: string | null
  breed: string | null
  gender: string | null
  birth_date: string | null
  acquisition_date: string | null
  status: string | null
  notes: string | null
}

type BiometricRecord = {
  id: string
  animal_id: string
  test_date: string
  bhb: number | null
  total_protein: number | null
  calcium: number | null
  magnesium: number | null
  clinical_signs: string | null
  lab_notes: string | null
}

type CattleArea = {
  id: string
  name: string
  status: string | null
  specifications: {
    hectares?: number
    capacity?: number
    business_unit?: string
  } | null
}

const statusLabels: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
  sold: "Vendido",
  deceased: "Fallecido",
}

function hasClinicalObservation(record?: BiometricRecord) {
  const text = `${record?.clinical_signs ?? ""} ${record?.lab_notes ?? ""}`.trim()
  return Boolean(text && !/normal|sin hallazgos/i.test(text))
}

export default function CattlePage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [animals, setAnimals] = useState<Animal[]>([])
  const [biometrics, setBiometrics] = useState<BiometricRecord[]>([])
  const [areas, setAreas] = useState<CattleArea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)

    const [animalResult, biometricResult, areaResult] = await Promise.all([
      supabase.from("cattle_animals").select("id, animal_id, name, breed, gender, birth_date, acquisition_date, status, notes").order("animal_id"),
      supabase.from("cattle_biometric_records").select("id, animal_id, test_date, bhb, total_protein, calcium, magnesium, clinical_signs, lab_notes").order("test_date", { ascending: false }),
      supabase.from("infrastructure_plans").select("id, name, status, specifications").eq("category", "Cattle").order("name"),
    ])

    const firstError = animalResult.error ?? biometricResult.error ?? areaResult.error
    if (firstError) setError(firstError.message)
    else {
      setAnimals((animalResult.data ?? []) as Animal[])
      setBiometrics((biometricResult.data ?? []) as BiometricRecord[])
      setAreas((areaResult.data ?? []) as CattleArea[])
    }
    setLoading(false)
  }

  useEffect(() => { void loadData() }, [])

  const latestByAnimal = useMemo(() => {
    const records = new Map<string, BiometricRecord>()
    for (const record of biometrics) if (!records.has(record.animal_id)) records.set(record.animal_id, record)
    return records
  }, [biometrics])

  const activeAnimals = animals.filter((animal) => animal.status === "active")
  const observedAnimals = animals.filter((animal) => hasClinicalObservation(latestByAnimal.get(animal.id)))
  const latestTestDate = biometrics[0]?.test_date ?? null
  const totalHectares = areas.reduce((sum, area) => sum + Number(area.specifications?.hectares ?? 0), 0)
  const declaredCapacity = areas.reduce((sum, area) => sum + Number(area.specifications?.capacity ?? 0), 0)

  return (
    <AppLayout>
      <PageHeader
        title="Ganadería"
        description="Registro del plantel, seguimiento biométrico y contexto de potreros del Fundo Corcovado."
        actions={<Button variant="outline" onClick={() => void loadData()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar</Button>}
      />

      <div className="space-y-6 p-4 sm:p-8">
        {error && <Card className="border-destructive/50"><CardContent className="p-4 text-sm text-destructive">No fue posible cargar Ganadería: {error}</CardContent></Card>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Beef} label="Animales registrados" value={animals.length} detail={`${activeAnimals.length} activos`} />
          <Metric icon={Stethoscope} label="Con observación clínica" value={observedAnimals.length} detail="Según el último registro disponible" warning={observedAnimals.length > 0} />
          <Metric icon={CalendarDays} label="Último muestreo" value={latestTestDate ? new Date(`${latestTestDate}T12:00:00`).toLocaleDateString("es-CL") : "Sin fecha"} detail={`${biometrics.length} registros biométricos`} />
          <Metric icon={MapPinned} label="Áreas ganaderas" value={areas.length} detail={`${totalHectares.toLocaleString("es-CL")} ha declaradas`} />
        </div>

        {observedAnimals.length > 0 && (
          <Card className="border-amber-300">
            <CardContent className="flex gap-3 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">Hay {observedAnimals.length} animales con observaciones en su último registro.</p>
                <p className="mt-1 text-sm text-muted-foreground">Las notas de laboratorio son antecedentes registrados, no diagnósticos automáticos. Deben revisarse con el responsable veterinario.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plantel y último control</CardTitle>
            <CardDescription>Identificación individual y resultado biométrico más reciente disponible.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <p className="py-12 text-center text-sm text-muted-foreground">Cargando plantel…</p> : animals.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">No hay animales registrados.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="pb-3 pr-4 font-medium">Animal</th><th className="pb-3 pr-4 font-medium">Estado</th><th className="pb-3 pr-4 font-medium">Control</th><th className="pb-3 pr-4 font-medium">BHB</th><th className="pb-3 pr-4 font-medium">Proteína total</th><th className="pb-3 pr-4 font-medium">Magnesio</th><th className="pb-3 font-medium">Observación</th></tr></thead>
                  <tbody>{animals.map((animal) => {
                    const record = latestByAnimal.get(animal.id)
                    const observed = hasClinicalObservation(record)
                    return <tr key={animal.id} className="border-b last:border-0">
                      <td className="py-4 pr-4"><p className="font-medium">{animal.name || `Animal ${animal.animal_id}`}</p><p className="text-xs text-muted-foreground">ID {animal.animal_id} · {animal.breed || "Raza no registrada"}</p></td>
                      <td className="py-4 pr-4"><Badge variant="outline">{statusLabels[animal.status ?? ""] ?? animal.status ?? "Sin estado"}</Badge></td>
                      <td className="py-4 pr-4">{record?.test_date ? new Date(`${record.test_date}T12:00:00`).toLocaleDateString("es-CL") : "Sin control"}</td>
                      <td className="py-4 pr-4">{record?.bhb ?? "—"}</td>
                      <td className="py-4 pr-4">{record?.total_protein ?? "—"}</td>
                      <td className="py-4 pr-4">{record?.magnesium ?? "—"}</td>
                      <td className="max-w-[280px] py-4"><span className={observed ? "font-medium text-amber-800" : "text-muted-foreground"}>{record?.clinical_signs || record?.lab_notes || "Sin observación registrada"}</span></td>
                    </tr>
                  })}</tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPinned className="h-5 w-5" />Potreros y capacidad declarada</CardTitle><CardDescription>Contexto territorial; no equivale al inventario animal actual.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {areas.map((area) => <div key={area.id} className="flex items-center justify-between gap-4 rounded-md border p-3"><div><p className="font-medium">{area.name}</p><p className="text-xs text-muted-foreground">{Number(area.specifications?.hectares ?? 0).toLocaleString("es-CL")} ha · capacidad {Number(area.specifications?.capacity ?? 0).toLocaleString("es-CL")}</p></div><Badge variant="outline">{area.specifications?.business_unit === "Breeding" ? "Crianza" : area.specifications?.business_unit === "Fattening" ? "Engorda" : "Sin unidad"}</Badge></div>)}
              {areas.length === 0 && <p className="text-sm text-muted-foreground">No hay áreas ganaderas registradas.</p>}
              <p className="text-xs text-muted-foreground">Capacidad total declarada: {declaredCapacity.toLocaleString("es-CL")} cabezas. Este valor requiere validación en terreno.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-5 w-5" />Herramientas de análisis</CardTitle><CardDescription>Información complementaria basada en los registros disponibles.</CardDescription></CardHeader>
            <CardContent className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/cattle/expert-agent">Asistente ganadero</Link></Button><Button asChild variant="outline"><Link href="/cattle/pricing-costs">Costos y precios</Link></Button><Button asChild variant="outline"><Link href="/cattle/business-plan">Plan de negocio</Link></Button></CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}

function Metric({ icon: Icon, label, value, detail, warning = false }: { icon: typeof Beef; label: string; value: string | number; detail: string; warning?: boolean }) {
  return <Card className={warning ? "border-amber-300" : undefined}><CardContent className="flex items-start justify-between gap-4 p-4"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{typeof value === "number" ? value.toLocaleString("es-CL") : value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><Icon className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
}

"use client"

import { FormEvent, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"

const domains = [
  "Hospitalidad y reservas",
  "Traslados y logística",
  "Actividades",
  "Housekeeping",
  "Mantenimiento e incidencias",
  "Inventario y activos",
  "Compras y proveedores",
  "Propiedades e infraestructura",
  "Personas y tareas",
  "Facturación interna y pagos",
]

export default function NewSopPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const formData = new FormData(event.currentTarget)
    const code = String(formData.get("code") ?? "").trim().toUpperCase()
    const title = String(formData.get("title") ?? "").trim()
    const domain = String(formData.get("domain") ?? "").trim()
    const description = String(formData.get("description") ?? "").trim()
    const ownerRole = String(formData.get("owner_role") ?? "").trim()
    const objective = String(formData.get("objective") ?? "").trim()
    const scope = String(formData.get("scope") ?? "").trim()
    const acceptanceCriteria = String(formData.get("acceptance_criteria") ?? "").trim()
    const estimatedMinutesValue = String(formData.get("estimated_minutes") ?? "").trim()
    const estimatedMinutes = estimatedMinutesValue ? Number(estimatedMinutesValue) : null

    if (!code || !title || !domain) {
      setError("Código, nombre y área son obligatorios.")
      setSaving(false)
      return
    }

    const { data: procedure, error: procedureError } = await supabase
      .from("sop_procedures")
      .insert({
        code,
        title,
        domain,
        description: description || null,
        owner_role: ownerRole || null,
        status: "draft",
        risk_level: "low",
      })
      .select("id")
      .single()

    if (procedureError || !procedure) {
      setError(procedureError?.message ?? "No fue posible crear el procedimiento.")
      setSaving(false)
      return
    }

    const { error: versionError } = await supabase.from("sop_versions").insert({
      sop_procedure_id: procedure.id,
      version_number: 1,
      status: "draft",
      objective: objective || null,
      scope: scope || null,
      acceptance_criteria: acceptanceCriteria || null,
      estimated_minutes: estimatedMinutes,
    })

    if (versionError) {
      await supabase.from("sop_procedures").delete().eq("id", procedure.id)
      setError(versionError.message)
      setSaving(false)
      return
    }

    router.push(`/sop/${procedure.id}`)
    router.refresh()
  }

  return (
    <AppLayout>
      <PageHeader
        title="Nuevo procedimiento"
        description="Registre únicamente un procedimiento real de la operación actual. El procedimiento se crea como borrador."
        actions={
          <Button variant="secondary" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 md:px-8 md:py-8">
        <section className="grid gap-5 bg-card p-5 md:grid-cols-2 md:p-6">
          <div className="space-y-2">
            <Label htmlFor="code">Código</Label>
            <Input id="code" name="code" placeholder="SOP-HSK-001" required />
            <p className="text-xs text-muted-foreground">Use un código estable por área y secuencia.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Nombre del procedimiento</Label>
            <Input id="title" name="title" placeholder="Preparación de habitación antes de llegada" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain">Área</Label>
            <select id="domain" name="domain" required className="min-h-10 w-full bg-secondary px-3 text-sm text-foreground outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring">
              <option value="">Seleccione un área</option>
              {domains.map((domain) => <option key={domain} value={domain}>{domain}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="owner_role">Responsable del proceso</Label>
            <Input id="owner_role" name="owner_role" placeholder="Housekeeping" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Descripción breve</Label>
            <Textarea id="description" name="description" rows={3} placeholder="Cuándo se utiliza y qué resultado operacional debe asegurar." />
          </div>
        </section>

        <section className="grid gap-5 bg-card p-5 md:p-6">
          <div className="space-y-2">
            <Label htmlFor="objective">Objetivo</Label>
            <Textarea id="objective" name="objective" rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="scope">Alcance</Label>
            <Textarea id="scope" name="scope" rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acceptance_criteria">Criterio de aceptación</Label>
            <Textarea id="acceptance_criteria" name="acceptance_criteria" rows={3} placeholder="Condición verificable para considerar el procedimiento correctamente ejecutado." />
          </div>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="estimated_minutes">Tiempo estimado en minutos</Label>
            <Input id="estimated_minutes" name="estimated_minutes" type="number" min="1" step="1" />
          </div>
        </section>

        {error && (
          <div role="alert" className="bg-card px-5 py-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()} disabled={saving}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Guardando…" : "Guardar borrador"}
          </Button>
        </div>
      </form>
    </AppLayout>
  )
}

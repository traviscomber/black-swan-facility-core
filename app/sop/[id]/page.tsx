import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CheckSquare, Clock3, Plus } from "lucide-react"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

type SopStep = {
  id: string
  step_number: number
  title: string
  instruction: string
  is_required: boolean
  requires_evidence: boolean
  evidence_type: string | null
  requires_approval: boolean
  expected_minutes: number | null
  safety_notes: string | null
}

type SopVersion = {
  id: string
  version_number: number
  status: string
  objective: string | null
  scope: string | null
  acceptance_criteria: string | null
  estimated_minutes: number | null
  sop_steps: SopStep[]
}

type SopProcedure = {
  id: string
  code: string
  title: string
  domain: string
  owner_role: string | null
  description: string | null
  status: string
  risk_level: string
  sop_versions: SopVersion[]
}

export default async function SopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("sop_procedures")
    .select("id, code, title, domain, owner_role, description, status, risk_level, sop_versions(id, version_number, status, objective, scope, acceptance_criteria, estimated_minutes, sop_steps(id, step_number, title, instruction, is_required, requires_evidence, evidence_type, requires_approval, expected_minutes, safety_notes))")
    .eq("id", id)
    .single()

  if (error || !data) notFound()

  const procedure = data as SopProcedure
  const version = [...(procedure.sop_versions ?? [])].sort((a, b) => b.version_number - a.version_number)[0]
  const steps = [...(version?.sop_steps ?? [])].sort((a, b) => a.step_number - b.step_number)

  return (
    <AppLayout>
      <PageHeader
        title={procedure.title}
        description={`${procedure.code} · ${procedure.domain}`}
        actions={
          <Button asChild variant="secondary">
            <Link href="/sop">
              <ArrowLeft className="h-4 w-4" />
              Biblioteca SOP
            </Link>
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-[1200px] space-y-8 px-4 py-6 md:px-8 md:py-8">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-card p-5">
            <p className="text-xs text-muted-foreground">Estado</p>
            <p className="mt-2 text-sm text-[#fdd32c]">{procedure.status === "active" ? "Vigente" : "Borrador"}</p>
          </div>
          <div className="bg-card p-5">
            <p className="text-xs text-muted-foreground">Versión</p>
            <p className="bs-heading mt-2 text-xl">{version ? `v${version.version_number}` : "Sin versión"}</p>
          </div>
          <div className="bg-card p-5">
            <p className="text-xs text-muted-foreground">Responsable</p>
            <p className="mt-2 text-sm text-foreground">{procedure.owner_role || "Pendiente"}</p>
          </div>
          <div className="bg-card p-5">
            <p className="text-xs text-muted-foreground">Tiempo estimado</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
              <Clock3 className="h-4 w-4 text-[#8bcba8]" />
              {version?.estimated_minutes ? `${version.estimated_minutes} minutos` : "Sin definir"}
            </p>
          </div>
        </section>

        <section className="grid gap-6 bg-card p-5 md:grid-cols-2 md:p-6">
          <div>
            <h2 className="text-xl">Objetivo</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{version?.objective || "Objetivo pendiente de documentar."}</p>
          </div>
          <div>
            <h2 className="text-xl">Alcance</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{version?.scope || "Alcance pendiente de documentar."}</p>
          </div>
          <div className="md:col-span-2">
            <h2 className="text-xl">Criterio de aceptación</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{version?.acceptance_criteria || "Criterio pendiente de documentar."}</p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl">Pasos del procedimiento</h2>
              <p className="mt-2 text-sm text-muted-foreground">Secuencia ejecutable que luego se copiará a cada tarea SOP.</p>
            </div>
            <Button disabled title="El editor de pasos será el siguiente bloque de implementación">
              <Plus className="h-4 w-4" />
              Agregar paso
            </Button>
          </div>

          {steps.length === 0 ? (
            <div className="bg-card p-6 md:p-8">
              <CheckSquare className="h-6 w-6 text-[#8bcba8]" />
              <h3 className="mt-4 text-xl">Todavía no hay pasos registrados</h3>
              <p className="mt-2 text-sm text-muted-foreground">El procedimiento seguirá en borrador hasta definir su secuencia operacional.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {steps.map((step) => (
                <article key={step.id} className="grid gap-4 bg-card p-5 md:grid-cols-[48px_1fr_auto] md:items-start">
                  <span className="bs-heading text-2xl text-[#8bcba8]">{String(step.step_number).padStart(2, "0")}</span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg">{step.title}</h3>
                      {step.is_required && <Badge className="bg-[#fdd32c]/14 text-[#fdd32c]">Obligatorio</Badge>}
                      {step.requires_evidence && <Badge className="bg-[#4679ae]/22 text-[#36b6f8]">Evidencia</Badge>}
                      {step.requires_approval && <Badge className="bg-[#8bcba8]/14 text-[#8bcba8]">Aprobación</Badge>}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.instruction}</p>
                    {step.safety_notes && <p className="mt-3 text-xs text-[#ffa114]">Seguridad: {step.safety_notes}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground">{step.expected_minutes ? `${step.expected_minutes} min` : "—"}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  )
}

import Link from "next/link"
import { BookOpen, Clock3, Plus, ShieldCheck } from "lucide-react"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

type SopProcedure = {
  id: string
  code: string
  title: string
  domain: string
  owner_role: string | null
  status: string
  risk_level: string
  next_review_date: string | null
  updated_at: string
  sop_versions?: Array<{
    id: string
    version_number: number
    status: string
    estimated_minutes: number | null
  }>
}

const statusLabel: Record<string, string> = {
  draft: "Borrador",
  active: "Vigente",
  archived: "Obsoleto",
}

const statusClass: Record<string, string> = {
  draft: "bg-[#fdd32c]/14 text-[#fdd32c]",
  active: "bg-[#8bcba8]/14 text-[#8bcba8]",
  archived: "bg-[#847c72]/16 text-[#b9b0a4]",
}

export default async function SopLibraryPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("sop_procedures")
    .select("id, code, title, domain, owner_role, status, risk_level, next_review_date, updated_at, sop_versions(id, version_number, status, estimated_minutes)")
    .order("domain")
    .order("code")

  const procedures = (data ?? []) as SopProcedure[]
  const activeCount = procedures.filter((procedure) => procedure.status === "active").length
  const draftCount = procedures.filter((procedure) => procedure.status === "draft").length

  return (
    <AppLayout>
      <PageHeader
        title="Procedimientos operacionales"
        description="Biblioteca simple de SOP para los procesos que ya existen en el portal. Cada procedimiento puede vincularse con tareas y documentos operacionales."
        actions={
          <Button asChild>
            <Link href="/sop/new">
              <Plus className="h-4 w-4" />
              Nuevo procedimiento
            </Link>
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-[1440px] space-y-8 px-4 py-6 md:px-8 md:py-8">
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="bg-card p-5">
            <p className="text-xs text-muted-foreground">Procedimientos registrados</p>
            <p className="bs-heading mt-2 text-2xl text-foreground">{procedures.length}</p>
          </div>
          <div className="bg-card p-5">
            <p className="text-xs text-muted-foreground">Vigentes</p>
            <p className="bs-heading mt-2 text-2xl text-[#8bcba8]">{activeCount}</p>
          </div>
          <div className="bg-card p-5">
            <p className="text-xs text-muted-foreground">Borradores</p>
            <p className="bs-heading mt-2 text-2xl text-[#fdd32c]">{draftCount}</p>
          </div>
        </section>

        {error ? (
          <section className="bg-card p-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <h2 className="text-lg">No fue posible cargar los procedimientos</h2>
                <p className="mt-2 text-sm text-muted-foreground">Revise el acceso a la biblioteca SOP y vuelva a intentar.</p>
              </div>
            </div>
          </section>
        ) : procedures.length === 0 ? (
          <section className="bg-card px-6 py-12 md:px-10">
            <div className="max-w-2xl">
              <BookOpen className="h-7 w-7 text-[#8bcba8]" />
              <h2 className="mt-5 text-2xl">La biblioteca SOP todavía está vacía</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Cree el primer procedimiento real del equipo. No se han cargado plantillas ficticias ni procesos genéricos.
              </p>
              <Button asChild className="mt-6">
                <Link href="/sop/new">
                  <Plus className="h-4 w-4" />
                  Crear primer procedimiento
                </Link>
              </Button>
            </div>
          </section>
        ) : (
          <section className="bg-card">
            <div className="grid grid-cols-[minmax(120px,0.7fr)_minmax(240px,2fr)_minmax(140px,1fr)_minmax(120px,0.8fr)_minmax(100px,0.7fr)] gap-4 bg-secondary px-5 py-3 text-xs font-medium text-muted-foreground">
              <span>Código</span>
              <span>Procedimiento</span>
              <span>Área</span>
              <span>Estado</span>
              <span>Duración</span>
            </div>
            <div>
              {procedures.map((procedure) => {
                const latestVersion = [...(procedure.sop_versions ?? [])].sort((a, b) => b.version_number - a.version_number)[0]
                return (
                  <Link
                    key={procedure.id}
                    href={`/sop/${procedure.id}`}
                    className="grid grid-cols-[minmax(120px,0.7fr)_minmax(240px,2fr)_minmax(140px,1fr)_minmax(120px,0.8fr)_minmax(100px,0.7fr)] gap-4 px-5 py-4 text-sm transition-colors hover:bg-[#5d554a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                  >
                    <span className="font-medium text-foreground">{procedure.code}</span>
                    <span>
                      <span className="block text-foreground">{procedure.title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {procedure.owner_role ? `Responsable: ${procedure.owner_role}` : "Responsable pendiente"}
                      </span>
                    </span>
                    <span className="text-muted-foreground">{procedure.domain}</span>
                    <span>
                      <Badge className={statusClass[procedure.status] ?? statusClass.archived}>
                        {statusLabel[procedure.status] ?? procedure.status}
                      </Badge>
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Clock3 className="h-4 w-4" />
                      {latestVersion?.estimated_minutes ? `${latestVersion.estimated_minutes} min` : "Sin definir"}
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  )
}

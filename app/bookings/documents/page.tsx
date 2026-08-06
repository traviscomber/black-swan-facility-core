"use client"

import Link from "next/link"
import { ExternalLink, FileArchive, FileCheck2, FileSpreadsheet, FileText, FolderLock, ShieldCheck } from "lucide-react"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const REPOSITORY_URL = "https://github.com/traviscomber/black-swan-facility-core"
const DOCUMENTS_URL = `${REPOSITORY_URL}/tree/main/docs/mutual`

const documents = [
  { code: "00", title: "Carpeta de presentación Mutual", type: "DOCX / PDF", icon: FileText },
  { code: "01", title: "Política de Seguridad y Salud en el Trabajo", type: "DOCX / PDF", icon: ShieldCheck },
  { code: "02", title: "Acta de designación del Encargado SST", type: "DOCX / PDF", icon: FileCheck2 },
  { code: "03", title: "Plan de emergencia y respuesta", type: "DOCX / PDF", icon: FileText },
  { code: "04", title: "Manual agrupado de SOP preventivos", type: "DOCX / PDF", icon: FileText },
  { code: "05", title: "Borrador de Reglamento Interno de Higiene y Seguridad", type: "DOCX / PDF", icon: FileText },
  { code: "06", title: "Formularios y registros SST", type: "DOCX / PDF", icon: FileText },
  { code: "07", title: "Checklist de visita Mutual", type: "DOCX / PDF", icon: FileCheck2 },
  { code: "08", title: "Matriz IPER y programa preventivo", type: "XLSX", icon: FileSpreadsheet },
  { code: "09", title: "Checklist maestro de datos pendientes", type: "DOCX", icon: FileCheck2 },
  { code: "10", title: "Paquete documental consolidado", type: "ZIP / PDF", icon: FileArchive },
]

export default function BookingDocumentsPage() {
  const { access, loading } = useEffectiveAccess()
  const allowed = access.is_admin || access.role === "approver"

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Validando acceso documental…</div>
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Alert variant="destructive">
          <FolderLock className="h-4 w-4" />
          <AlertTitle>Acceso restringido</AlertTitle>
          <AlertDescription>
            El repositorio documental está disponible únicamente para Administración y usuarios con rol de aprobación.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <main className="h-full overflow-y-auto bg-background p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <FolderLock className="h-5 w-5 text-primary" />
              <Badge variant="outline">Acceso controlado</Badge>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Repositorio documental</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Documentación preventiva de Blackswan Facility Core para Mutual de Seguridad, control interno y operación del Fundo Corcovado.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={DOCUMENTS_URL} target="_blank" rel="noreferrer">
              Abrir repositorio técnico <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Control documental</AlertTitle>
          <AlertDescription>
            Los archivos binarios firmados y las evidencias personales no deben publicarse en GitHub. Esta vista funciona como índice controlado; las versiones maestras deben almacenarse en un repositorio privado con trazabilidad y descarga autenticada.
          </AlertDescription>
        </Alert>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {documents.map((document) => {
            const Icon = document.icon
            return (
              <Card key={document.code} className="border-border/80 bg-card/80">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-9 w-9 items-center justify-center border bg-muted">
                      <Icon className="h-4 w-4" />
                    </div>
                    <Badge variant="secondary">{document.type}</Badge>
                  </div>
                  <CardTitle className="pt-2 text-base">{document.code} · {document.title}</CardTitle>
                  <CardDescription>Versión base 2026-08-07 · Borrador controlado</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Propietario: Administración</span>
                    <span>Revisión pendiente</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Administración del repositorio</CardTitle>
            <CardDescription>
              El índice técnico, historial de cambios y procedimientos de publicación viven en GitHub. Los documentos firmados y la evidencia operacional deben permanecer fuera del repositorio público.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={DOCUMENTS_URL} target="_blank" rel="noreferrer">
                Ver índice Mutual <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={REPOSITORY_URL} target="_blank" rel="noreferrer">
                Ver proyecto en GitHub <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

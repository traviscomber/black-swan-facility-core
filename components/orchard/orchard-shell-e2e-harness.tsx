"use client"

import { OrchardMobileShell } from "@/components/orchard/orchard-mobile-shell"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

export function OrchardShellE2EHarness() {
  return (
    <>
      <OrchardNavigation />
      <OrchardMobileShell />
      <span data-testid="e2e-hydrated" className="sr-only">ready</span>
      <main data-testid="orchard-mobile-shell-root" className="min-h-screen bg-background px-3 py-4 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-5xl space-y-5">
          <header className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Orchard · QA determinística</p>
            <h1>Operación de terreno</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">Superficie representativa para validar targets táctiles, tabs, formularios, tarjetas y tablas sin depender de datos de producción.</p>
          </header>

          <div role="tablist" aria-label="Secciones Orchard" className="flex gap-2 rounded-xl border p-1">
            <Button role="tab" aria-selected="true" variant="secondary">Trabajo</Button>
            <Button role="tab" aria-selected="false" variant="ghost">Crop Map</Button>
            <Button role="tab" aria-selected="false" variant="ghost">Calendario</Button>
            <Button role="tab" aria-selected="false" variant="ghost">Inventario</Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Nueva tarea</CardTitle>
                <CardDescription>Formulario de campo con controles reales del sistema.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input aria-label="Título" defaultValue="Revisar cama 04" />
                <Input aria-label="Fecha" type="date" defaultValue="2026-09-09" />
                <Textarea aria-label="Instrucciones" defaultValue="Verificar condición y registrar observaciones antes de cerrar." />
                <Button className="w-full sm:w-auto">Crear tarea</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumen de turno</CardTitle>
                <CardDescription>Contenido compacto para lectura rápida en terreno.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div><p className="text-muted-foreground">Abiertas</p><p className="mt-1 text-2xl font-medium">8</p></div>
                <div><p className="text-muted-foreground">Hoy</p><p className="mt-1 text-2xl font-medium">3</p></div>
                <div><p className="text-muted-foreground">Minutos</p><p className="mt-1 text-2xl font-medium">145</p></div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Trabajo operativo</CardTitle>
              <CardDescription>La tabla conserva su overflow horizontal nativo en viewport móvil.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarea</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Revisar cama 04</TableCell>
                    <TableCell>Current</TableCell>
                    <TableCell>Equipo Orchard</TableCell>
                    <TableCell>En progreso</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Preparar trasplante</TableCell>
                    <TableCell>Expansion</TableCell>
                    <TableCell>Sin asignar</TableCell>
                    <TableCell>Nueva</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div data-slot="dialog-content" className="mx-auto w-full max-w-lg border p-4">
            <h2 className="text-lg font-medium">Diálogo representativo</h2>
            <p className="mt-2 text-sm text-muted-foreground">Valida que un diálogo no exceda el viewport móvil y conserve desplazamiento vertical.</p>
          </div>
        </div>
      </main>
    </>
  )
}

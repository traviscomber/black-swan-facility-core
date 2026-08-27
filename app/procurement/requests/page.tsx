"use client"

import type React from "react"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createBrowserClient } from "@/lib/supabase/client"
import { ArrowLeft, ClipboardList, Plus } from "lucide-react"

interface ProcurementRequest {
  id: string
  request_number: string | null
  title: string
  category: string
  quantity: number
  unit: string
  estimated_budget_clp: number | null
  priority: "low" | "normal" | "high" | "critical"
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected" | "converted"
  required_date: string | null
  commune: string
  created_at: string
}

type ProcurementLocation = { id: string; name: string }

const initialForm = {
  title: "",
  description: "",
  business_justification: "",
  category: "Supplies",
  quantity: "1",
  unit: "unidad",
  estimated_budget_clp: "",
  priority: "normal",
  status: "submitted",
  required_date: "",
  region: "Los Ríos",
  commune: "Valdivia",
  location_id: "",
  delivery_location: "",
}

function formatClp(value: number | null) {
  if (value === null) return "-"
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value)
}

function statusClass(status: ProcurementRequest["status"]) {
  switch (status) {
    case "approved":
      return "border-green-500/40 text-green-500"
    case "rejected":
      return "border-red-500/40 text-red-500"
    case "under_review":
      return "border-blue-500/40 text-blue-500"
    case "converted":
      return "border-purple-500/40 text-purple-500"
    case "submitted":
      return "border-amber-500/40 text-amber-500"
    default:
      return ""
  }
}

export default function ProcurementRequestsPage() {
  const [requests, setRequests] = useState<ProcurementRequest[]>([])
  const [locations, setLocations] = useState<ProcurementLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(initialForm)

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError(null)

    const supabase = createBrowserClient()
    const [requestsResult, locationsResult] = await Promise.all([
      supabase
        .from("procurement_requests")
        .select("id, request_number, title, category, quantity, unit, estimated_budget_clp, priority, status, required_date, commune, created_at")
        .order("created_at", { ascending: false }),
      supabase.rpc("get_procurement_location_directory"),
    ])

    if (requestsResult.error) {
      setError(
        requestsResult.error.code === "42P01"
          ? "La tabla procurement_requests todavía no existe. Aplica la migración Supabase incluida en esta rama."
          : requestsResult.error.message,
      )
      setRequests([])
    } else {
      setRequests((requestsResult.data ?? []) as ProcurementRequest[])
    }

    if (locationsResult.error) {
      setError((current) => current ?? `No fue posible cargar las propiedades autorizadas: ${locationsResult.error.message}`)
      setLocations([])
    } else {
      setLocations((locationsResult.data ?? []) as ProcurementLocation[])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    if (!form.location_id) {
      setError("Selecciona la propiedad o ubicación operacional de la solicitud.")
      setSubmitting(false)
      return
    }

    const supabase = createBrowserClient()
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      setError("La sesión expiró. Vuelve a iniciar sesión antes de registrar la solicitud.")
      setSubmitting(false)
      return
    }

    const estimatedBudget = form.estimated_budget_clp
      ? Number.parseFloat(form.estimated_budget_clp)
      : null

    const { error: insertError } = await supabase.from("procurement_requests").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      business_justification: form.business_justification.trim(),
      category: form.category,
      quantity: Number.parseFloat(form.quantity),
      unit: form.unit.trim() || "unidad",
      estimated_budget_clp: estimatedBudget,
      priority: form.priority,
      status: form.status,
      required_date: form.required_date || null,
      region: form.region,
      commune: form.commune,
      location_id: form.location_id,
      delivery_location: form.delivery_location.trim() || null,
      requested_by: authData.user.id,
    })

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
      return
    }

    setForm(initialForm)
    setDialogOpen(false)
    setSubmitting(false)
    await loadRequests()
  }

  const totals = {
    all: requests.length,
    submitted: requests.filter((request) => request.status === "submitted").length,
    review: requests.filter((request) => request.status === "under_review").length,
    approved: requests.filter((request) => request.status === "approved").length,
  }

  return (
    <AppLayout>
      <PageHeader
        title="Solicitudes de compra"
        description="Requerimientos operativos conectados a su ciclo completo de compra"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/procurement">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Órdenes actuales
              </Link>
            </Button>
            <Button onClick={() => setDialogOpen(true)} disabled={locations.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva solicitud
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        {error && (
          <Card className="border-red-500/40">
            <CardContent className="pt-6 text-sm text-red-500">{error}</CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{totals.all}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Enviadas</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{totals.submitted}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">En revisión</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{totals.review}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Aprobadas</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{totals.approved}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              <CardTitle>Requerimientos internos</CardTitle>
            </div>
            <CardDescription>
              Abre cualquier solicitud para seguir cotización, aprobación, orden, recepción e ingreso a stock desde un solo objeto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Solicitud</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Presupuesto</TableHead>
                    <TableHead>Comuna</TableHead>
                    <TableHead>Fecha requerida</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                        Cargando solicitudes...
                      </TableCell>
                    </TableRow>
                  ) : requests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                        No hay solicitudes registradas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    requests.map((request) => (
                      <TableRow key={request.id} className="group">
                        <TableCell className="font-mono text-xs"><Link href={`/procurement/requests/${request.id}`} className="hover:text-primary hover:underline">{request.request_number ?? "Pendiente"}</Link></TableCell>
                        <TableCell className="font-medium"><Link href={`/procurement/requests/${request.id}`} className="group-hover:text-primary hover:underline">{request.title}</Link></TableCell>
                        <TableCell>{request.category}</TableCell>
                        <TableCell>
                          {request.quantity} {request.unit}
                        </TableCell>
                        <TableCell>{formatClp(request.estimated_budget_clp)}</TableCell>
                        <TableCell>{request.commune}</TableCell>
                        <TableCell>{request.required_date ?? "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{request.priority}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusClass(request.status)}>
                            {request.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva solicitud de compra</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input
                required
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Ej. Insumos de limpieza para operación mensual"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Descripción</label>
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Especificaciones, calidad y alcance requerido"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Justificación del negocio</label>
              <textarea
                required
                value={form.business_justification}
                onChange={(event) => setForm({ ...form, business_justification: event.target.value })}
                className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Por qué se requiere y qué operación depende de esta compra"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Categoría</label>
                <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Equipment">Equipamiento</SelectItem>
                    <SelectItem value="Supplies">Insumos</SelectItem>
                    <SelectItem value="Services">Servicios</SelectItem>
                    <SelectItem value="Maintenance">Mantención</SelectItem>
                    <SelectItem value="Construction">Construcción</SelectItem>
                    <SelectItem value="Other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Prioridad</label>
                <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="critical">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium">Cantidad</label>
                <Input required min="0.01" step="0.01" type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Unidad</label>
                <Input required value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Presupuesto CLP</label>
                <Input min="0" step="1" type="number" value={form.estimated_budget_clp} onChange={(event) => setForm({ ...form, estimated_budget_clp: event.target.value })} className="mt-1" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Propiedad / ubicación operacional</label>
                <Select required value={form.location_id} onValueChange={(value) => setForm({ ...form, location_id: value })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona una propiedad" /></SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Fecha requerida</label>
                <Input type="date" value={form.required_date} onChange={(event) => setForm({ ...form, required_date: event.target.value })} className="mt-1" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Comuna</label>
                <Input required value={form.commune} onChange={(event) => setForm({ ...form, commune: event.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Detalle del lugar de entrega</label>
                <Input value={form.delivery_location} onChange={(event) => setForm({ ...form, delivery_location: event.target.value })} placeholder="Bodega, edificio, acceso o instrucciones" className="mt-1" />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">La propiedad seleccionada define el scope operacional. El detalle de entrega es solo una instrucción humana y no reemplaza la ubicación canónica.</p>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting || !form.location_id}>
                {submitting ? "Guardando..." : "Registrar solicitud"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, ExternalLink, Pencil, Plus, RotateCcw, X } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createBrowserClient } from "@/lib/supabase/client"
import { AddSupplierDialog } from "@/components/add-supplier-dialog"
import { EditSupplierDialog } from "@/components/edit-supplier-dialog"
import { DeleteSupplierButton } from "@/components/delete-supplier-button"

interface Supplier {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  rut: string | null
  address: string | null
  commune: string | null
  region: string | null
  rating: number
  is_active: boolean
  notes: string | null
  approval_status: "pending" | "approved" | "rejected"
  category: string | null
  website: string | null
  source_url: string | null
  coverage_notes: string | null
  last_verified_at: string | null
}

const APPROVER_EMAILS = new Set(["juan@n3uralia.com", "raimundo@blackswn.org", "santiago@blackswn.org"])
const statusLabel = { pending: "Pendiente", approved: "Aprobado", rejected: "Rechazado" }

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [canApprove, setCanApprove] = useState(false)

  const loadSuppliers = async () => {
    setLoading(true)
    setError(null)
    const supabase = createBrowserClient()
    const [{ data, error: suppliersError }, { data: authData }] = await Promise.all([
      supabase.from("suppliers").select("id, name, contact_name, email, phone, rut, address, commune, region, rating, is_active, notes, approval_status, category, website, source_url, coverage_notes, last_verified_at").order("approval_status").order("name"),
      supabase.auth.getUser(),
    ])

    if (suppliersError) {
      setError(`No fue posible cargar los proveedores: ${suppliersError.message}`)
      setSuppliers([])
    } else {
      setSuppliers((data ?? []) as Supplier[])
    }

    const user = authData.user
    const email = user?.email?.toLowerCase() ?? ""
    const role = user?.app_metadata?.procurement_role
    setCanApprove(APPROVER_EMAILS.has(email) && (role === "approver" || role === "admin"))
    setLoading(false)
  }

  useEffect(() => { void loadSuppliers() }, [])

  const counts = useMemo(() => ({
    total: suppliers.length,
    pending: suppliers.filter((supplier) => supplier.approval_status === "pending").length,
    approved: suppliers.filter((supplier) => supplier.approval_status === "approved").length,
    rejected: suppliers.filter((supplier) => supplier.approval_status === "rejected").length,
  }), [suppliers])

  const updateApproval = async (supplier: Supplier, nextStatus: Supplier["approval_status"]) => {
    setUpdatingId(supplier.id)
    setError(null)
    const supabase = createBrowserClient()
    const { error: approvalError } = await supabase.rpc("set_supplier_approval", { supplier_id: supplier.id, next_status: nextStatus })
    if (approvalError) {
      setError(`No fue posible actualizar ${supplier.name}: ${approvalError.message}`)
      setUpdatingId(null)
      return
    }
    await loadSuppliers()
    setUpdatingId(null)
  }

  return (
    <AppLayout>
      <PageHeader title="Proveedores · Fundo Corcovado" description="Directorio, revisión y habilitación de proveedores para el flujo de compras." actions={<Button onClick={() => setShowAddDialog(true)}><Plus className="mr-2 h-4 w-4" />Agregar candidato</Button>} />

      <div className="space-y-6 p-4 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Total registrados" value={counts.total} />
          <Metric title="Pendientes de revisión" value={counts.pending} alert={counts.pending > 0} />
          <Metric title="Aprobados" value={counts.approved} />
          <Metric title="Rechazados" value={counts.rejected} />
        </div>

        {error && <Card className="border-destructive/60"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => void loadSuppliers()}>Reintentar</Button></CardContent></Card>}

        <Card>
          <CardHeader><CardTitle>Directorio y revisión</CardTitle><CardDescription>Los candidatos permanecen inactivos hasta ser aprobados. La aprobación activa automáticamente al proveedor para compras.</CardDescription></CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Proveedor</TableHead><TableHead>Categoría</TableHead><TableHead>Ubicación</TableHead><TableHead>Contacto</TableHead><TableHead>Fuente</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>
                  {loading ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Cargando proveedores…</TableCell></TableRow> : suppliers.length === 0 ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No hay proveedores registrados.</TableCell></TableRow> : suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="min-w-64 align-top"><p className="font-medium">{supplier.name}</p>{supplier.rut && <p className="mt-1 text-xs text-muted-foreground">RUT: {supplier.rut}</p>}{supplier.coverage_notes && <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{supplier.coverage_notes}</p>}{supplier.last_verified_at && <p className="mt-2 text-[11px] text-muted-foreground">Verificado: {new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago" }).format(new Date(supplier.last_verified_at))}</p>}</TableCell>
                      <TableCell className="align-top text-sm">{supplier.category || "Sin categoría"}</TableCell>
                      <TableCell className="align-top text-sm">{[supplier.commune, supplier.region].filter(Boolean).join(", ") || "No informada"}</TableCell>
                      <TableCell className="align-top text-sm"><div className="space-y-1"><p>{supplier.contact_name || "Sin contacto asignado"}</p>{supplier.email && <p className="text-muted-foreground">{supplier.email}</p>}{supplier.phone && <p className="text-muted-foreground">{supplier.phone}</p>}</div></TableCell>
                      <TableCell className="align-top">{supplier.source_url || supplier.website ? <a href={supplier.source_url || supplier.website || "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">Revisar fuente <ExternalLink className="h-3.5 w-3.5" /></a> : <span className="text-sm text-muted-foreground">Sin fuente registrada</span>}</TableCell>
                      <TableCell className="align-top"><Badge variant="outline">{statusLabel[supplier.approval_status]}</Badge></TableCell>
                      <TableCell className="align-top text-right"><div className="flex min-w-max items-center justify-end gap-1">
                        {canApprove && supplier.approval_status !== "approved" && <Button size="sm" variant="ghost" disabled={updatingId === supplier.id} onClick={() => void updateApproval(supplier, "approved")} title="Aprobar"><Check className="h-4 w-4" /></Button>}
                        {canApprove && supplier.approval_status !== "rejected" && <Button size="sm" variant="ghost" disabled={updatingId === supplier.id} onClick={() => void updateApproval(supplier, "rejected")} title="Rechazar"><X className="h-4 w-4" /></Button>}
                        {canApprove && supplier.approval_status !== "pending" && <Button size="sm" variant="ghost" disabled={updatingId === supplier.id} onClick={() => void updateApproval(supplier, "pending")} title="Devolver a revisión"><RotateCcw className="h-4 w-4" /></Button>}
                        <Button variant="ghost" size="sm" onClick={() => setEditingSupplier(supplier)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                        {canApprove && <DeleteSupplierButton supplierId={supplier.id} supplierName={supplier.name} onDeleted={() => void loadSuppliers()} />}
                      </div></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {!canApprove && !loading && <p className="mt-4 text-xs text-muted-foreground">Tu cuenta puede consultar y editar información, pero no aprobar, rechazar ni desactivar proveedores.</p>}
          </CardContent>
        </Card>
      </div>

      <AddSupplierDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSupplierAdded={() => { void loadSuppliers(); setShowAddDialog(false) }} />
      {editingSupplier && <EditSupplierDialog supplier={editingSupplier} open={!!editingSupplier} onOpenChange={(open) => !open && setEditingSupplier(null)} onSupplierUpdated={() => { void loadSuppliers(); setEditingSupplier(null) }} />}
    </AppLayout>
  )
}

function Metric({ title, value, alert = false }: { title: string; value: number; alert?: boolean }) {
  return <Card className={alert ? "border-amber-300" : undefined}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{value.toLocaleString("es-CL")}</div></CardContent></Card>
}

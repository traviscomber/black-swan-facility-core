"use client"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createBrowserClient } from "@/lib/supabase/client"
import { Check, ExternalLink, Pencil, Plus, RotateCcw, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { AddSupplierDialog } from "@/components/add-supplier-dialog"
import { EditSupplierDialog } from "@/components/edit-supplier-dialog"
import { DeleteSupplierButton } from "@/components/delete-supplier-button"

interface Supplier {
  id: string
  name: string
  contact_person: string
  email: string
  phone: string
  address: string
  city: string
  country: string
  payment_terms: string
  rating: number
  is_active: boolean
  notes: string
  approval_status: "pending" | "approved" | "rejected"
  category: string | null
  website: string | null
  source_url: string | null
  coverage_notes: string | null
  last_verified_at: string | null
}

const APPROVER_EMAILS = new Set([
  "juan@n3uralia.com",
  "raimundo@blackswn.org",
  "santiago@blackswn.org",
])

const statusLabel: Record<Supplier["approval_status"], string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
}

const statusClass: Record<Supplier["approval_status"], string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  rejected: "border-red-500/40 bg-red-500/10 text-red-300",
}

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
      supabase.from("suppliers").select("*").order("approval_status").order("name"),
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

  useEffect(() => {
    loadSuppliers()
  }, [])

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
    const { error: approvalError } = await supabase.rpc("set_supplier_approval", {
      supplier_id: supplier.id,
      next_status: nextStatus,
    })

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
      <PageHeader
        title="Proveedores"
        description="Revisión, aprobación y administración de proveedores operativos"
        actions={
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar candidato
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total registrados</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-accent">{counts.total}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pendientes de revisión</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-amber-300">{counts.pending}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Aprobados</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-emerald-300">{counts.approved}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Rechazados</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-red-300">{counts.rejected}</div></CardContent></Card>
        </div>

        {error && (
          <Card className="border-destructive/60">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={loadSuppliers}>Reintentar</Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Directorio y revisión</CardTitle>
            <CardDescription>
              Los candidatos investigados permanecen inactivos hasta que un aprobador autorizado los apruebe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-secondary">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Fuente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Cargando proveedores…</TableCell></TableRow>
                  ) : suppliers.length > 0 ? (
                    suppliers.map((supplier) => (
                      <TableRow key={supplier.id} className={supplier.approval_status === "pending" ? "bg-amber-500/[0.03]" : ""}>
                        <TableCell className="min-w-64 align-top">
                          <p className="font-medium">{supplier.name}</p>
                          {supplier.coverage_notes && <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{supplier.coverage_notes}</p>}
                          {supplier.last_verified_at && <p className="mt-2 text-[11px] text-muted-foreground">Verificado: {new Date(supplier.last_verified_at).toLocaleDateString("es-CL")}</p>}
                        </TableCell>
                        <TableCell className="align-top text-sm">{supplier.category || "Sin categoría"}</TableCell>
                        <TableCell className="align-top text-sm">{[supplier.city, supplier.country].filter(Boolean).join(", ") || "No informada"}</TableCell>
                        <TableCell className="align-top text-sm">
                          <div className="space-y-1">
                            <p>{supplier.contact_person || "Sin contacto asignado"}</p>
                            {supplier.email && <p className="text-muted-foreground">{supplier.email}</p>}
                            {supplier.phone && <p className="text-muted-foreground">{supplier.phone}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          {supplier.source_url || supplier.website ? (
                            <a href={supplier.source_url || supplier.website || "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                              Revisar fuente <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : <span className="text-sm text-muted-foreground">Pendiente</span>}
                        </TableCell>
                        <TableCell className="align-top"><Badge variant="outline" className={statusClass[supplier.approval_status]}>{statusLabel[supplier.approval_status]}</Badge></TableCell>
                        <TableCell className="align-top text-right">
                          <div className="flex min-w-max items-center justify-end gap-1">
                            {canApprove && supplier.approval_status !== "approved" && (
                              <Button size="sm" variant="ghost" disabled={updatingId === supplier.id} onClick={() => updateApproval(supplier, "approved")} aria-label={`Aprobar ${supplier.name}`} title="Aprobar">
                                <Check className="h-4 w-4 text-emerald-400" />
                              </Button>
                            )}
                            {canApprove && supplier.approval_status !== "rejected" && (
                              <Button size="sm" variant="ghost" disabled={updatingId === supplier.id} onClick={() => updateApproval(supplier, "rejected")} aria-label={`Rechazar ${supplier.name}`} title="Rechazar">
                                <X className="h-4 w-4 text-red-400" />
                              </Button>
                            )}
                            {canApprove && supplier.approval_status !== "pending" && (
                              <Button size="sm" variant="ghost" disabled={updatingId === supplier.id} onClick={() => updateApproval(supplier, "pending")} aria-label={`Devolver ${supplier.name} a revisión`} title="Devolver a revisión">
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setEditingSupplier(supplier)} aria-label={`Editar ${supplier.name}`} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <DeleteSupplierButton supplierId={supplier.id} supplierName={supplier.name} onDeleted={loadSuppliers} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No hay proveedores registrados.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {!canApprove && !loading && (
              <p className="mt-4 text-xs text-muted-foreground">Tu cuenta puede consultar y editar información, pero no aprobar o rechazar proveedores.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <AddSupplierDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSupplierAdded={() => { loadSuppliers(); setShowAddDialog(false) }} />
      {editingSupplier && (
        <EditSupplierDialog supplier={editingSupplier} open={!!editingSupplier} onOpenChange={(open) => !open && setEditingSupplier(null)} onSupplierUpdated={() => { loadSuppliers(); setEditingSupplier(null) }} />
      )}
    </AppLayout>
  )
}

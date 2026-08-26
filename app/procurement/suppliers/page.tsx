"use client"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createBrowserClient } from "@/lib/supabase/client"
import { Plus, Pencil, Star } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
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
  category: string | null
  website: string | null
  source_url: string | null
  coverage_notes: string | null
  notes: string | null
  rating: number
  is_active: boolean
}

export default function SuppliersPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  const loadSuppliers = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from("suppliers")
      .select("id,name,contact_name,email,phone,rut,address,commune,region,category,website,source_url,coverage_notes,notes,rating,is_active")
      .order("name")

    if (loadError) {
      setError(loadError.message)
      setSuppliers([])
    } else {
      setSuppliers((data ?? []).map((supplier) => ({ ...supplier, rating: Number(supplier.rating ?? 0), is_active: Boolean(supplier.is_active) })))
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void loadSuppliers() }, [loadSuppliers])

  const activeCount = suppliers.filter((supplier) => supplier.is_active).length
  const avgRating = suppliers.length > 0 ? suppliers.reduce((sum, supplier) => sum + supplier.rating, 0) / suppliers.length : 0

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return "text-green-500"
    if (rating >= 3.5) return "text-yellow-500"
    return "text-red-500"
  }

  return (
    <AppLayout>
      <PageHeader
        title="Proveedores"
        description="Directorio, contacto y evaluación registrada de proveedores."
        actions={<Button onClick={() => setShowAddDialog(true)}><Plus className="mr-2 h-4 w-4" />Agregar proveedor</Button>}
      />

      <div className="space-y-6 p-4 sm:p-8">
        {error && <Card className="border-destructive/50"><CardContent className="p-4 text-sm text-destructive">No fue posible cargar proveedores: {error}</CardContent></Card>}

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Proveedores registrados</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-accent">{suppliers.length}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Proveedores activos</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-accent">{activeCount}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Evaluación promedio</CardTitle></CardHeader><CardContent><div className="flex items-center gap-2"><div className="text-3xl font-bold text-accent">{avgRating.toFixed(1)}</div><Star className={`h-5 w-5 ${getRatingColor(avgRating)}`} fill="currentColor" /></div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Directorio de proveedores</CardTitle><CardDescription>Datos canónicos registrados para compras y abastecimiento.</CardDescription></CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-secondary">
              <Table>
                <TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Categoría</TableHead><TableHead>Contacto</TableHead><TableHead>Correo</TableHead><TableHead>Teléfono</TableHead><TableHead>Ubicación</TableHead><TableHead>Evaluación</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>
                  {loading ? <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Cargando proveedores…</TableCell></TableRow> : suppliers.length > 0 ? suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell><p className="font-medium">{supplier.name}</p>{supplier.rut && <p className="text-xs text-muted-foreground">RUT {supplier.rut}</p>}</TableCell>
                      <TableCell className="text-sm">{supplier.category || "Sin categoría"}</TableCell>
                      <TableCell>{supplier.contact_name || "-"}</TableCell>
                      <TableCell className="text-sm">{supplier.email || "-"}</TableCell>
                      <TableCell className="text-sm">{supplier.phone || "-"}</TableCell>
                      <TableCell className="text-sm">{[supplier.commune, supplier.region].filter(Boolean).join(", ") || "-"}</TableCell>
                      <TableCell><div className="flex items-center gap-1"><span className={getRatingColor(supplier.rating)}>{supplier.rating.toFixed(1)}</span><Star className={`h-4 w-4 ${getRatingColor(supplier.rating)}`} fill="currentColor" /></div></TableCell>
                      <TableCell><Badge variant={supplier.is_active ? "default" : "secondary"}>{supplier.is_active ? "Activo" : "Inactivo"}</Badge></TableCell>
                      <TableCell className="text-right"><div className="flex items-center justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setEditingSupplier(supplier)} aria-label={`Editar ${supplier.name}`}><Pencil className="h-4 w-4" /></Button><DeleteSupplierButton supplierId={supplier.id} supplierName={supplier.name} onDeleted={loadSuppliers} /></div></TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">No hay proveedores registrados.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <AddSupplierDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSupplierAdded={() => { void loadSuppliers(); setShowAddDialog(false) }} />
      {editingSupplier && <EditSupplierDialog supplier={editingSupplier} open={Boolean(editingSupplier)} onOpenChange={(open) => !open && setEditingSupplier(null)} onSupplierUpdated={() => { void loadSuppliers(); setEditingSupplier(null) }} />}
    </AppLayout>
  )
}

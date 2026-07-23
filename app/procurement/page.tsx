"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ClipboardList, Download, Pencil, Plus, RefreshCw, ShieldCheck, Users } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createBrowserClient } from "@/lib/supabase/client"
import { AddProcurementDialog } from "@/components/add-procurement-dialog"
import { EditProcurementDialog } from "@/components/edit-procurement-dialog"
import { DeleteProcurementButton } from "@/components/delete-procurement-button"

interface ProcurementItem {
  id: string
  item_name: string
  category: string
  supplier_id: string
  unit_price: number
  quantity: number
  total_cost: number
  status: string
  expected_delivery: string
  priority: string
}

interface Supplier { id: string; name: string }

const statusLabels: Record<string, string> = { pending: "Pendiente", ordered: "Ordenada", delivered: "Entregada", cancelled: "Cancelada" }
const priorityLabels: Record<string, string> = { low: "Baja", medium: "Media", high: "Alta", urgent: "Urgente" }
const numberFormatter = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 })

export default function ProcurementPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [items, setItems] = useState<ProcurementItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [pendingSuppliers, setPendingSuppliers] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<ProcurementItem | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const [itemsRes, approvedRes, pendingRes] = await Promise.all([
      supabase.from("procurement_items").select("*").order("expected_delivery", { ascending: false }),
      supabase.from("suppliers").select("id, name").eq("is_active", true).eq("approval_status", "approved").order("name"),
      supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
    ])

    const error = itemsRes.error || approvedRes.error || pendingRes.error
    if (error) {
      setLoadError(error.message)
      setItems([])
      setSuppliers([])
      setPendingSuppliers(0)
    } else {
      setItems((itemsRes.data ?? []) as ProcurementItem[])
      setSuppliers((approvedRes.data ?? []) as Supplier[])
      setPendingSuppliers(pendingRes.count ?? 0)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void loadData() }, [loadData])

  const supplierName = (id: string) => suppliers.find((supplier) => supplier.id === id)?.name ?? "Proveedor no aprobado o no disponible"
  const stats = {
    pending: items.filter((item) => item.status === "pending").length,
    ordered: items.filter((item) => item.status === "ordered").length,
    delivered: items.filter((item) => item.status === "delivered").length,
    amount: items.reduce((sum, item) => sum + Number(item.total_cost ?? 0), 0),
  }

  const exportToCSV = () => {
    const rows = items.map((item) => [item.item_name, item.category, supplierName(item.supplier_id), item.unit_price, item.quantity, item.total_cost, statusLabels[item.status] ?? item.status, item.expected_delivery || "Sin fecha", priorityLabels[item.priority] ?? item.priority])
    const headers = ["Artículo", "Categoría", "Proveedor", "Precio unitario", "Cantidad", "Costo total", "Estado", "Entrega esperada", "Prioridad"]
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `compras_${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AppLayout>
      <PageHeader
        title="Compras · Fundo Corcovado"
        description="Control interno de solicitudes, aprobación de proveedores y órdenes operativas para la gestión en Valdivia."
        actions={<div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link href="/procurement/requests"><ClipboardList className="mr-2 h-4 w-4" />Solicitudes</Link></Button>
          <Button variant="outline" asChild><Link href="/suppliers"><Users className="mr-2 h-4 w-4" />Proveedores</Link></Button>
          <Button variant="outline" asChild><Link href="/procurement/approvals"><ShieldCheck className="mr-2 h-4 w-4" />Aprobaciones</Link></Button>
          <Button variant="outline" onClick={exportToCSV} disabled={items.length === 0 || loading || !!loadError}><Download className="mr-2 h-4 w-4" />Exportar CSV</Button>
          <Button onClick={() => setShowAddDialog(true)} disabled={loading || !!loadError || suppliers.length === 0}><Plus className="mr-2 h-4 w-4" />Nueva orden</Button>
        </div>}
      />

      <div className="space-y-6 p-4 sm:p-8">
        {pendingSuppliers > 0 && suppliers.length === 0 && !loading && !loadError && <Card className="border-amber-300"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><p className="font-semibold">No hay proveedores habilitados para emitir órdenes</p><p className="mt-1 text-sm text-muted-foreground">Existen {pendingSuppliers} candidatos pendientes de revisión. Deben aprobarse antes de utilizarlos en compras.</p></div></div><Button asChild variant="outline"><Link href="/suppliers">Revisar proveedores</Link></Button></CardContent></Card>}

        {loadError && <Card className="border-destructive/60"><CardContent className="flex items-center justify-between gap-4 p-5"><p className="text-sm text-destructive">No fue posible cargar Compras: {loadError}</p><Button variant="outline" size="sm" onClick={() => void loadData()}><RefreshCw className="mr-2 h-4 w-4" />Reintentar</Button></CardContent></Card>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric title="Proveedores aprobados" value={suppliers.length} />
          <Metric title="Candidatos pendientes" value={pendingSuppliers} alert={pendingSuppliers > 0} />
          <Metric title="Órdenes pendientes" value={stats.pending} />
          <Metric title="Órdenes emitidas" value={stats.ordered} />
          <Metric title="Monto registrado" value={numberFormatter.format(stats.amount)} detail="Moneda no definida en el esquema actual" />
        </div>

        <Card>
          <CardHeader><CardTitle>Órdenes de compra</CardTitle><CardDescription>Registro operativo; no sustituye la aprobación presupuestaria ni la contabilidad.</CardDescription></CardHeader>
          <CardContent><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Artículo</TableHead><TableHead>Categoría</TableHead><TableHead>Proveedor</TableHead><TableHead>Precio unitario</TableHead><TableHead>Cantidad</TableHead><TableHead>Total</TableHead><TableHead>Estado</TableHead><TableHead>Entrega</TableHead><TableHead>Prioridad</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>
            {loading ? <TableRow><TableCell colSpan={10} className="py-10 text-center text-muted-foreground">Cargando compras…</TableCell></TableRow> : loadError ? <TableRow><TableCell colSpan={10} className="py-10 text-center text-muted-foreground">La información no está disponible.</TableCell></TableRow> : items.length === 0 ? <TableRow><TableCell colSpan={10} className="py-10 text-center"><p className="font-medium">No hay órdenes registradas.</p><p className="mt-1 text-sm text-muted-foreground">Primero revisa y aprueba proveedores; luego registra las compras operativas.</p></TableCell></TableRow> : items.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.item_name}</TableCell><TableCell>{item.category}</TableCell><TableCell>{supplierName(item.supplier_id)}</TableCell><TableCell>{numberFormatter.format(item.unit_price ?? 0)}</TableCell><TableCell>{item.quantity}</TableCell><TableCell>{numberFormatter.format(item.total_cost ?? 0)}</TableCell><TableCell><Badge variant="outline">{statusLabels[item.status] ?? item.status}</Badge></TableCell><TableCell>{item.expected_delivery || "Sin fecha"}</TableCell><TableCell>{priorityLabels[item.priority] ?? item.priority}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => setEditingItem(item)}><Pencil className="h-4 w-4" /></Button><DeleteProcurementButton itemId={item.id} itemName={item.item_name} onDeleted={loadData} /></TableCell></TableRow>)}
          </TableBody></Table></div></CardContent>
        </Card>
      </div>

      <AddProcurementDialog open={showAddDialog} onOpenChange={setShowAddDialog} suppliers={suppliers} onItemAdded={() => { void loadData(); setShowAddDialog(false) }} />
      {editingItem && <EditProcurementDialog item={editingItem} open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)} suppliers={suppliers} onItemUpdated={() => { void loadData(); setEditingItem(null) }} />}
    </AppLayout>
  )
}

function Metric({ title, value, alert = false, detail }: { title: string; value: number | string; alert?: boolean; detail?: string }) {
  return <Card className={alert ? "border-amber-300" : undefined}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{typeof value === "number" ? value.toLocaleString("es-CL") : value}</div>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</CardContent></Card>
}

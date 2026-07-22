"use client"

import Link from "next/link"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createBrowserClient } from "@/lib/supabase/client"
import { Plus, Pencil, Download, ClipboardList, ShieldCheck, AlertTriangle, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
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

interface Supplier {
  id: string
  name: string
}

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  ordered: "Ordenada",
  delivered: "Entregada",
  cancelled: "Cancelada",
}

const priorityLabels: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
}

const numberFormatter = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 2,
})

export default function ProcurementPage() {
  const [items, setItems] = useState<ProcurementItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<ProcurementItem | null>(null)

  const loadData = async () => {
    setLoading(true)
    setLoadError(null)

    try {
      const supabase = createBrowserClient()
      const [itemsRes, suppliersRes] = await Promise.all([
        supabase.from("procurement_items").select("*").order("expected_delivery", { ascending: false }),
        supabase.from("suppliers").select("id, name").eq("is_active", true),
      ])

      if (itemsRes.error || suppliersRes.error) {
        const messages = [itemsRes.error?.message, suppliersRes.error?.message].filter(Boolean)
        setLoadError(messages.join(" · ") || "No fue posible cargar la información de compras.")
        setItems([])
        setSuppliers([])
        return
      }

      setItems(itemsRes.data ?? [])
      setSuppliers(suppliersRes.data ?? [])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Ocurrió un error inesperado al cargar la información.")
      setItems([])
      setSuppliers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const getSupplierName = (supplierId: string) => {
    return suppliers.find((supplier) => supplier.id === supplierId)?.name || "Proveedor no disponible"
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      case "ordered":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30"
      case "delivered":
        return "bg-green-500/20 text-green-400 border-green-500/30"
      case "cancelled":
        return "bg-red-500/20 text-red-400 border-red-500/30"
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30"
    }
  }

  const exportToCSV = () => {
    const headers = [
      "Artículo",
      "Categoría",
      "Proveedor",
      "Precio unitario",
      "Cantidad",
      "Costo total",
      "Estado",
      "Entrega esperada",
      "Prioridad",
    ]
    const rows = items.map((item) => [
      item.item_name,
      item.category,
      getSupplierName(item.supplier_id),
      item.unit_price,
      item.quantity,
      item.total_cost,
      statusLabels[item.status] ?? `Estado no reconocido: ${item.status}`,
      item.expected_delivery || "Sin fecha",
      priorityLabels[item.priority] ?? item.priority,
    ])

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n")
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `compras_${new Date().toISOString().split("T")[0]}.csv`
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

  const stats = {
    pending: items.filter((item) => item.status === "pending").length,
    ordered: items.filter((item) => item.status === "ordered").length,
    delivered: items.filter((item) => item.status === "delivered").length,
    totalBudget: items.reduce((sum, item) => sum + (item.total_cost || 0), 0),
  }

  return (
    <AppLayout>
      <PageHeader
        title="Compras"
        description="Gestión de proveedores, órdenes de compra y adquisiciones"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/procurement/requests">
                <ClipboardList className="mr-2 h-4 w-4" />
                Solicitudes
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/procurement/approvals">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Aprobaciones
              </Link>
            </Button>
            <Button variant="outline" onClick={exportToCSV} disabled={items.length === 0 || loading || !!loadError}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            <Button onClick={() => setShowAddDialog(true)} disabled={loading || !!loadError}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva orden de compra
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-8 space-y-6">
        {loadError && (
          <Card className="border-destructive/60">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div>
                  <p className="font-semibold">No se pudo cargar Compras</p>
                  <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
                </div>
              </div>
              <Button variant="outline" onClick={loadData}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reintentar
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-secondary">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Órdenes pendientes</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-bold text-accent">{stats.pending}</div></CardContent>
          </Card>
          <Card className="border-secondary">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Órdenes emitidas</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-bold text-accent">{stats.ordered}</div></CardContent>
          </Card>
          <Card className="border-secondary">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Órdenes entregadas</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-bold text-accent">{stats.delivered}</div></CardContent>
          </Card>
          <Card className="border-secondary">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Monto total registrado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{numberFormatter.format(stats.totalBudget)}</div>
              <p className="mt-1 text-xs text-muted-foreground">Código de moneda no definido en el registro.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Órdenes de compra</CardTitle>
            <CardDescription>Registro operativo de artículos, proveedores, costos y estado de entrega.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-secondary overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artículo</TableHead><TableHead>Categoría</TableHead><TableHead>Proveedor</TableHead>
                    <TableHead>Precio unitario</TableHead><TableHead>Cantidad</TableHead><TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead><TableHead>Entrega esperada</TableHead><TableHead>Prioridad</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Cargando información de compras…</TableCell></TableRow>
                  ) : loadError ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">La tabla no está disponible porque la carga falló.</TableCell></TableRow>
                  ) : items.length > 0 ? (
                    items.map((item) => (
                      <TableRow key={item.id} className="hover:bg-secondary/30">
                        <TableCell className="font-medium">{item.item_name}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{getSupplierName(item.supplier_id)}</TableCell>
                        <TableCell>{numberFormatter.format(item.unit_price ?? 0)}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell className="font-semibold">{numberFormatter.format(item.total_cost ?? 0)}</TableCell>
                        <TableCell><Badge className={`${getStatusColor(item.status)} border`}>{statusLabels[item.status] ?? `No reconocido: ${item.status}`}</Badge></TableCell>
                        <TableCell className="text-sm">{item.expected_delivery || "Sin fecha"}</TableCell>
                        <TableCell><Badge variant="outline" className={item.priority === "high" || item.priority === "urgent" ? "border-red-500/50 text-red-400" : ""}>{priorityLabels[item.priority] ?? item.priority}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setEditingItem(item)} aria-label={`Editar ${item.item_name}`}><Pencil className="h-4 w-4" /></Button>
                            <DeleteProcurementButton itemId={item.id} itemName={item.item_name} onDeleted={loadData} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No hay órdenes de compra registradas.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <AddProcurementDialog open={showAddDialog} onOpenChange={setShowAddDialog} suppliers={suppliers} onItemAdded={() => { loadData(); setShowAddDialog(false) }} />
      {editingItem && <EditProcurementDialog item={editingItem} open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)} suppliers={suppliers} onItemUpdated={() => { loadData(); setEditingItem(null) }} />}
    </AppLayout>
  )
}

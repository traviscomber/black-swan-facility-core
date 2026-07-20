"use client"

import Link from "next/link"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createBrowserClient } from "@/lib/supabase/client"
import { Plus, Pencil, Download, ClipboardList, ShieldCheck } from "lucide-react"
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

export default function ProcurementPage() {
  const [items, setItems] = useState<ProcurementItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<ProcurementItem | null>(null)

  const loadData = async () => {
    const supabase = createBrowserClient()
    const [itemsRes, suppliersRes] = await Promise.all([
      supabase.from("procurement_items").select("*").order("expected_delivery", { ascending: false }),
      supabase.from("suppliers").select("id, name").eq("is_active", true),
    ])

    if (itemsRes.data) setItems(itemsRes.data)
    if (suppliersRes.data) setSuppliers(suppliersRes.data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const getSupplierName = (supplierId: string) => {
    return suppliers.find((s) => s.id === supplierId)?.name || "Unknown"
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
      "Item Name",
      "Category",
      "Supplier",
      "Unit Price",
      "Quantity",
      "Total Cost",
      "Status",
      "Expected Delivery",
      "Priority",
    ]
    const rows = items.map((item) => [
      item.item_name,
      item.category,
      getSupplierName(item.supplier_id),
      item.unit_price,
      item.quantity,
      item.total_cost,
      item.status,
      item.expected_delivery || "-",
      item.priority,
    ])

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `procurement_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const stats = {
    pending: items.filter((i) => i.status === "pending").length,
    ordered: items.filter((i) => i.status === "ordered").length,
    delivered: items.filter((i) => i.status === "delivered").length,
    totalBudget: items.reduce((sum, i) => sum + (i.total_cost || 0), 0),
  }

  return (
    <AppLayout>
      <PageHeader
        title="Procurement & Acquisitions"
        description="Manage supplier relationships, purchase orders, and acquisitions"
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
            <Button variant="outline" onClick={exportToCSV} disabled={items.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Purchase Order
            </Button>
          </div>
        }
      />

      <div className="p-8 space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-secondary hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">{stats.pending}</div>
            </CardContent>
          </Card>

          <Card className="border-secondary hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ordered</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">{stats.ordered}</div>
            </CardContent>
          </Card>

          <Card className="border-secondary hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Delivered</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">{stats.delivered}</div>
            </CardContent>
          </Card>

          <Card className="border-secondary hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Budget Used</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">${stats.totalBudget.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Purchase Orders</CardTitle>
            <CardDescription>All procurement and acquisition items</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-secondary overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expected Delivery</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        Loading procurement data...
                      </TableCell>
                    </TableRow>
                  ) : items.length > 0 ? (
                    items.map((item) => (
                      <TableRow key={item.id} className="hover:bg-secondary/30">
                        <TableCell className="font-medium">{item.item_name}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{getSupplierName(item.supplier_id)}</TableCell>
                        <TableCell>${item.unit_price?.toFixed(2)}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell className="font-semibold">${item.total_cost?.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={`${getStatusColor(item.status)} border`}>{item.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{item.expected_delivery || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={item.priority === "high" ? "border-red-500/50 text-red-400" : ""}
                          >
                            {item.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setEditingItem(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <DeleteProcurementButton itemId={item.id} itemName={item.item_name} onDeleted={loadData} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        No procurement items found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <AddProcurementDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        suppliers={suppliers}
        onItemAdded={() => {
          loadData()
          setShowAddDialog(false)
        }}
      />

      {editingItem && (
        <EditProcurementDialog
          item={editingItem}
          open={!!editingItem}
          onOpenChange={(open) => !open && setEditingItem(null)}
          suppliers={suppliers}
          onItemUpdated={() => {
            loadData()
            setEditingItem(null)
          }}
        />
      )}
    </AppLayout>
  )
}

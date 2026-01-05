"use client"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createBrowserClient } from "@/lib/supabase/client"
import { Plus, Pencil, Star } from "lucide-react"
import { useEffect, useState } from "react"
import { AddSupplierDialog } from "@/components/add-supplier-dialog"
import { EditSupplierDialog } from "@/components/edit-supplier-dialog"
import { DeleteSupplierButton } from "@/components/delete-supplier-button"

interface Supplier {
  id: string
  name: string
  contact_person: string
  email: string
  phone: string
  city: string
  country: string
  rating: number
  is_active: boolean
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  const loadSuppliers = async () => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase.from("suppliers").select("*").order("name")

    if (!error && data) {
      setSuppliers(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadSuppliers()
  }, [])

  const activeCount = suppliers.filter((s) => s.is_active).length
  const avgRating =
    suppliers.length > 0 ? (suppliers.reduce((sum, s) => sum + s.rating, 0) / suppliers.length).toFixed(1) : 0

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return "text-green-500"
    if (rating >= 3.5) return "text-yellow-500"
    return "text-red-500"
  }

  return (
    <AppLayout>
      <PageHeader
        title="Supplier Management"
        description="Manage supplier relationships and contact information"
        actions={
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Supplier
          </Button>
        }
      />

      <div className="p-8 space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Suppliers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">{suppliers.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Suppliers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">{activeCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-3xl font-bold text-accent">{avgRating}</div>
                <Star className={`h-5 w-5 ${getRatingColor(Number(avgRating))}`} fill="currentColor" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Suppliers Table */}
        <Card>
          <CardHeader>
            <CardTitle>Suppliers Directory</CardTitle>
            <CardDescription>All registered suppliers and contact information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-secondary overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Loading suppliers...
                      </TableCell>
                    </TableRow>
                  ) : suppliers.length > 0 ? (
                    suppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell>{supplier.contact_person || "-"}</TableCell>
                        <TableCell className="text-sm">{supplier.email || "-"}</TableCell>
                        <TableCell className="text-sm">{supplier.phone || "-"}</TableCell>
                        <TableCell className="text-sm">
                          {supplier.city || "-"}, {supplier.country || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className={getRatingColor(supplier.rating)}>{supplier.rating.toFixed(1)}</span>
                            <Star className={`h-4 w-4 ${getRatingColor(supplier.rating)}`} fill="currentColor" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={supplier.is_active ? "default" : "secondary"}>
                            {supplier.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditingSupplier(supplier)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <DeleteSupplierButton
                              supplierId={supplier.id}
                              supplierName={supplier.name}
                              onDeleted={loadSuppliers}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No suppliers found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <AddSupplierDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSupplierAdded={() => {
          loadSuppliers()
          setShowAddDialog(false)
        }}
      />

      {editingSupplier && (
        <EditSupplierDialog
          supplier={editingSupplier}
          open={!!editingSupplier}
          onOpenChange={(open) => !open && setEditingSupplier(null)}
          onSupplierUpdated={() => {
            loadSuppliers()
            setEditingSupplier(null)
          }}
        />
      )}
    </AppLayout>
  )
}

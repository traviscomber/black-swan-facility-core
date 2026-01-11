"use client"

import { useEffect, useState } from "react"
import { Plus, Search } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createBrowserClient } from "@/lib/supabase/client"
import { InventoryTable } from "@/components/inventory/inventory-table"
import { InventoryForm } from "@/components/inventory/inventory-form"
import { useToast } from "@/hooks/use-toast"

interface Asset {
  id: string
  asset_code: string
  name: string
  category: { name: string; color: string }
  cost_center: { name: string; code: string }
  status: string
  location: string
  assigned_to: string
  photo_url: string
  purchase_price: number
  created_at: string
}

export function InventoryContent() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [showForm, setShowForm] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [categories, setCategories] = useState([])
  const [costCenters, setCostCenters] = useState([])

  const supabase = createBrowserClient()
  const { toast } = useToast()

  useEffect(() => {
    loadAssets()
    loadMetadata()
  }, [])

  async function loadAssets() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("multimedia_assets")
        .select(
          `
          id,
          asset_code,
          name,
          status,
          location,
          assigned_to,
          photo_url,
          purchase_price,
          created_at,
          category_id,
          cost_center_id,
          asset_categories(name, color),
          cost_centers(name, code)
        `,
        )
        .order("created_at", { ascending: false })

      if (error) throw error
      const transformedData = (data || []).map((asset: any) => ({
        ...asset,
        category: asset.asset_categories,
        cost_center: asset.cost_centers,
      }))
      setAssets(transformedData)
    } catch (error) {
      console.error("Error loading assets:", error)
      toast({ title: "Error", description: "Failed to load assets", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function loadMetadata() {
    try {
      const [categoriesData, costCentersData] = await Promise.all([
        supabase.from("asset_categories").select("*").eq("is_active", true),
        supabase.from("cost_centers").select("*").eq("is_active", true),
      ])

      setCategories(categoriesData.data || [])
      setCostCenters(costCentersData.data || [])
    } catch (error) {
      console.error("Error loading metadata:", error)
    }
  }

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.asset_code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "all" || asset.category_id === selectedCategory
    const matchesStatus = selectedStatus === "all" || asset.status === selectedStatus
    return matchesSearch && matchesCategory && matchesStatus
  })

  const handleFormClose = () => {
    setShowForm(false)
    setEditingAsset(null)
  }

  const handleFormSuccess = () => {
    loadAssets()
    handleFormClose()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this asset?")) return

    try {
      const { error } = await supabase.from("multimedia_assets").delete().eq("id", id)
      if (error) throw error
      toast({ title: "Success", description: "Asset deleted successfully" })
      loadAssets()
    } catch (error) {
      console.error("Error deleting asset:", error)
      toast({ title: "Error", description: "Failed to delete asset", variant: "destructive" })
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-accent/10 to-primary/10 border border-primary/20 rounded-lg p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-accent">Blackswan Inventory System</h1>
              <p className="text-muted-foreground mt-1">Manage and track all assets across cost centers</p>
            </div>
            <Button onClick={() => setShowForm(true)} className="gap-2 w-full md:w-auto">
              <Plus className="h-4 w-4" />
              Add Asset
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or asset code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-input border border-border rounded-md text-sm"
          >
            <option value="all">All Categories</option>
            {categories.map((cat: any) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-input border border-border rounded-md text-sm"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="maintenance">Maintenance</option>
            <option value="deprecated">Deprecated</option>
          </select>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4 border-primary/20">
            <p className="text-sm text-muted-foreground">Total Assets</p>
            <p className="text-2xl font-bold text-accent mt-1">{filteredAssets.length}</p>
          </Card>
          <Card className="p-4 border-emerald-500/20">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {filteredAssets.filter((a) => a.status === "active").length}
            </p>
          </Card>
          <Card className="p-4 border-orange-500/20">
            <p className="text-sm text-muted-foreground">In Maintenance</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">
              {filteredAssets.filter((a) => a.status === "maintenance").length}
            </p>
          </Card>
          <Card className="p-4 border-red-500/20">
            <p className="text-sm text-muted-foreground">Deprecated</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {filteredAssets.filter((a) => a.status === "deprecated").length}
            </p>
          </Card>
        </div>

        {/* Assets Table */}
        <InventoryTable
          assets={filteredAssets}
          loading={loading}
          onEdit={setEditingAsset}
          onDelete={handleDelete}
          onEditClick={() => setShowForm(true)}
        />

        {/* Forms */}
        {showForm && (
          <InventoryForm
            asset={editingAsset}
            categories={categories}
            costCenters={costCenters}
            onClose={handleFormClose}
            onSuccess={handleFormSuccess}
          />
        )}
      </div>
    </AppLayout>
  )
}

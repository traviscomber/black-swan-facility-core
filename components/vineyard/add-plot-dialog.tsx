"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

interface AddPlotDialogProps {
  onPlotAdded?: () => void
}

export function AddPlotDialog({ onPlotAdded }: AddPlotDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    area_hectares: "",
    vine_variety: "",
    planted_year: new Date().getFullYear().toString(),
    rootstock: "",
    spacing_meters: "",
    vine_density_per_hectare: "",
    trellis_system: "",
    status: "active",
    ph_level: "",
    soil_type: "",
  })

  const supabase = createBrowserClient()
  const { t } = useLanguage()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setLoading(true)
      const { error } = await supabase
        .from("vineyard_plots")
        .insert([{
          name: formData.name,
          location: formData.location,
          area_hectares: parseFloat(formData.area_hectares) || 0,
          vine_variety: formData.vine_variety,
          planted_year: parseInt(formData.planted_year) || new Date().getFullYear(),
          rootstock: formData.rootstock,
          spacing_meters: parseFloat(formData.spacing_meters) || 0,
          vine_density_per_hectare: parseFloat(formData.vine_density_per_hectare) || 0,
          trellis_system: formData.trellis_system,
          status: formData.status,
          ph_level: parseFloat(formData.ph_level) || 0,
          soil_type: formData.soil_type,
        }])

      if (error) throw error

      setFormData({
        name: "",
        location: "",
        area_hectares: "",
        vine_variety: "",
        planted_year: new Date().getFullYear().toString(),
        rootstock: "",
        spacing_meters: "",
        vine_density_per_hectare: "",
        trellis_system: "",
        status: "active",
        ph_level: "",
        soil_type: "",
      })
      
      setOpen(false)
      onPlotAdded?.()
    } catch (error) {
      console.error("[v0] Error adding plot:", error)
      alert("Error adding plot. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t("vineyard.add_plot") || "Add Plot"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Vineyard Plot</DialogTitle>
          <DialogDescription>
            Create a new vineyard plot with all required details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Plot Name *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., North Section A"
                required
              />
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g., North vineyard"
              />
            </div>

            <div>
              <Label htmlFor="area_hectares">Area (hectares)</Label>
              <Input
                id="area_hectares"
                name="area_hectares"
                type="number"
                step="0.01"
                value={formData.area_hectares}
                onChange={handleChange}
                placeholder="0.0"
              />
            </div>

            <div>
              <Label htmlFor="vine_variety">Vine Variety</Label>
              <Input
                id="vine_variety"
                name="vine_variety"
                value={formData.vine_variety}
                onChange={handleChange}
                placeholder="e.g., Cabernet Sauvignon"
              />
            </div>

            <div>
              <Label htmlFor="planted_year">Planted Year</Label>
              <Input
                id="planted_year"
                name="planted_year"
                type="number"
                value={formData.planted_year}
                onChange={handleChange}
              />
            </div>

            <div>
              <Label htmlFor="rootstock">Rootstock</Label>
              <Input
                id="rootstock"
                name="rootstock"
                value={formData.rootstock}
                onChange={handleChange}
                placeholder="e.g., SO4"
              />
            </div>

            <div>
              <Label htmlFor="spacing_meters">Spacing (meters)</Label>
              <Input
                id="spacing_meters"
                name="spacing_meters"
                type="number"
                step="0.1"
                value={formData.spacing_meters}
                onChange={handleChange}
                placeholder="0.0"
              />
            </div>

            <div>
              <Label htmlFor="vine_density_per_hectare">Vine Density (/hectare)</Label>
              <Input
                id="vine_density_per_hectare"
                name="vine_density_per_hectare"
                type="number"
                value={formData.vine_density_per_hectare}
                onChange={handleChange}
                placeholder="0"
              />
            </div>

            <div>
              <Label htmlFor="trellis_system">Trellis System</Label>
              <Input
                id="trellis_system"
                name="trellis_system"
                value={formData.trellis_system}
                onChange={handleChange}
                placeholder="e.g., VSP"
              />
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => handleSelectChange("status", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="dormant">Dormant</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="ph_level">pH Level</Label>
              <Input
                id="ph_level"
                name="ph_level"
                type="number"
                step="0.1"
                value={formData.ph_level}
                onChange={handleChange}
                placeholder="0.0"
              />
            </div>

            <div>
              <Label htmlFor="soil_type">Soil Type</Label>
              <Input
                id="soil_type"
                name="soil_type"
                value={formData.soil_type}
                onChange={handleChange}
                placeholder="e.g., Loam"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Plot"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

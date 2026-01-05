"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createBrowserClient } from "@/lib/supabase/client"

interface EditPricingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPricingUpdated: () => void
  pricing: {
    id: string
    animal_type: string
    price_pesos: number
    unit: string
    category: string
    description: string
    quantity_standard: number
  }
}

export function EditPricingDialog({ open, onOpenChange, onPricingUpdated, pricing }: EditPricingDialogProps) {
  const [animalType, setAnimalType] = useState(pricing.animal_type)
  const [pricePesos, setPricePesos] = useState(pricing.price_pesos.toString())
  const [unit, setUnit] = useState(pricing.unit)
  const [description, setDescription] = useState(pricing.description || "")
  const [quantityStandard, setQuantityStandard] = useState(pricing.quantity_standard.toString())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createBrowserClient()

  useEffect(() => {
    if (open) {
      setAnimalType(pricing.animal_type)
      setPricePesos(pricing.price_pesos.toString())
      setUnit(pricing.unit)
      setDescription(pricing.description || "")
      setQuantityStandard(pricing.quantity_standard.toString())
    }
  }, [open, pricing])

  async function handleSubmit() {
    if (!animalType || !pricePesos) {
      alert("Please fill in all required fields")
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from("cattle_pricing")
        .update({
          animal_type: animalType,
          price_pesos: Number.parseFloat(pricePesos),
          unit,
          description,
          quantity_standard: Number.parseInt(quantityStandard),
          updated_at: new Date().toISOString(),
        })
        .eq("id", pricing.id)

      if (error) throw error

      onPricingUpdated()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Error updating pricing:", error)
      alert("Error updating pricing")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Animal Price</DialogTitle>
          <p className="text-sm text-muted-foreground">Update pricing information</p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="animal_type">Animal Type *</Label>
            <Input
              id="animal_type"
              placeholder="e.g.: Breeding Bull"
              value={animalType}
              onChange={(e) => setAnimalType(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="price_pesos">Price (Pesos) *</Label>
            <Input
              id="price_pesos"
              type="number"
              placeholder="0"
              value={pricePesos}
              onChange={(e) => setPricePesos(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="unit">Unit</Label>
            <Input id="unit" placeholder="e.g.: head, kg" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="quantity_standard">Standard Quantity</Label>
            <Input
              id="quantity_standard"
              type="number"
              placeholder="0"
              value={quantityStandard}
              onChange={(e) => setQuantityStandard(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Additional notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Update Price"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

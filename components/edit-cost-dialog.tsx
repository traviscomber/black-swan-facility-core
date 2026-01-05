"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"

interface EditCostDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCostUpdated: () => void
  cost: {
    id: string
    cost_type: string
    amount_pesos: number
    unit: string
    description: string
    business_unit: string
    is_fixed: boolean
  }
}

export function EditCostDialog({ open, onOpenChange, onCostUpdated, cost }: EditCostDialogProps) {
  const [costType, setCostType] = useState(cost.cost_type)
  const [amountPesos, setAmountPesos] = useState(cost.amount_pesos.toString())
  const [unit, setUnit] = useState(cost.unit)
  const [description, setDescription] = useState(cost.description || "")
  const [businessUnit, setBusinessUnit] = useState(cost.business_unit)
  const [isFixed, setIsFixed] = useState(cost.is_fixed.toString())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createBrowserClient()

  useEffect(() => {
    if (open) {
      setCostType(cost.cost_type)
      setAmountPesos(cost.amount_pesos.toString())
      setUnit(cost.unit)
      setDescription(cost.description || "")
      setBusinessUnit(cost.business_unit)
      setIsFixed(cost.is_fixed.toString())
    }
  }, [open, cost])

  async function handleSubmit() {
    if (!costType || !amountPesos) {
      alert("Please fill in all required fields")
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from("cattle_operational_costs")
        .update({
          cost_type: costType,
          amount_pesos: Number.parseFloat(amountPesos),
          unit,
          description,
          business_unit: businessUnit,
          is_fixed: isFixed === "true",
          updated_at: new Date().toISOString(),
        })
        .eq("id", cost.id)

      if (error) throw error

      onCostUpdated()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Error updating cost:", error)
      alert("Error updating cost")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Operational Cost</DialogTitle>
          <p className="text-sm text-muted-foreground">Update cost information</p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="cost_type">Cost Type *</Label>
            <Input
              id="cost_type"
              placeholder="e.g.: Feed, Labor"
              value={costType}
              onChange={(e) => setCostType(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="amount_pesos">Amount (Pesos) *</Label>
            <Input
              id="amount_pesos"
              type="number"
              placeholder="0"
              value={amountPesos}
              onChange={(e) => setAmountPesos(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="unit">Unit</Label>
            <Input
              id="unit"
              placeholder="e.g.: monthly, per head"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="business_unit">Business Unit</Label>
            <Select value={businessUnit} onValueChange={setBusinessUnit}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Crianza">Breeding (Crianza)</SelectItem>
                <SelectItem value="Engorda">Fattening (Engorda)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="is_fixed">Cost Type Classification</Label>
            <Select value={isFixed} onValueChange={setIsFixed}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Variable</SelectItem>
                <SelectItem value="true">Fixed</SelectItem>
              </SelectContent>
            </Select>
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
            {isSubmitting ? "Updating..." : "Update Cost"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

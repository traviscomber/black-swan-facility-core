"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { createBrowserClient } from "@/lib/supabase/client"
import type { Asset } from "@/lib/types"

interface EditAssetDialogProps {
  asset: Asset
  open: boolean
  onOpenChange: (open: boolean) => void
  onAssetUpdated: () => void
}

export function EditAssetDialog({ asset, open, onOpenChange, onAssetUpdated }: EditAssetDialogProps) {
  const [name, setName] = useState(asset.name)
  const [type, setType] = useState(asset.type || "")
  const [location, setLocation] = useState(asset.location || "")
  const [description, setDescription] = useState(asset.description || "")
  const [isCritical, setIsCritical] = useState(asset.is_critical || false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setName(asset.name)
    setType(asset.type || "")
    setLocation(asset.location || "")
    setDescription(asset.description || "")
    setIsCritical(asset.is_critical || false)
  }, [asset])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!name || !type) {
      setError("Name and type are required")
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createBrowserClient()
      const { error: updateError } = await supabase
        .from("assets")
        .update({
          name,
          type,
          location: location || null,
          description: description || null,
          is_critical: isCritical,
        })
        .eq("id", asset.id)

      if (updateError) throw updateError

      onAssetUpdated()
    } catch (err) {
      console.error("Error updating asset:", err)
      setError("Failed to update asset. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Asset</DialogTitle>
            <DialogDescription>Update the asset information</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>}

            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Asset name"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-type">Type *</Label>
              <Input
                id="edit-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="e.g., HVAC, Electrical, Plumbing"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Building or area location"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details about this asset"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-is_critical"
                checked={isCritical}
                onCheckedChange={(checked) => setIsCritical(checked as boolean)}
              />
              <Label htmlFor="edit-is_critical" className="text-sm font-normal cursor-pointer">
                Mark as critical asset
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import type React from "react"

import { useState } from "react"
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

interface AddAssetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAssetAdded: () => void
}

export function AddAssetDialog({ open, onOpenChange, onAssetAdded }: AddAssetDialogProps) {
  const [name, setName] = useState("")
  const [type, setType] = useState("")
  const [location, setLocation] = useState("")
  const [description, setDescription] = useState("")
  const [isCritical, setIsCritical] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

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
      const { error: insertError } = await supabase.from("assets").insert({
        name,
        type,
        location: location || null,
        description: description || null,
        is_critical: isCritical,
      })

      if (insertError) throw insertError

      // Reset form
      setName("")
      setType("")
      setLocation("")
      setDescription("")
      setIsCritical(false)

      onAssetAdded()
    } catch (err) {
      console.error("Error creating asset:", err)
      setError("Failed to create asset. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Asset</DialogTitle>
            <DialogDescription>Create a new asset to track in the facility management system</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>}

            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Asset name"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type">Type *</Label>
              <Input
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="e.g., HVAC, Electrical, Plumbing"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Building or area location"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details about this asset"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_critical"
                checked={isCritical}
                onCheckedChange={(checked) => setIsCritical(checked as boolean)}
              />
              <Label htmlFor="is_critical" className="text-sm font-normal cursor-pointer">
                Mark as critical asset
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Asset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Edit } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { VolunteerPhotoUpload } from "@/components/volunteer-photo-upload"
import type { Volunteer } from "@/lib/types"

interface EditVolunteerDialogProps {
  volunteer: Volunteer
}

export function EditVolunteerDialog({ volunteer }: EditVolunteerDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: volunteer.name || "",
    email: volunteer.email || "",
    phone: volunteer.phone || "",
    volunteer_role: volunteer.volunteer_role || "",
    start_date: volunteer.start_date || "",
    end_date: volunteer.end_date || "",
    availability: volunteer.availability || "",
    skills: volunteer.skills ? volunteer.skills.join(", ") : "",
    notes: volunteer.notes || "",
    hours_logged: volunteer.hours_logged || 0,
    is_active: volunteer.is_active ?? true,
    photo_url: volunteer.photo_url || "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const supabase = createBrowserClient()

      // Convert skills string to array
      const skillsArray = formData.skills
        ? formData.skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : []

      const { error } = await supabase
        .from("volunteers")
        .update({
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          volunteer_role: formData.volunteer_role || null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          availability: formData.availability || null,
          skills: skillsArray.length > 0 ? skillsArray : null,
          notes: formData.notes || null,
          hours_logged: formData.hours_logged,
          is_active: formData.is_active,
          status: formData.is_active ? "active" : "inactive",
          photo_url: formData.photo_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", volunteer.id)

      if (error) throw error

      setOpen(false)
      router.refresh()
    } catch (error) {
      console.error("Error updating volunteer:", error)
      alert("Failed to update volunteer")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex-1 bg-transparent">
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Volunteer</DialogTitle>
            <DialogDescription>Update volunteer information</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <VolunteerPhotoUpload
              volunteerId={volunteer.id}
              volunteerName={volunteer.name}
              currentPhotoUrl={formData.photo_url}
              onPhotoUploaded={(url) => setFormData({ ...formData, photo_url: url })}
            />
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-volunteer_role">Volunteer Role</Label>
              <Input
                id="edit-volunteer_role"
                placeholder="e.g., Maintenance Assistant"
                value={formData.volunteer_role}
                onChange={(e) => setFormData({ ...formData, volunteer_role: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="volunteer@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-start_date">Start Date</Label>
                <Input
                  id="edit-start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-end_date">End Date</Label>
                <Input
                  id="edit-end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-hours_logged">Hours Logged</Label>
              <Input
                id="edit-hours_logged"
                type="number"
                step="0.5"
                value={formData.hours_logged}
                onChange={(e) => setFormData({ ...formData, hours_logged: Number.parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-availability">Availability</Label>
              <Input
                id="edit-availability"
                placeholder="e.g., Weekends, Mon-Wed"
                value={formData.availability}
                onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-skills">Skills (comma separated)</Label>
              <Input
                id="edit-skills"
                placeholder="e.g., Carpentry, Gardening"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                placeholder="Additional information"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked as boolean })}
              />
              <Label htmlFor="edit-is_active" className="cursor-pointer">
                Active Volunteer
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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

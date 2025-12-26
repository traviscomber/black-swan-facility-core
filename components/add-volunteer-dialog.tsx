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
import { Plus } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { VolunteerPhotoUpload } from "@/components/volunteer-photo-upload"

export function AddVolunteerDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [volunteerId, setVolunteerId] = useState<string | null>(null)
  const [volunteerName, setVolunteerName] = useState("")
  const [photoUrl, setPhotoUrl] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    volunteer_role: "",
    start_date: "",
    availability: "",
    skills: "",
    notes: "",
    is_active: true,
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

      const { data, error } = await supabase
        .from("volunteers")
        .insert([
          {
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
            volunteer_role: formData.volunteer_role || null,
            start_date: formData.start_date || null,
            availability: formData.availability || null,
            skills: skillsArray.length > 0 ? skillsArray : null,
            notes: formData.notes || null,
            is_active: formData.is_active,
            status: formData.is_active ? "active" : "inactive",
          },
        ])
        .select()

      if (error) throw error

      if (data && data.length > 0) {
        setVolunteerId(data[0].id)
        setVolunteerName(data[0].name)
      }
    } catch (error) {
      console.error("Error adding volunteer:", error)
      alert("Failed to add volunteer")
      setIsSubmitting(false)
    }
  }

  const handlePhotoUploaded = (url: string) => {
    setPhotoUrl(url)
    // Close dialog automatically after photo upload
    setTimeout(() => {
      setOpen(false)
      setVolunteerId(null)
      setVolunteerName("")
      setPhotoUrl("")
      setFormData({
        name: "",
        email: "",
        phone: "",
        volunteer_role: "",
        start_date: "",
        availability: "",
        skills: "",
        notes: "",
        is_active: true,
      })
      router.refresh()
    }, 500)
  }

  if (volunteerId && volunteerName) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Volunteer
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Photo</DialogTitle>
            <DialogDescription>Add a photo for {volunteerName} (optional)</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <VolunteerPhotoUpload
              volunteerId={volunteerId}
              volunteerName={volunteerName}
              onPhotoUploaded={handlePhotoUploaded}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false)
                setVolunteerId(null)
                setVolunteerName("")
                setPhotoUrl("")
                setFormData({
                  name: "",
                  email: "",
                  phone: "",
                  volunteer_role: "",
                  start_date: "",
                  availability: "",
                  skills: "",
                  notes: "",
                  is_active: true,
                })
                router.refresh()
              }}
            >
              Skip & Done
            </Button>
            <Button type="button" onClick={() => handlePhotoUploaded(photoUrl)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Volunteer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Volunteer</DialogTitle>
            <DialogDescription>Add a new volunteer to the facility team</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="volunteer_role">Volunteer Role</Label>
              <Input
                id="volunteer_role"
                placeholder="e.g., Maintenance Assistant, Guest Services"
                value={formData.volunteer_role}
                onChange={(e) => setFormData({ ...formData, volunteer_role: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="volunteer@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="availability">Availability</Label>
              <Input
                id="availability"
                placeholder="e.g., Weekends, Mon-Wed, Flexible"
                value={formData.availability}
                onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="skills">Skills (comma separated)</Label>
              <Input
                id="skills"
                placeholder="e.g., Carpentry, Gardening, Cooking"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional information about the volunteer"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked as boolean })}
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Active Volunteer
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Next"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

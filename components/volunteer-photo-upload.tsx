"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Upload, X } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"

interface VolunteerPhotoUploadProps {
  volunteerId: string
  volunteerName: string
  currentPhotoUrl?: string
  onPhotoUploaded: (url: string) => void
}

export function VolunteerPhotoUpload({
  volunteerId,
  volunteerName,
  currentPhotoUrl,
  onPhotoUploaded,
}: VolunteerPhotoUploadProps) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(currentPhotoUrl || "")

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    const file = e.target.files[0]
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file")
      return
    }

    setUploading(true)

    try {
      const supabase = createBrowserClient()

      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop()
      const fileName = `${volunteerId}-${Date.now()}.${fileExt}`
      const filePath = `volunteers/${fileName}`

      const { error: uploadError } = await supabase.storage.from("facility-photos").upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("facility-photos").getPublicUrl(filePath)

      // Update volunteer record
      const { error: updateError } = await supabase
        .from("volunteers")
        .update({ photo_url: publicUrl })
        .eq("id", volunteerId)

      if (updateError) throw updateError

      setPhotoUrl(publicUrl)
      onPhotoUploaded(publicUrl)
      router.refresh()
    } catch (error) {
      console.error("Error uploading photo:", error)
      alert("Failed to upload photo")
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    try {
      const supabase = createBrowserClient()

      const { error } = await supabase.from("volunteers").update({ photo_url: null }).eq("id", volunteerId)

      if (error) throw error

      setPhotoUrl("")
      onPhotoUploaded("")
      router.refresh()
    } catch (error) {
      console.error("Error removing photo:", error)
      alert("Failed to remove photo")
    }
  }

  return (
    <div className="grid gap-2">
      <Label>Photo</Label>
      <div className="flex items-center gap-4">
        {photoUrl ? (
          <div className="relative">
            <img src={photoUrl || "/placeholder.svg"} alt={volunteerName} className="h-20 w-20 rounded object-cover" />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="h-20 w-20 rounded bg-slate-200 flex items-center justify-center">
            <Upload className="h-8 w-8 text-slate-400" />
          </div>
        )}
        <div>
          <input
            type="file"
            id="photo-upload"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
          <label htmlFor="photo-upload">
            <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
              <span>{uploading ? "Uploading..." : photoUrl ? "Change Photo" : "Upload Photo"}</span>
            </Button>
          </label>
        </div>
      </div>
    </div>
  )
}

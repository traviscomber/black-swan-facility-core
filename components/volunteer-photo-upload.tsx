"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Upload, X } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

interface VolunteerPhotoUploadProps {
  volunteerId: string
  volunteerName: string
  currentPhotoUrl?: string
  onPhotoUploaded: (url: string) => void
}

const COPY = {
  en: {
    label: "Photo",
    invalid: "Please select an image file",
    uploadFailure: "Failed to upload photo",
    removeFailure: "Failed to remove photo",
    uploading: "Uploading…",
    change: "Change photo",
    upload: "Upload photo",
    remove: "Remove photo",
  },
  es: {
    label: "Foto",
    invalid: "Selecciona un archivo de imagen",
    uploadFailure: "No se pudo subir la foto",
    removeFailure: "No se pudo eliminar la foto",
    uploading: "Subiendo…",
    change: "Cambiar foto",
    upload: "Subir foto",
    remove: "Eliminar foto",
  },
  de: {
    label: "Foto",
    invalid: "Bitte eine Bilddatei auswählen",
    uploadFailure: "Foto konnte nicht hochgeladen werden",
    removeFailure: "Foto konnte nicht entfernt werden",
    uploading: "Wird hochgeladen…",
    change: "Foto ändern",
    upload: "Foto hochladen",
    remove: "Foto entfernen",
  },
} as const

export function VolunteerPhotoUpload({
  volunteerId,
  volunteerName,
  currentPhotoUrl,
  onPhotoUploaded,
}: VolunteerPhotoUploadProps) {
  const router = useRouter()
  const { language } = useLanguage()
  const copy = COPY[language]
  const [uploading, setUploading] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(currentPhotoUrl || "")
  const inputId = `volunteer-photo-${volunteerId}`

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    const file = e.target.files[0]
    if (!file.type.startsWith("image/")) {
      alert(copy.invalid)
      return
    }

    setUploading(true)

    try {
      const supabase = createBrowserClient()
      const fileExt = file.name.split(".").pop()
      const fileName = `${volunteerId}-${Date.now()}.${fileExt}`
      const filePath = `volunteers/${fileName}`

      const { error: uploadError } = await supabase.storage.from("facility-photos").upload(filePath, file)
      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from("facility-photos").getPublicUrl(filePath)

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
      alert(copy.uploadFailure)
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
      alert(copy.removeFailure)
    }
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>{copy.label}</Label>
      <div className="flex items-center gap-4">
        {photoUrl ? (
          <div className="relative">
            <img src={photoUrl} alt={volunteerName} className="h-20 w-20 border border-border object-cover" />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              aria-label={copy.remove}
              title={copy.remove}
              className="absolute -right-2 -top-2 h-6 w-6"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex h-20 w-20 items-center justify-center border border-border bg-card/30">
            <Upload className="h-7 w-7 text-muted-foreground" />
          </div>
        )}
        <div>
          <input
            type="file"
            id={inputId}
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
          <label htmlFor={inputId}>
            <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
              <span>{uploading ? copy.uploading : photoUrl ? copy.change : copy.upload}</span>
            </Button>
          </label>
        </div>
      </div>
    </div>
  )
}

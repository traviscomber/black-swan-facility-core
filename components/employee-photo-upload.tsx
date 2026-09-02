"use client"

import type React from "react"
import { useState } from "react"
import { Upload, X } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

interface EmployeePhotoUploadProps {
  employeeId: string
  employeeName: string
  currentPhotoUrl?: string
  onPhotoUploaded?: (photoUrl: string) => void
}

const COPY = {
  en: { photo:"Employee photo", invalid:"Please select a valid image file.", uploadFailed:"Photo upload failed", unknown:"Unknown error", upload:"Click or drag to upload", uploading:"Uploading…", remove:"Remove photo" },
  es: { photo:"Foto de la persona", invalid:"Selecciona un archivo de imagen válido.", uploadFailed:"No fue posible subir la foto", unknown:"Error desconocido", upload:"Haz clic o arrastra una imagen", uploading:"Subiendo…", remove:"Eliminar foto" },
  de: { photo:"Foto der Person", invalid:"Bitte wähle eine gültige Bilddatei.", uploadFailed:"Foto konnte nicht hochgeladen werden", unknown:"Unbekannter Fehler", upload:"Klicken oder Bild hierher ziehen", uploading:"Wird hochgeladen…", remove:"Foto entfernen" },
} as const

export function EmployeePhotoUpload({
  employeeId,
  employeeName,
  currentPhotoUrl,
  onPhotoUploaded,
}: EmployeePhotoUploadProps) {
  const { language } = useLanguage()
  const copy = COPY[language as keyof typeof COPY] ?? COPY.en
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentPhotoUrl || null)
  const [dragActive, setDragActive] = useState(false)

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert(copy.invalid)
      return
    }

    setIsUploading(true)
    try {
      const fileName = `employee-${employeeId}-${Date.now()}`
      const filePath = `employees/${fileName}`
      const response = await fetch(`/api/upload?path=${encodeURIComponent(filePath)}`, {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "x-file-path": filePath,
        },
        body: file,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || copy.uploadFailed)
      }

      const { url } = await response.json()
      const supabase = createBrowserClient()
      const { error } = await supabase.from("employees").update({ photo_url: url }).eq("id", employeeId)
      if (error) throw error

      setPreview(url)
      onPhotoUploaded?.(url)
    } catch (error) {
      console.error("Error uploading employee photo:", error)
      alert(`${copy.uploadFailed}: ${error instanceof Error ? error.message : copy.unknown}`)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true)
    else if (e.type === "dragleave") setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) void handleUpload(e.dataTransfer.files[0])
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) void handleUpload(e.target.files[0])
  }

  const handleRemove = async () => {
    setPreview(null)
    const supabase = createBrowserClient()
    await supabase.from("employees").update({ photo_url: null }).eq("id", employeeId)
    onPhotoUploaded?.("")
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{copy.photo}</label>

      {preview ? (
        <div className="relative h-44 w-44 overflow-hidden rounded-lg border bg-muted">
          <img src={preview} alt={employeeName} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => void handleRemove()}
            className="absolute right-1 top-1 rounded bg-destructive p-1 text-destructive-foreground hover:opacity-90"
            aria-label={copy.remove}
            title={copy.remove}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <label
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`flex h-24 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/60"}`}
        >
          <div className="flex flex-col items-center justify-center py-5">
            <Upload className="mb-1 h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{copy.upload}</p>
          </div>
          <input type="file" accept="image/*" onChange={handleFileInput} className="hidden" disabled={isUploading} />
        </label>
      )}

      {isUploading && <p className="text-xs text-muted-foreground">{copy.uploading}</p>}
    </div>
  )
}

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileInput } from "./file-input"
import { Loader2, X } from "lucide-react"
import Image from "next/image"

interface VinePhotoUploadProps {
  vineId: string
  onPhotoUploaded: (photoUrl: string) => void
  currentPhotoUrl?: string
}

export function VinePhotoUpload({
  vineId,
  onPhotoUploaded,
  currentPhotoUrl,
}: VinePhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(currentPhotoUrl || "")
  const [error, setError] = useState("")

  const handleFileSelect = async (file: File) => {
    setUploading(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", `vines/${vineId}`)
      formData.append("fileType", "image")

      const response = await fetch("/api/vineyard/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Upload failed")
      }

      const { url } = await response.json()
      setPhotoUrl(url)
      onPhotoUploaded(url)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed"
      setError(message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {photoUrl && (
        <div className="relative w-full h-48 rounded-lg overflow-hidden border border-secondary">
          <Image
            src={photoUrl}
            alt="Vine photo"
            fill
            className="object-cover"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2"
            onClick={() => {
              setPhotoUrl("")
              onPhotoUploaded("")
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <FileInput
        onFileSelect={handleFileSelect}
        accept="image/*"
        fileType="image"
        label="Vine Photo"
        disabled={uploading}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

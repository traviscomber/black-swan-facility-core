"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Upload } from "lucide-react"
import { FileInput } from "./file-input"

interface PhotoPageUploadProps {
  onUploadComplete?: () => void
}

export function PhotoPageUpload({ onUploadComplete }: PhotoPageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleFileSelect = async (file: File) => {
    setUploading(true)
    setError("")
    setSuccess(false)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", "vines/photos")
      formData.append("fileType", "image")

      const response = await fetch("/api/vineyard/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Upload failed")
      }

      console.log("[v0] Upload successful")
      setSuccess(true)
      
      // Llamar inmediatamente al callback sin delay
      if (onUploadComplete) {
        onUploadComplete()
      }
      
      // Mostrar mensaje de éxito por 2 segundos
      setTimeout(() => {
        setSuccess(false)
      }, 2000)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed"
      console.error("[v0] Upload error:", message)
      setError(message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <FileInput
        onFileSelect={handleFileSelect}
        accept="image/*"
        fileType="image"
        label="Selecciona una foto de viña"
        disabled={uploading}
      />

      {uploading && (
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando foto...
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-sm text-green-600 p-2 bg-green-50 rounded">
          <span>✓</span>
          Foto cargada exitosamente
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 p-2 bg-red-50 rounded">
          Error: {error}
        </div>
      )}
    </div>
  )
}

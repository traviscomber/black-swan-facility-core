"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Upload } from "lucide-react"
import { FileInput } from "./file-input"
import { createBrowserClient } from "@/lib/supabase/client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PhotoPageUploadProps {
  onUploadComplete?: () => void
}

interface Vine {
  id: string
  vine_number: string
  plot_id: string
}

export function PhotoPageUpload({ onUploadComplete }: PhotoPageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [vines, setVines] = useState<Vine[]>([])
  const [selectedVineId, setSelectedVineId] = useState("")
  const [loadingVines, setLoadingVines] = useState(true)
  const supabase = createBrowserClient()

  useEffect(() => {
    fetchVines()
  }, [])

  const fetchVines = async () => {
    try {
      setLoadingVines(true)
      const { data, error } = await supabase
        .from("vineyard_vines")
        .select("id, vine_number, plot_id")
        .order("vine_number")

      if (error) throw error
      console.log("[v0] Loaded vines:", data?.length || 0)
      setVines(data || [])
    } catch (err) {
      console.error("[v0] Error fetching vines:", err)
    } finally {
      setLoadingVines(false)
    }
  }

  const handleFileSelect = async (file: File) => {
    if (!selectedVineId) {
      setError("Por favor selecciona una viña")
      return
    }

    setUploading(true)
    setError("")
    setSuccess(false)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", "vines/photos")
      formData.append("fileType", "image")
      formData.append("vineId", selectedVineId)

      const response = await fetch("/api/vineyard/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Upload failed")
      }

      console.log("[v0] Upload successful for vine:", selectedVineId)
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

  if (loadingVines) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando viñas...
      </div>
    )
  }

  if (vines.length === 0) {
    return (
      <div className="text-sm text-red-600 p-2 bg-red-50 rounded">
        No hay viñas registradas. Por favor, registra viñas primero.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">Selecciona una viña</label>
        <Select value={selectedVineId} onValueChange={setSelectedVineId}>
          <SelectTrigger>
            <SelectValue placeholder="Elige una viña para subir foto" />
          </SelectTrigger>
          <SelectContent>
            {vines.map((vine) => (
              <SelectItem key={vine.id} value={vine.id}>
                Viña {vine.vine_number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <FileInput
        onFileSelect={handleFileSelect}
        accept="image/*"
        fileType="image"
        label="Selecciona una foto de viña"
        disabled={uploading || !selectedVineId}
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

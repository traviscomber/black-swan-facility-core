"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Loader2, Trash2, Download, AlertCircle } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

interface PhotoFile {
  name: string
  path: string
  url: string
  created_at: string
  size: number
}

export function StoragePhotosGallery() {
  const [photos, setPhotos] = useState<PhotoFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const supabase = createBrowserClient()

  useEffect(() => {
    fetchPhotos()
  }, [])

  const fetchPhotos = async () => {
    try {
      setLoading(true)
      setError("")

      // List all files in the vineyard/vines/photos folder
      const { data, error: listError } = await supabase.storage
        .from("vineyard")
        .list("vines/photos", {
          limit: 100,
          offset: 0,
          sortBy: { column: "updated_at", order: "desc" },
        })

      if (listError) throw listError

      console.log("[v0] Found photos in storage:", data?.length || 0)

      // Get public URLs for each file
      const photosWithUrls: PhotoFile[] = (data || [])
        .filter((file) => !file.name.startsWith("."))
        .map((file) => {
          const { data: publicData } = supabase.storage
            .from("vineyard")
            .getPublicUrl(`vines/photos/${file.name}`)

          return {
            name: file.name,
            path: `vines/photos/${file.name}`,
            url: publicData.publicUrl,
            created_at: file.created_at || new Date().toISOString(),
            size: file.metadata?.size || 0,
          }
        })

      setPhotos(photosWithUrls)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error loading photos"
      console.error("[v0] Error fetching photos:", message)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const deletePhoto = async (filePath: string) => {
    try {
      const { error } = await supabase.storage
        .from("vineyard")
        .remove([filePath])

      if (error) throw error

      console.log("[v0] Deleted photo:", filePath)
      setPhotos(photos.filter((p) => p.path !== filePath))
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error deleting photo"
      console.error("[v0] Delete error:", message)
      setError(message)
    }
  }

  const downloadPhoto = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = fileName
      link.click()
    } catch (err) {
      console.error("[v0] Download error:", err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Cargando fotos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-900">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-4">
          <AlertCircle className="h-6 w-6 text-gray-400" />
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          No hay fotos subidas todavía
        </p>
        <p className="text-xs text-gray-400">
          Sube fotos usando la opción "Subir Fotos" arriba
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {photos.map((photo) => (
          <div
            key={photo.path}
            className="group relative overflow-hidden rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
          >
            {/* Image */}
            <div className="relative h-48 w-full overflow-hidden bg-gray-100">
              <Image
                src={photo.url}
                alt={photo.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-200"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                onError={() => console.error("[v0] Image load error:", photo.url)}
              />
            </div>

            {/* Info */}
            <div className="p-3 bg-white">
              <p className="text-xs text-gray-500 truncate mb-2">{photo.name}</p>
              <p className="text-xs text-gray-400">
                {new Date(photo.created_at).toLocaleDateString("es-ES", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            {/* Actions */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="secondary"
                className="h-8 w-8 p-0"
                onClick={() => downloadPhoto(photo.url, photo.name)}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-8 w-8 p-0"
                onClick={() => deletePhoto(photo.path)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-500 text-center">
        {photos.length} foto{photos.length !== 1 ? "s" : ""} subida
        {photos.length !== 1 ? "s" : ""}
      </div>
    </div>
  )
}

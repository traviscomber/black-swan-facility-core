"use client"

import type React from "react"
import { useState } from "react"
import { Upload, X } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"

interface PortBoatPhotoUploadProps {
  portBoatId: string
  portBoatName: string
  currentPhotoUrl?: string
  onPhotoUploaded?: (photoUrl: string) => void
}

export function PortBoatPhotoUpload({
  portBoatId,
  portBoatName,
  currentPhotoUrl,
  onPhotoUploaded,
}: PortBoatPhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentPhotoUrl || null)
  const [dragActive, setDragActive] = useState(false)

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file")
      return
    }

    setIsUploading(true)
    try {
      const supabase = createBrowserClient()
      const fileName = `port-boat-${portBoatId}-${Date.now()}`

      // Upload to Blob storage
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
        // @ts-ignore
        blobMetadata: { pathname: `ports-boats/${fileName}` },
      })

      if (!response.ok) throw new Error("Upload failed")

      const { url } = await response.json()

      // Update port/boat record with photo URL
      const { error } = await supabase.from("ports_boats").update({ photo_url: url }).eq("id", portBoatId)

      if (error) throw error

      setPreview(url)
      onPhotoUploaded?.(url)
    } catch (error) {
      console.error("Error uploading photo:", error)
      alert("Failed to upload photo")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0])
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Photo</label>

      {preview ? (
        <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-slate-200">
          <img src={preview || "/placeholder.svg"} alt={portBoatName} className="w-full h-full object-cover" />
          <button
            onClick={() => {
              setPreview(null)
              // Clear photo from database
              const supabase = createBrowserClient()
              supabase.from("ports_boats").update({ photo_url: null }).eq("id", portBoatId)
            }}
            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded hover:bg-red-600"
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
          className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition ${
            dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
          }`}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="h-5 w-5 text-gray-400 mb-1" />
            <p className="text-xs text-gray-500">Click or drag to upload</p>
          </div>
          <input type="file" accept="image/*" onChange={handleFileInput} className="hidden" disabled={isUploading} />
        </label>
      )}

      {isUploading && <p className="text-xs text-gray-500">Uploading...</p>}
    </div>
  )
}

export default PortBoatPhotoUpload

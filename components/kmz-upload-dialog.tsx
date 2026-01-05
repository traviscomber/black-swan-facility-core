"use client"

import type React from "react"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Upload, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface KmzUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadSuccess: () => void
}

export function KmzUploadDialog({ open, onOpenChange, onUploadSuccess }: KmzUploadDialogProps) {
  const [loading, setLoading] = useState(false)
  const [kmzName, setKmzName] = useState("")
  const [kmzFile, setKmzFile] = useState<File | null>(null)
  const [description, setDescription] = useState("")
  const { toast } = useToast()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith(".kmz")) {
        toast({
          title: "Invalid file type",
          description: "Please select a .kmz file",
          variant: "destructive",
        })
        return
      }
      setKmzFile(file)
      setKmzName(file.name.replace(".kmz", ""))
    }
  }

  const handleUpload = async () => {
    if (!kmzFile) {
      toast({
        title: "No file selected",
        description: "Please select a KMZ file to upload",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()

      // Generate unique filename
      const fileName = `${Date.now()}_${kmzFile.name}`
      const filePath = `kmz/${fileName}`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("gis-overlays")
        .upload(filePath, kmzFile, {
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from("gis-overlays").getPublicUrl(uploadData.path)

      // Insert into database
      const { data: newKmz, error: dbError } = await supabase
        .from("kmz_files")
        .insert({
          name: kmzName || kmzFile.name,
          file_url: urlData.publicUrl,
          file_path: uploadData.path,
          file_size: kmzFile.size,
          description: description || null,
          is_active: true,
          current_version: 1,
        })
        .select()
        .single()

      if (dbError) {
        throw dbError
      }

      // Insert into versions table
      await supabase.from("kmz_file_versions").insert({
        kmz_id: newKmz.id,
        version_number: 1,
        file_url: urlData.publicUrl,
        file_path: uploadData.path,
        file_size: kmzFile.size,
        notes: `Initial upload - ${kmzName}`,
      })

      toast({
        title: "KMZ file uploaded successfully",
        description: `${kmzName} has been added to the map`,
      })

      onUploadSuccess()
      handleClose()
    } catch (error) {
      console.error("[v0] KMZ upload error:", error)
      toast({
        title: "Upload failed",
        description: "Failed to upload KMZ file. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setKmzFile(null)
    setKmzName("")
    setDescription("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload KMZ Overlay</DialogTitle>
          <DialogDescription>Upload a KMZ file to add it as a layer to the GIS map</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="kmz-name">Overlay Name</Label>
            <Input
              id="kmz-name"
              placeholder="e.g., Facility Boundary"
              value={kmzName}
              onChange={(e) => setKmzName(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="kmz-file">KMZ File</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition">
              <input id="kmz-file" type="file" accept=".kmz" onChange={handleFileSelect} className="hidden" />
              <label htmlFor="kmz-file" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="h-6 w-6 text-gray-400" />
                <div>
                  <p className="font-medium text-sm">Click to upload or drag KMZ file</p>
                  <p className="text-xs text-gray-500">{kmzFile?.name || "No file selected"}</p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <Label htmlFor="kmz-description">Description (Optional)</Label>
            <Textarea
              id="kmz-description"
              placeholder="Describe this KMZ overlay..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={loading || !kmzFile}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload KMZ
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

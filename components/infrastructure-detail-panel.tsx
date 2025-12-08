"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { X, Camera, FileText, MapPin, Calendar, AlertCircle, Pencil, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"

type InfrastructurePlan = {
  id: string
  name: string
  category: string
  description: string | null
  latitude: number
  longitude: number
  status: string
  priority: string
  installation_date: string | null
  last_inspection: string | null
  next_inspection: string | null
  specifications: any
  notes: string | null
  created_at: string
}

type InfrastructurePhoto = {
  id: string
  photo_url: string
  caption: string | null
  photo_type: string | null
  taken_at: string
}

type InfrastructureDocument = {
  id: string
  document_url: string
  document_name: string
  document_type: string | null
  uploaded_at: string
}

export function InfrastructureDetailPanel({
  infrastructure,
  open,
  onClose,
  onUpdate,
  onEdit,
  onDelete,
}: {
  infrastructure: InfrastructurePlan
  open: boolean
  onClose: () => void
  onUpdate: () => void
  onEdit?: (infrastructure: InfrastructurePlan) => void
  onDelete?: () => void
}) {
  const [photos, setPhotos] = useState<InfrastructurePhoto[]>([])
  const [documents, setDocuments] = useState<InfrastructureDocument[]>([])
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showPhotoDialog, setShowPhotoDialog] = useState(false)
  const [photoCaption, setPhotoCaption] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && infrastructure) {
      fetchPhotos()
      fetchDocuments()
    }
  }, [open, infrastructure])

  const fetchPhotos = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from("infrastructure_photos")
      .select("*")
      .eq("infrastructure_id", infrastructure.id)
      .order("taken_at", { ascending: false })

    if (data) setPhotos(data)
  }

  const fetchDocuments = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from("infrastructure_documents")
      .select("*")
      .eq("infrastructure_id", infrastructure.id)
      .order("uploaded_at", { ascending: false })

    if (data) setDocuments(data)
  }

  const handleDelete = async () => {
    setDeleting(true)

    console.log("[v0] Deleting infrastructure from Supabase:", {
      id: infrastructure.id,
      name: infrastructure.name,
    })

    const supabase = createClient()
    const { error } = await supabase.from("infrastructure_plans").delete().eq("id", infrastructure.id)

    console.log("[v0] Delete result:", { error })

    setDeleting(false)

    if (!error) {
      console.log("[v0] Infrastructure successfully deleted from Supabase")
      setShowDeleteDialog(false)
      onDelete?.()
      onClose()
    } else {
      console.error("[v0] Error deleting infrastructure:", error)
    }
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handlePhotoUpload = async () => {
    if (!photoFile) return

    setUploading(true)
    console.log("[v0] Uploading photo to Supabase")

    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64String = reader.result as string

        const supabase = createClient()
        const { error } = await supabase.from("infrastructure_photos").insert({
          infrastructure_id: infrastructure.id,
          photo_url: base64String,
          caption: photoCaption || null,
          photo_type: "installation",
          taken_at: new Date().toISOString(),
        })

        console.log("[v0] Photo upload result:", { error })

        if (!error) {
          console.log("[v0] Photo successfully uploaded")
          await fetchPhotos()
          setShowPhotoDialog(false)
          setPhotoFile(null)
          setPhotoPreview(null)
          setPhotoCaption("")
        } else {
          console.error("[v0] Error uploading photo:", error)
        }
        setUploading(false)
      }
      reader.readAsDataURL(photoFile)
    } catch (error) {
      console.error("[v0] Error uploading photo:", error)
      setUploading(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-y-0 left-0 w-full sm:w-[90vw] md:w-[32rem] bg-white shadow-2xl z-[1002] overflow-y-auto border-r border-gray-200">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-4 flex items-center justify-between z-10">
          <h2 className="text-base sm:text-lg font-semibold truncate pr-2 sm:pr-4">{infrastructure.name}</h2>
          <div className="flex items-center gap-1 sm:gap-2">
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit(infrastructure)} className="hidden sm:flex">
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit(infrastructure)} className="sm:hidden">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)} className="hidden sm:flex">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)} className="sm:hidden">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge className="capitalize">{infrastructure.category}</Badge>
              <Badge variant={infrastructure.status === "active" ? "default" : "secondary"}>
                {infrastructure.status}
              </Badge>
              {infrastructure.priority === "critical" && <Badge variant="destructive">Critical</Badge>}
            </div>
            <p className="text-sm text-gray-600">{infrastructure.description}</p>
          </div>

          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
            <div>
              <p className="font-medium">Location</p>
              <p className="text-gray-600">
                {infrastructure.latitude.toFixed(6)}, {infrastructure.longitude.toFixed(6)}
              </p>
            </div>
          </div>

          {(infrastructure.installation_date || infrastructure.last_inspection || infrastructure.next_inspection) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <p className="font-medium text-sm">Timeline</p>
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm ml-6">
                {infrastructure.installation_date && (
                  <div>
                    <span className="text-gray-600">Installed:</span>{" "}
                    <span className="font-medium">
                      {new Date(infrastructure.installation_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {infrastructure.last_inspection && (
                  <div>
                    <span className="text-gray-600">Last Inspection:</span>{" "}
                    <span className="font-medium">{new Date(infrastructure.last_inspection).toLocaleDateString()}</span>
                  </div>
                )}
                {infrastructure.next_inspection && (
                  <div>
                    <span className="text-gray-600">Next Inspection:</span>{" "}
                    <span className="font-medium">{new Date(infrastructure.next_inspection).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {infrastructure.specifications && Object.keys(infrastructure.specifications).length > 0 && (
            <div>
              <p className="font-medium text-sm mb-3">Specifications</p>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                {Object.entries(infrastructure.specifications).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-gray-600 capitalize">{key.replace(/_/g, " ")}:</span>
                    <span className="font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {infrastructure.notes && (
            <div className="flex items-start gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-gray-500 mt-0.5" />
              <div>
                <p className="font-medium">Notes</p>
                <p className="text-gray-600 mt-1">{infrastructure.notes}</p>
              </div>
            </div>
          )}

          <Tabs defaultValue="photos" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="photos" className="flex-1 text-xs sm:text-sm">
                <Camera className="h-4 w-4 mr-1 sm:mr-2" />
                Photos ({photos.length})
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex-1 text-xs sm:text-sm">
                <FileText className="h-4 w-4 mr-1 sm:mr-2" />
                Documents ({documents.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="photos" className="space-y-4 mt-4">
              {photos.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Camera className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No photos yet</p>
                  <Button size="sm" className="mt-3" onClick={() => setShowPhotoDialog(true)}>
                    <Camera className="h-4 w-4 mr-2" />
                    Add Photo
                  </Button>
                </div>
              ) : (
                <>
                  <Button size="sm" className="w-full" onClick={() => setShowPhotoDialog(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Photo
                  </Button>
                  <div className="grid grid-cols-2 gap-3">
                    {photos.map((photo) => (
                      <div key={photo.id} className="rounded-lg overflow-hidden border border-gray-200">
                        <img
                          src={photo.photo_url || "/placeholder.svg"}
                          alt={photo.caption || "Infrastructure photo"}
                          className="w-full h-32 object-cover"
                        />
                        {photo.caption && (
                          <div className="p-2 bg-gray-50">
                            <p className="text-xs text-gray-600 line-clamp-2">{photo.caption}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="documents" className="space-y-3 mt-4">
              {documents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No documents yet</p>
                  <Button size="sm" className="mt-3">
                    <FileText className="h-4 w-4 mr-2" />
                    Add Document
                  </Button>
                </div>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.document_name}</p>
                      <p className="text-xs text-gray-500">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                    </div>
                    {doc.document_type && (
                      <Badge variant="outline" className="text-xs">
                        {doc.document_type}
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Upload Photo</DialogTitle>
            <DialogDescription>Add a photo for {infrastructure.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="photo">Photo</Label>
              <input
                ref={fileInputRef}
                id="photo"
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full bg-transparent"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <Upload className="h-4 w-4 mr-2" />
                {photoFile ? "Change Photo" : "Select Photo"}
              </Button>
              {photoPreview && (
                <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
                  <img src={photoPreview || "/placeholder.svg"} alt="Preview" className="w-full h-48 object-cover" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="caption">Caption (optional)</Label>
              <Textarea
                id="caption"
                placeholder="Add a description..."
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPhotoDialog(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handlePhotoUpload} disabled={!photoFile || uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Infrastructure</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{infrastructure.name}"? This action cannot be undone. All associated
              photos and documents will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

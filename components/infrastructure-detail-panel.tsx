"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { X, Camera, FileText, MapPin, Calendar, AlertCircle, Pencil, Trash2, Upload, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Input } from "@/components/ui/input"
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

type InfrastructureDocumentVersion = {
  id: string
  document_url: string
  document_name: string
  document_type: string | null
  version_number: number
  uploaded_at: string
  notes: string | null
}

type InfrastructureDocument = {
  id: string
  document_url: string
  document_name: string
  document_type: string | null
  uploaded_at: string
  current_version: number
  version_notes: string | null
}

type InfrastructureDetailPanelProps = {
  infrastructure: InfrastructurePlan
  onClose: () => void
  onUpdate: () => void
  onEdit: () => void // Added onEdit prop for handling edit button click
  onDelete?: () => void
}

export function InfrastructureDetailPanel({
  infrastructure,
  onClose,
  onUpdate,
  onEdit, // Added onEdit prop type
  onDelete,
}: InfrastructureDetailPanelProps) {
  const [photos, setPhotos] = useState<InfrastructurePhoto[]>([])
  const [documents, setDocuments] = useState<InfrastructureDocument[]>([])
  const [documentVersions, setDocumentVersions] = useState<Record<string, InfrastructureDocumentVersion[]>>({})
  const [showVersionHistory, setShowVersionHistory] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showPhotoDialog, setShowPhotoDialog] = useState(false)
  const [showDocumentDialog, setShowDocumentDialog] = useState(false)
  const [photoCaption, setPhotoCaption] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [documentName, setDocumentName] = useState("")
  const [uploading, setUploading] = useState(false)
  const [viewingPhoto, setViewingPhoto] = useState<InfrastructurePhoto | null>(null)
  const [editingPhoto, setEditingPhoto] = useState<InfrastructurePhoto | null>(null)
  const [editCaption, setEditCaption] = useState("")
  const [activeTab, setActiveTab] = useState<"photos" | "documents">("photos")
  const photoInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchPhotos()
    fetchDocuments()
  }, [infrastructure.id])

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

  const fetchDocumentVersions = async (docId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from("infrastructure_document_versions")
      .select("*")
      .eq("document_id", docId)
      .order("version_number", { ascending: false })

    if (data) {
      setDocumentVersions((prev) => ({
        ...prev,
        [docId]: data,
      }))
    }
  }

  const handleDelete = async () => {
    setDeleting(true)

    console.log("[v0] Deleting infrastructure from Supabase:", {
      id: infrastructure.id,
      name: infrastructure.name,
    })

    try {
      const supabase = createClient()
      const { error } = await supabase.from("infrastructure_plans").delete().eq("id", infrastructure.id)

      console.log("[v0] Delete result:", { error })

      if (!error) {
        console.log("[v0] Infrastructure successfully deleted from Supabase")
        setShowDeleteDialog(false)
        onDelete?.()
        onClose()
      } else {
        console.error("[v0] Error deleting infrastructure:", error)
        alert(`Error deleting infrastructure: ${error.message}`)
      }
    } catch (err) {
      console.error("[v0] Exception during delete:", err)
      alert("An unexpected error occurred while deleting. Please try again.")
    } finally {
      setDeleting(false)
    }
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("[v0] Photo file selected from input")
    const file = e.target.files?.[0]
    if (file) {
      console.log("[v0] File details:", {
        name: file.name,
        type: file.type,
        size: file.size,
      })
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
        console.log("[v0] Photo preview generated")
      }
      reader.readAsDataURL(file)
    } else {
      console.log("[v0] No file selected")
    }
  }

  const compressImage = async (file: File): Promise<File> => {
    console.log("[v0] Compressing image...", { originalSize: file.size })

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement("canvas")
          const ctx = canvas.getContext("2d")

          // Calculate new dimensions (max 1920px width/height, maintain aspect ratio)
          const maxSize = 1920
          let width = img.width
          let height = img.height

          if (width > height && width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          } else if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }

          canvas.width = width
          canvas.height = height

          // Draw image with compression
          ctx?.drawImage(img, 0, 0, width, height)

          // Convert to blob with quality 0.8 (80% quality, good balance)
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                })
                console.log("[v0] Image compressed:", {
                  originalSize: file.size,
                  compressedSize: compressedFile.size,
                  reduction: `${Math.round((1 - compressedFile.size / file.size) * 100)}%`,
                })
                resolve(compressedFile)
              } else {
                reject(new Error("Compression failed"))
              }
            },
            "image/jpeg",
            0.8, // 80% quality
          )
        }
        img.onerror = reject
      }
      reader.onerror = reject
    })
  }

  const handlePhotoUpload = async () => {
    if (!photoFile) {
      console.log("[v0] No photo file to upload")
      return
    }

    setUploading(true)
    console.log("[v0] Starting photo upload process", {
      fileName: photoFile.name,
      fileSize: photoFile.size,
      fileType: photoFile.type,
    })

    try {
      const supabase = createClient()

      // Compress image first
      let fileToUpload = photoFile
      if (photoFile.type.startsWith("image/")) {
        fileToUpload = await compressImage(photoFile)
      }

      // Convert compressed image to base64
      const reader = new FileReader()
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(fileToUpload)
      })

      console.log("[v0] Image converted to base64, size:", base64Data.length)

      // Store base64 data directly in database
      const { error: dbError } = await supabase.from("infrastructure_photos").insert({
        infrastructure_id: infrastructure.id,
        photo_url: base64Data, // Store compressed base64 data
        caption: photoCaption || null,
        photo_type: "installation",
        taken_at: new Date().toISOString(),
      })

      if (dbError) {
        console.error("[v0] Database insert error:", dbError)
        throw dbError
      }

      console.log("[v0] Photo successfully uploaded and saved to database")
      await fetchPhotos()
      setShowPhotoDialog(false)
      setPhotoFile(null)
      setPhotoPreview(null)
      setPhotoCaption("")
    } catch (error) {
      console.error("[v0] Error uploading photo:", error)
      alert("Failed to upload photo. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("[v0] Document file selected")
    const file = e.target.files?.[0]
    if (file) {
      console.log("[v0] Document details:", {
        name: file.name,
        type: file.type,
        size: file.size,
      })
      setDocumentFile(file)
      setDocumentName(file.name)
    }
  }

  const handleDocumentUpload = async () => {
    if (!documentFile) {
      console.log("[v0] No document file to upload")
      return
    }

    setUploading(true)
    console.log("[v0] Uploading document to Supabase Storage")

    try {
      const supabase = createClient()

      // Generate unique filename
      const fileExt = documentFile.name.split(".").pop()
      const fileName = `${infrastructure.id}/${Date.now()}.${fileExt}`

      // Upload to Supabase Storage bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("infrastructure-files")
        .upload(`documents/${fileName}`, documentFile, {
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadError) {
        console.error("[v0] Storage upload error:", uploadError)
        throw uploadError
      }

      console.log("[v0] Document uploaded to storage:", uploadData.path)

      // Get public URL for the uploaded file
      const { data: urlData } = supabase.storage.from("infrastructure-files").getPublicUrl(uploadData.path)

      // First, get next version number
      const { data: existingDocs } = await supabase
        .from("infrastructure_documents")
        .select("current_version")
        .eq("infrastructure_id", infrastructure.id)
        .eq("document_name", documentName || documentFile.name)
        .single()

      const nextVersion = existingDocs ? existingDocs.current_version + 1 : 1

      // Insert into main documents table
      const { data: newDoc, error: dbError } = await supabase
        .from("infrastructure_documents")
        .insert({
          infrastructure_id: infrastructure.id,
          document_url: urlData.publicUrl,
          document_name: documentName || documentFile.name,
          document_type: fileExt || null,
          uploaded_at: new Date().toISOString(),
          current_version: nextVersion,
          version_notes: documentName ? `Version ${nextVersion}` : null,
        })
        .select()
        .single()

      if (dbError) {
        console.error("[v0] Database insert error:", dbError)
        throw dbError
      }

      // Insert into versions table for history tracking
      await supabase.from("infrastructure_document_versions").insert({
        document_id: newDoc.id,
        infrastructure_id: infrastructure.id,
        document_url: urlData.publicUrl,
        document_name: documentName || documentFile.name,
        document_type: fileExt || null,
        version_number: nextVersion,
        notes: `Version ${nextVersion} uploaded`,
      })

      console.log("[v0] Document successfully uploaded with version tracking")
      await fetchDocuments()
      setShowDocumentDialog(false)
      setDocumentFile(null)
      setDocumentName("")
    } catch (error) {
      console.error("[v0] Error uploading document:", error)
      alert("Failed to upload document. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  const handleDeletePhoto = async (photo: InfrastructurePhoto) => {
    if (!confirm("Delete this photo?")) return

    console.log("[v0] Deleting photo:", photo.id)

    try {
      const supabase = createClient()

      // Delete from database
      const { error } = await supabase.from("infrastructure_photos").delete().eq("id", photo.id)

      if (error) throw error

      console.log("[v0] Photo deleted successfully")
      await fetchPhotos()
    } catch (error) {
      console.error("[v0] Error deleting photo:", error)
      alert("Failed to delete photo")
    }
  }

  const handleDeleteDocument = async (doc: InfrastructureDocument) => {
    if (!confirm("Delete this document?")) return

    console.log("[v0] Deleting document:", doc.id)

    try {
      const supabase = createClient()

      // Extract file path from URL
      if (doc.document_url.includes("infrastructure-files")) {
        const urlParts = doc.document_url.split("/infrastructure-files/")
        if (urlParts[1]) {
          const filePath = urlParts[1]
          console.log("[v0] Deleting file from storage:", filePath)

          await supabase.storage.from("infrastructure-files").remove([filePath])
        }
      }

      // Delete from database
      const { error } = await supabase.from("infrastructure_documents").delete().eq("id", doc.id)

      if (error) throw error

      console.log("[v0] Document deleted successfully")
      await fetchDocuments()
    } catch (error) {
      console.error("[v0] Error deleting document:", error)
      alert("Failed to delete document")
    }
  }

  const handleEditPhoto = async () => {
    if (!editingPhoto) return

    console.log("[v0] Updating photo caption:", editingPhoto.id)

    try {
      const supabase = createClient()

      const { error } = await supabase
        .from("infrastructure_photos")
        .update({ caption: editCaption })
        .eq("id", editingPhoto.id)

      if (error) throw error

      console.log("[v0] Photo caption updated successfully")
      await fetchPhotos()
      setEditingPhoto(null)
      setEditCaption("")
    } catch (error) {
      console.error("[v0] Error updating photo:", error)
      alert("Failed to update photo caption")
    }
  }

  return (
    <>
      <div className="fixed inset-y-0 left-0 w-full sm:w-[90vw] md:w-[32rem] bg-white shadow-2xl z-[1002] overflow-y-auto border-r border-gray-200">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-4 flex items-center justify-between z-10">
          <h2 className="text-base sm:text-lg font-semibold truncate pr-2 sm:pr-4">{infrastructure.name}</h2>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="outline" size="sm" onClick={onEdit} className="hidden sm:flex bg-transparent">
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={onEdit} className="sm:hidden bg-transparent">
              <Pencil className="h-4 w-4" />
            </Button>
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{infrastructure.name}</h1>
            <p className="text-sm text-gray-500">Infrastructure Asset</p>
          </div>

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

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            <div className="flex items-center justify-between">
              <Button
                variant={activeTab === "photos" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("photos")}
                className="flex-1"
              >
                <Camera className="h-4 w-4 mr-2" />
                Photos ({photos.length})
              </Button>
              <Button
                variant={activeTab === "documents" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("documents")}
                className="flex-1 ml-2"
              >
                <FileText className="h-4 w-4 mr-2" />
                Documents ({documents.length})
              </Button>
            </div>

            {activeTab === "photos" && (
              <>
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
                  <div className="grid grid-cols-2 gap-3">
                    {photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="rounded-lg overflow-hidden border border-gray-200 relative group cursor-pointer"
                        onClick={() => setViewingPhoto(photo)}
                      >
                        <img
                          src={photo.photo_url || "/placeholder.svg"}
                          alt={photo.caption || "Infrastructure photo"}
                          className="w-full h-32 object-cover hover:scale-105 transition-transform"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeletePhoto(photo)
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        {photo.caption && (
                          <div className="p-2 bg-gray-50">
                            <p className="text-xs text-gray-600 line-clamp-2">{photo.caption}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <Button onClick={() => setShowPhotoDialog(true)} className="w-full" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photo
                </Button>
              </>
            )}

            {activeTab === "documents" && (
              <>
                {documents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No documents yet</p>
                    <Button size="sm" className="mt-3" onClick={() => setShowDocumentDialog(true)}>
                      <FileText className="h-4 w-4 mr-2" />
                      Add Document
                    </Button>
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div key={doc.id}>
                      <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 group">
                        <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.document_name}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(doc.uploaded_at).toLocaleDateString()} • v{doc.current_version}
                          </p>
                        </div>
                        {doc.document_type && (
                          <Badge variant="outline" className="text-xs uppercase">
                            {doc.document_type}
                          </Badge>
                        )}
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              if (showVersionHistory === doc.id) {
                                setShowVersionHistory(null)
                              } else {
                                setShowVersionHistory(doc.id)
                                fetchDocumentVersions(doc.id)
                              }
                            }}
                            title="View version history"
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => window.open(doc.document_url, "_blank")}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteDocument(doc)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {showVersionHistory === doc.id && documentVersions[doc.id] && (
                        <div className="ml-8 mt-2 mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-xs font-semibold text-blue-900 mb-2">
                            Version History ({documentVersions[doc.id].length})
                          </p>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {documentVersions[doc.id].map((version) => (
                              <div key={version.id} className="text-xs p-2 bg-white rounded border border-blue-100">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-blue-900">v{version.version_number}</p>
                                    <p className="text-gray-600 text-xs">
                                      {new Date(version.uploaded_at).toLocaleString()}
                                    </p>
                                    {version.notes && <p className="text-gray-700 mt-1">{version.notes}</p>}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-xs px-2 bg-transparent"
                                    onClick={() => window.open(version.document_url, "_blank")}
                                  >
                                    View
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}

                <Button onClick={() => setShowDocumentDialog(true)} className="w-full" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
        <DialogContent className="sm:max-w-[425px] max-w-full h-full sm:h-auto">
          <DialogHeader>
            <DialogTitle>Upload Photo</DialogTitle>
            <DialogDescription>
              Add a photo for {infrastructure.name}. Supports JPG, PNG, HEIC and other image formats.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="photo">Photo</Label>
              <input
                ref={photoInputRef}
                id="photo"
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full h-14 text-base bg-transparent"
                onClick={() => {
                  console.log("[v0] Select Photo button clicked")
                  photoInputRef.current?.click()
                }}
                type="button"
              >
                <Camera className="h-5 w-5 mr-2" />
                {photoFile ? photoFile.name : "Take Photo or Choose from Gallery"}
              </Button>
              <p className="text-xs text-gray-500 text-center">Tap to take a photo or select from your gallery</p>
              {photoPreview && (
                <div className="mt-4 rounded-lg overflow-hidden border border-gray-200">
                  <img src={photoPreview || "/placeholder.svg"} alt="Preview" className="w-full h-64 object-cover" />
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
                className="text-base"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPhotoDialog(false)}
              disabled={uploading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button onClick={handlePhotoUpload} disabled={!photoFile || uploading} className="w-full sm:w-auto">
              {uploading ? "Uploading..." : "Upload Photo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Add a document for {infrastructure.name}. Supports PDF, Word, Excel, text files, and images (especially
              useful for electrical diagrams).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="document">Document File</Label>
              <input
                ref={documentInputRef}
                id="document"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,image/*"
                onChange={handleDocumentSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full bg-transparent"
                onClick={() => documentInputRef.current?.click()}
                type="button"
              >
                <Upload className="h-4 w-4 mr-2" />
                {documentFile ? documentFile.name : "Select Document"}
              </Button>
              <p className="text-xs text-gray-500">PDF, Word, Excel, text files, and images supported</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="docName">Document Name</Label>
              <Input
                id="docName"
                placeholder="Enter document name..."
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDocumentDialog(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleDocumentUpload} disabled={!documentFile || uploading}>
              {uploading ? "Uploading..." : "Upload Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingPhoto} onOpenChange={(open) => !open && setViewingPhoto(null)}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] p-0 z-[9999]">
          <DialogHeader className="sr-only">
            <DialogTitle>View Infrastructure Photo</DialogTitle>
            <DialogDescription>Photo viewer for {viewingPhoto?.caption || "infrastructure"}</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setViewingPhoto(null)}
            >
              <X className="h-5 w-5" />
            </Button>
            <img
              src={viewingPhoto?.photo_url || "/placeholder.svg"}
              alt={viewingPhoto?.caption || "Infrastructure photo"}
              className="w-full h-auto max-h-[80vh] object-contain bg-gray-100"
              onError={(e) => {
                console.error("[v0] Image failed to load:", viewingPhoto?.photo_url?.substring(0, 50))
                e.currentTarget.src = "/placeholder.svg"
              }}
            />
            {viewingPhoto?.caption && (
              <div className="p-4 bg-gray-50 border-t">
                <p className="text-sm text-gray-700">{viewingPhoto.caption}</p>
              </div>
            )}
            <div className="p-4 bg-white border-t flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditCaption(viewingPhoto?.caption || "")
                  setEditingPhoto(viewingPhoto)
                  setViewingPhoto(null)
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit Caption
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (viewingPhoto) {
                    handleDeletePhoto(viewingPhoto)
                    setViewingPhoto(null)
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPhoto} onOpenChange={(open) => !open && setEditingPhoto(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Photo Caption</DialogTitle>
            <DialogDescription>Update the caption for this photo</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-caption">Caption</Label>
              <Textarea
                id="edit-caption"
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                placeholder="Add a description..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPhoto(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditPhoto}>Save Changes</Button>
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

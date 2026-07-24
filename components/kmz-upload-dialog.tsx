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
import { Upload, Loader2, AlertTriangle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/lib/hooks/use-language"

interface KmzUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadSuccess: () => void
}

const MAX_FILE_SIZE = 20 * 1024 * 1024

const copy = {
  es: {
    title: "Agregar capa GIS",
    description: "Suba un archivo KMZ o KML validado para incorporarlo al mapa operativo. La capa quedará visible después de registrarse correctamente.",
    name: "Nombre de la capa",
    namePlaceholder: "Ej.: Límite predial 2026",
    file: "Archivo KMZ o KML",
    choose: "Seleccionar archivo",
    noFile: "Ningún archivo seleccionado",
    help: "Formatos permitidos: .kmz y .kml. Tamaño máximo: 20 MB.",
    descriptionLabel: "Descripción opcional",
    descriptionPlaceholder: "Indique origen, fecha, responsable o alcance de la capa.",
    cancel: "Cancelar",
    upload: "Guardar capa",
    uploading: "Guardando…",
    invalidType: "Formato no permitido",
    invalidTypeBody: "Seleccione un archivo .kmz o .kml.",
    tooLarge: "Archivo demasiado grande",
    tooLargeBody: "El archivo supera el límite de 20 MB.",
    noSelection: "Archivo requerido",
    noSelectionBody: "Seleccione un archivo antes de guardar.",
    success: "Capa GIS registrada",
    successBody: (name: string) => `${name} fue agregada al mapa.`,
    failure: "No fue posible guardar la capa",
    failureBody: "Revise el archivo y vuelva a intentarlo.",
    safety: "Si el registro en base de datos falla, el archivo cargado se elimina automáticamente para evitar residuos sin referencia.",
  },
  en: {
    title: "Add GIS layer",
    description: "Upload a validated KMZ or KML file to add it to the operational map. The layer becomes visible only after it is registered successfully.",
    name: "Layer name",
    namePlaceholder: "Example: Property boundary 2026",
    file: "KMZ or KML file",
    choose: "Select file",
    noFile: "No file selected",
    help: "Allowed formats: .kmz and .kml. Maximum size: 20 MB.",
    descriptionLabel: "Optional description",
    descriptionPlaceholder: "State the source, date, owner or scope of this layer.",
    cancel: "Cancel",
    upload: "Save layer",
    uploading: "Saving…",
    invalidType: "Unsupported format",
    invalidTypeBody: "Select a .kmz or .kml file.",
    tooLarge: "File is too large",
    tooLargeBody: "The file exceeds the 20 MB limit.",
    noSelection: "File required",
    noSelectionBody: "Select a file before saving.",
    success: "GIS layer registered",
    successBody: (name: string) => `${name} was added to the map.`,
    failure: "Unable to save layer",
    failureBody: "Review the file and try again.",
    safety: "If the database record fails, the uploaded file is removed automatically to avoid unreferenced storage objects.",
  },
} as const

export function KmzUploadDialog({ open, onOpenChange, onUploadSuccess }: KmzUploadDialogProps) {
  const { language } = useLanguage()
  const text = copy[language === "es" ? "es" : "en"]
  const [loading, setLoading] = useState(false)
  const [kmzName, setKmzName] = useState("")
  const [kmzFile, setKmzFile] = useState<File | null>(null)
  const [description, setDescription] = useState("")
  const { toast } = useToast()

  const reset = () => {
    setKmzFile(null)
    setKmzName("")
    setDescription("")
  }

  const handleClose = () => {
    if (loading) return
    reset()
    onOpenChange(false)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const lowerName = file.name.toLowerCase()
    if (!lowerName.endsWith(".kmz") && !lowerName.endsWith(".kml")) {
      toast({ title: text.invalidType, description: text.invalidTypeBody, variant: "destructive" })
      event.target.value = ""
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({ title: text.tooLarge, description: text.tooLargeBody, variant: "destructive" })
      event.target.value = ""
      return
    }

    setKmzFile(file)
    setKmzName((current) => current || file.name.replace(/\.(kmz|kml)$/i, ""))
  }

  const handleUpload = async () => {
    if (!kmzFile) {
      toast({ title: text.noSelection, description: text.noSelectionBody, variant: "destructive" })
      return
    }

    setLoading(true)
    const supabase = createClient()
    const extension = kmzFile.name.toLowerCase().endsWith(".kml") ? "kml" : "kmz"
    const safeBase = kmzFile.name
      .replace(/\.(kmz|kml)$/i, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "gis-layer"
    const filePath = `gis-overlays/${Date.now()}-${safeBase}.${extension}`

    try {
      const { error: uploadError } = await supabase.storage.from("gis-overlays").upload(filePath, kmzFile, {
        contentType: extension === "kml" ? "application/vnd.google-earth.kml+xml" : "application/vnd.google-earth.kmz",
        cacheControl: "3600",
        upsert: false,
      })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from("gis-overlays").getPublicUrl(filePath)
      const layerName = kmzName.trim() || kmzFile.name.replace(/\.(kmz|kml)$/i, "")
      const { error: dbError } = await supabase.from("gis_overlays").insert({
        name: layerName,
        description: description.trim() || null,
        file_url: urlData.publicUrl,
        file_path: filePath,
        file_size: kmzFile.size,
        file_type: extension,
        is_visible: true,
        layer_order: 0,
        opacity: 1,
        metadata: { original_filename: kmzFile.name },
      })

      if (dbError) {
        await supabase.storage.from("gis-overlays").remove([filePath])
        throw dbError
      }

      toast({ title: text.success, description: text.successBody(layerName) })
      onUploadSuccess()
      reset()
      onOpenChange(false)
    } catch (error) {
      console.error("GIS layer upload failed:", error)
      toast({
        title: text.failure,
        description: error instanceof Error && error.message ? error.message : text.failureBody,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : handleClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
          <DialogDescription>{text.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kmz-name">{text.name}</Label>
            <Input id="kmz-name" placeholder={text.namePlaceholder} value={kmzName} onChange={(event) => setKmzName(event.target.value)} maxLength={120} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kmz-file">{text.file}</Label>
            <label htmlFor="kmz-file" className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center hover:bg-muted/40">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">{text.choose}</span>
              <span className="max-w-full truncate text-xs text-muted-foreground">{kmzFile?.name || text.noFile}</span>
            </label>
            <input id="kmz-file" type="file" accept=".kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml" onChange={handleFileSelect} className="hidden" disabled={loading} />
            <p className="text-xs text-muted-foreground">{text.help}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="kmz-description">{text.descriptionLabel}</Label>
            <Textarea id="kmz-description" placeholder={text.descriptionPlaceholder} value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={500} />
          </div>

          <div className="flex gap-2 rounded-md border p-3 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{text.safety}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>{text.cancel}</Button>
          <Button onClick={() => void handleUpload()} disabled={loading || !kmzFile}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{text.uploading}</> : <><Upload className="mr-2 h-4 w-4" />{text.upload}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

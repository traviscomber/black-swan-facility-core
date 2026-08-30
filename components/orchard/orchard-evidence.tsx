"use client"

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react"
import { Camera, ExternalLink, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Evidence = {
  id: string
  crop_id: string
  care_log_id: string | null
  pest_log_id: string | null
  storage_path: string
  file_name: string
  mime_type: string
  file_size: number | null
  caption: string | null
  taken_at: string | null
  created_at: string
}

type Props = {
  cropId: string
  careLogId?: string
  pestLogId?: string
}

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"])
const maxBytes = 6 * 1024 * 1024
const copy = {
  en: {
    title: "Field evidence", add: "Add photo", caption: "Caption (optional)", empty: "No photos attached.", tooLarge: "Photo must be 6 MB or smaller.", invalidType: "Use JPEG, PNG, WebP, HEIC or HEIF.", uploadError: "Could not upload photo", removeError: "Could not remove photo", deleteConfirm: "Delete this photo evidence?", open: "Open photo", unauthorized: "You must be signed in to upload evidence.", remove: "Remove photo",
  },
  es: {
    title: "Evidencia de terreno", add: "Agregar foto", caption: "Descripción (opcional)", empty: "No hay fotos adjuntas.", tooLarge: "La foto debe pesar 6 MB o menos.", invalidType: "Usa JPEG, PNG, WebP, HEIC o HEIF.", uploadError: "No fue posible subir la foto", removeError: "No fue posible eliminar la foto", deleteConfirm: "¿Eliminar esta evidencia fotográfica?", open: "Abrir foto", unauthorized: "Debes iniciar sesión para subir evidencia.", remove: "Eliminar foto",
  },
  de: {
    title: "Feldnachweise", add: "Foto hinzufügen", caption: "Beschreibung (optional)", empty: "Keine Fotos angehängt.", tooLarge: "Das Foto darf höchstens 6 MB groß sein.", invalidType: "Verwende JPEG, PNG, WebP, HEIC oder HEIF.", uploadError: "Foto konnte nicht hochgeladen werden", removeError: "Foto konnte nicht entfernt werden", deleteConfirm: "Diesen Fotobeleg löschen?", open: "Foto öffnen", unauthorized: "Du musst angemeldet sein, um Nachweise hochzuladen.", remove: "Foto entfernen",
  },
} as const

function safeName(name: string) {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-")
  return cleaned || "photo.jpg"
}

export function OrchardEvidence({ cropId, careLogId, pestLogId }: Props) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const text = copy[language]
  const [items, setItems] = useState<Array<Evidence & { signed_url?: string }>>([])
  const [caption, setCaption] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    let query = supabase.from("orchard_field_evidence").select("*").eq("crop_id", cropId)
    if (careLogId) query = query.eq("care_log_id", careLogId)
    if (pestLogId) query = query.eq("pest_log_id", pestLogId)
    const result = await query.order("created_at", { ascending: false })
    if (result.error) {
      setError(result.error.message)
      return
    }
    const rows = (result.data ?? []) as Evidence[]
    const signed = await Promise.all(rows.map(async (row) => {
      const url = await supabase.storage.from("orchard-evidence").createSignedUrl(row.storage_path, 600)
      return { ...row, signed_url: url.data?.signedUrl }
    }))
    setItems(signed)
  }, [careLogId, cropId, pestLogId, supabase])

  useEffect(() => { void load() }, [load])

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || busy) return
    if (!allowedTypes.has(file.type)) { setError(text.invalidType); return }
    if (file.size > maxBytes) { setError(text.tooLarge); return }

    setBusy(true)
    setError(null)
    const auth = await supabase.auth.getUser()
    const userId = auth.data.user?.id
    if (!userId) { setBusy(false); setError(text.unauthorized); return }

    const evidenceId = crypto.randomUUID()
    const path = `${userId}/${evidenceId}/${safeName(file.name)}`
    const inserted = await supabase.from("orchard_field_evidence").insert({
      id: evidenceId,
      crop_id: cropId,
      care_log_id: careLogId ?? null,
      pest_log_id: pestLogId ?? null,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      caption: caption.trim() || null,
      taken_at: new Date(file.lastModified || Date.now()).toISOString(),
    })
    if (inserted.error) {
      setBusy(false)
      setError(`${text.uploadError}: ${inserted.error.message}`)
      return
    }

    const stored = await supabase.storage.from("orchard-evidence").upload(path, file, { contentType: file.type, upsert: false })
    if (stored.error) {
      await supabase.from("orchard_field_evidence").delete().eq("id", evidenceId)
      setBusy(false)
      setError(`${text.uploadError}: ${stored.error.message}`)
      return
    }

    setCaption("")
    await load()
    setBusy(false)
  }

  async function remove(item: Evidence) {
    if (!window.confirm(text.deleteConfirm) || busy) return
    setBusy(true)
    setError(null)
    const storageResult = await supabase.storage.from("orchard-evidence").remove([item.storage_path])
    if (storageResult.error) {
      setBusy(false)
      setError(`${text.removeError}: ${storageResult.error.message}`)
      return
    }
    const dbResult = await supabase.from("orchard_field_evidence").delete().eq("id", item.id)
    if (dbResult.error) setError(`${text.removeError}: ${dbResult.error.message}`)
    else await load()
    setBusy(false)
  }

  return (
    <div className="mt-4 rounded-lg border bg-muted/10 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1 space-y-1.5">
          <Label>{text.title}</Label>
          <Input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder={text.caption} />
        </div>
        <label className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-muted">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
          {text.add}
          <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" disabled={busy} onChange={upload} />
        </label>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {items.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">{text.empty}</p> : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => <div key={item.id} className="overflow-hidden rounded-lg border bg-background">
            {item.signed_url ? <img src={item.signed_url} alt={item.caption || item.file_name} className="h-36 w-full object-cover" /> : <div className="flex h-36 items-center justify-center bg-muted text-xs text-muted-foreground">{item.file_name}</div>}
            <div className="space-y-2 p-3">
              <p className="line-clamp-2 text-sm">{item.caption || item.file_name}</p>
              <div className="flex gap-2">
                {item.signed_url && <Button asChild variant="outline" size="sm"><a href={item.signed_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />{text.open}</a></Button>}
                <Button variant="ghost" size="sm" aria-label={text.remove} title={text.remove} onClick={() => void remove(item)} disabled={busy}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </div>)}
        </div>
      )}
    </div>
  )
}

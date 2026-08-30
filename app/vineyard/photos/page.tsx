"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Camera, Upload } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { PhotoPageUpload } from "@/components/vineyard/photo-page-upload"
import { StoragePhotosGallery } from "@/components/vineyard/storage-photos-gallery"

type Locale = "en" | "es" | "de"
interface Vine { id:string; plot_id:string; vine_number:string; photo_url?:string; health_status:string; estimated_production:number; notes?:string; created_at:string }

const localeMap: Record<Locale, string> = { en:"en-US", es:"es-CL", de:"de-DE" }
const copy = {
  en:{ loading:"Loading vines…", title:"Vine photos", description:"Manage and review photos for individual vines.", back:"Back", uploadPhotos:"Upload photos", uploadTitle:"Upload vine photo", uploadDescription:"Upload a photo for a specific vine.", total:"Total vines", withPhotos:"With photos", completed:"complete", withoutPhotos:"Without photos", pending:"awaiting a photo", gallery:"Photo gallery", galleryDescription:"All uploaded photos." },
  es:{ loading:"Cargando viñas…", title:"Fotos de viñas", description:"Gestiona y revisa fotos de viñas individuales.", back:"Volver", uploadPhotos:"Subir fotos", uploadTitle:"Subir foto de viña", uploadDescription:"Sube una foto para una viña específica.", total:"Total de viñas", withPhotos:"Con fotos", completed:"completadas", withoutPhotos:"Sin fotos", pending:"pendientes de foto", gallery:"Galería de fotos", galleryDescription:"Todas las fotos subidas." },
  de:{ loading:"Rebstöcke werden geladen…", title:"Rebfotos", description:"Fotos einzelner Rebstöcke verwalten und prüfen.", back:"Zurück", uploadPhotos:"Fotos hochladen", uploadTitle:"Rebfoto hochladen", uploadDescription:"Ein Foto für einen bestimmten Rebstock hochladen.", total:"Rebstöcke insgesamt", withPhotos:"Mit Fotos", completed:"vollständig", withoutPhotos:"Ohne Fotos", pending:"Foto ausstehend", gallery:"Fotogalerie", galleryDescription:"Alle hochgeladenen Fotos." },
} as const

export default function VinePhotosPage() {
  const [vines, setVines] = useState<Vine[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language as Locale
  const text = copy[lang]
  const locale = localeMap[lang]

  const fetchVines = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from("vineyard_vines").select("*").order("created_at", { ascending:false })
      if (error) throw error
      setVines(data || [])
    } catch (error) {
      console.error("[v0] Error fetching vines:", error)
    } finally { setLoading(false) }
  }

  useEffect(() => { void fetchVines() }, [])

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">{text.loading}</p></div>

  const vinesWithPhoto = vines.filter(vine => vine.photo_url).length
  const completedPct = vines.length ? Math.round((vinesWithPhoto / vines.length) * 100) : 0

  return <div className="space-y-6">
    <PageHeader title={text.title} description={text.description} actions={<div className="flex gap-2"><Button asChild variant="outline"><Link href={`/${lang}/vineyard`}>{text.back}</Link></Button>{!showUpload ? <Button onClick={() => setShowUpload(true)}><Camera className="mr-2 h-4 w-4" />{text.uploadPhotos}</Button> : null}</div>} />

    {showUpload ? <Card className="border-blue-200 bg-blue-50"><CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-4 w-4" />{text.uploadTitle}</CardTitle><CardDescription>{text.uploadDescription}</CardDescription></CardHeader><CardContent><PhotoPageUpload onUploadComplete={() => { setShowUpload(false); void fetchVines() }} /></CardContent></Card> : null}

    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Stat title={text.total} value={vines.length.toLocaleString(locale)} />
      <Stat title={text.withPhotos} value={vinesWithPhoto.toLocaleString(locale)} detail={`${completedPct.toLocaleString(locale)}% ${text.completed}`} />
      <Stat title={text.withoutPhotos} value={(vines.length - vinesWithPhoto).toLocaleString(locale)} detail={text.pending} />
    </div>

    <Card><CardHeader><CardTitle>{text.gallery}</CardTitle><CardDescription>{text.galleryDescription}</CardDescription></CardHeader><CardContent><StoragePhotosGallery /></CardContent></Card>
  </div>
}

function Stat({ title, value, detail }: { title:string; value:string; detail?:string }) { return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{value}</div>{detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}</CardContent></Card> }

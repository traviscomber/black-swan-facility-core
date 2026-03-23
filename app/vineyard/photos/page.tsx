"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Upload, Trash2, Download, Camera } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { VinePhotoUpload } from "@/components/vineyard/vine-photo-upload"
import { VinesGallery } from "@/components/vineyard/vines-gallery"
import Link from "next/link"

interface Vine {
  id: string
  plot_id: string
  vine_number: string
  photo_url?: string
  health_status: string
  estimated_production: number
  notes?: string
  created_at: string
}

export default function VinePhotosPage() {
  const [vines, setVines] = useState<Vine[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const supabase = createBrowserClient()
  const { t } = useLanguage()

  useEffect(() => {
    fetchVines()
  }, [])

  const fetchVines = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("vineyard_vines")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      setVines(data || [])
    } catch (error) {
      console.error("[v0] Error fetching vines:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Cargando viñas...</p>
      </div>
    )
  }

  const vinasConFoto = vines.filter(v => v.photo_url).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fotos de Viñas"
        description="Gestiona y visualiza fotos de tus viñas individuales"
        actions={
          <div className="flex gap-2">
            <Link href="/vineyard">
              <Button variant="outline">
                Volver
              </Button>
            </Link>
            {!showUpload && (
              <Button onClick={() => setShowUpload(true)}>
                <Camera className="mr-2 h-4 w-4" />
                Subir Fotos
              </Button>
            )}
          </div>
        }
      />

      {/* Upload Section */}
      {showUpload && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Subir Foto de Viña
            </CardTitle>
            <CardDescription>
              Sube una foto para una viña específica
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VinePhotoUpload 
              onUploadComplete={() => {
                setShowUpload(false)
                fetchVines()
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Viñas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{vines.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Con Fotos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{vinasConFoto}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {vines.length > 0 ? Math.round((vinasConFoto / vines.length) * 100) : 0}% completadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sin Fotos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{vines.length - vinasConFoto}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Pendientes de foto
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Photo Gallery */}
      <Card>
        <CardHeader>
          <CardTitle>Galería de Fotos</CardTitle>
          <CardDescription>
            Visualiza todas las fotos de las viñas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {vines.length === 0 ? (
            <div className="text-center py-12">
              <Camera className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No hay viñas registradas</p>
              <Link href="/vineyard/crops">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Registrar Viñas
                </Button>
              </Link>
            </div>
          ) : (
            <VinesGallery vines={vines} onRefresh={fetchVines} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

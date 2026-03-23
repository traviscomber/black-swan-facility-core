"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Leaf, Camera, Edit2 } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { VinePhotoUpload } from "@/components/vineyard/vine-photo-upload"
import { ImageGallery } from "@/components/vineyard/image-gallery"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import Image from "next/image"

interface Vine {
  id: string
  vine_number: string
  variety: string
  rootstock: string
  health_status: string
  age_years: number
  photo_url: string | null
  plot_id: string
}

interface VinesGalleryProps {
  plotId: string
}

export function VinesGallery({ plotId }: VinesGalleryProps) {
  const [vines, setVines] = useState<Vine[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVine, setSelectedVine] = useState<Vine | null>(null)
  const supabase = createBrowserClient()
  const { t } = useLanguage()

  useEffect(() => {
    fetchVines()
  }, [plotId])

  const fetchVines = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("vineyard_vines")
        .select("*")
        .eq("plot_id", plotId)
        .order("vine_number")

      if (error) throw error
      setVines(data || [])
    } catch (error) {
      console.error("[v0] Error fetching vines:", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoUploaded = async (photoUrl: string) => {
    if (!selectedVine) return

    try {
      const { error } = await supabase
        .from("vineyard_vines")
        .update({ photo_url: photoUrl })
        .eq("id", selectedVine.id)

      if (error) throw error

      setVines(vines.map((v) => 
        v.id === selectedVine.id ? { ...v, photo_url: photoUrl } : v
      ))
      setSelectedVine(null)
    } catch (error) {
      console.error("[v0] Error updating vine photo:", error)
    }
  }

  const getHealthColor = (status: string) => {
    if (status === "healthy") return "bg-green-100 text-green-800"
    if (status === "stressed") return "bg-yellow-100 text-yellow-800"
    return "bg-red-100 text-red-800"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading vines...</p>
      </div>
    )
  }

  if (vines.length === 0) {
    return (
      <div className="text-center py-8 rounded border border-dashed">
        <Leaf className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground">No vines recorded yet</p>
      </div>
    )
  }

  const vinePhotos = vines
    .filter((v) => v.photo_url)
    .map((v) => ({
      id: v.id,
      url: v.photo_url!,
      caption: `${v.vine_number} - ${v.variety}`,
    }))

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Vine Photos</h3>
        {vinePhotos.length > 0 ? (
          <ImageGallery images={vinePhotos} />
        ) : (
          <p className="text-sm text-muted-foreground">No vine photos uploaded yet</p>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Upload Vine Photos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vines.map((vine) => (
            <Card key={vine.id} className="overflow-hidden">
              {vine.photo_url && (
                <div className="relative w-full h-40">
                  <Image
                    src={vine.photo_url}
                    alt={`Vine ${vine.vine_number}`}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <CardHeader className={!vine.photo_url ? "" : "pt-3"}>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{vine.vine_number}</span>
                  <Badge className={getHealthColor(vine.health_status)}>
                    {vine.health_status}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-sm">
                  {vine.variety} • {vine.age_years}y
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Dialog open={selectedVine?.id === vine.id} onOpenChange={(open) => {
                  setSelectedVine(open ? vine : null)
                }}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setSelectedVine(vine)}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      {vine.photo_url ? "Update Photo" : "Add Photo"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Photo for Vine {vine.vine_number}</DialogTitle>
                    </DialogHeader>
                    {selectedVine && (
                      <VinePhotoUpload
                        vineId={selectedVine.id}
                        onPhotoUploaded={handlePhotoUploaded}
                        currentPhotoUrl={selectedVine.photo_url || undefined}
                      />
                    )}
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

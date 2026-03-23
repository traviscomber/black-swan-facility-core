"use client"

import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, Download } from "lucide-react"

interface ImageGalleryProps {
  images: Array<{
    id: string
    url: string
    caption?: string
    uploadedAt?: string
  }>
  onDelete?: (id: string) => void
  editable?: boolean
}

export function ImageGallery({ images, onDelete, editable }: ImageGalleryProps) {
  if (images.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No images uploaded yet
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {images.map((image) => (
        <Card key={image.id} className="overflow-hidden">
          <CardContent className="p-0 relative">
            <div className="relative w-full h-48">
              <Image
                src={image.url}
                alt={image.caption || "Vineyard image"}
                fill
                className="object-cover"
              />
            </div>
            {editable && onDelete && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => onDelete(image.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <div className="p-3 space-y-1">
              {image.caption && (
                <p className="text-sm font-medium truncate">{image.caption}</p>
              )}
              {image.uploadedAt && (
                <p className="text-xs text-muted-foreground">
                  {new Date(image.uploadedAt).toLocaleDateString()}
                </p>
              )}
              <a
                href={image.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <Download className="h-3 w-3" />
                Download
              </a>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

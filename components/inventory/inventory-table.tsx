"use client"

import type React from "react"
import { Archive, Edit2, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useState } from "react"
import Image from "next/image"
import type { InventoryAsset } from "@/components/inventory/types"

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
  maintenance: "En mantenimiento",
  deprecated: "Retirado",
}

const CLASS_LABELS: Record<string, string> = {
  equipment: "Equipo",
  infrastructure: "Infraestructura",
  tool: "Herramienta",
  vehicle: "Vehículo",
  other: "Otro",
}

export function InventoryTable({ assets, loading, onEdit, onDelete, onEditClick }: {
  assets: InventoryAsset[]
  loading: boolean
  onEdit: (asset: InventoryAsset) => void
  onDelete: (id: string) => void
  onEditClick: () => void
}) {
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null)
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 })

  const handleMouseEnter = (event: React.MouseEvent, assetId: string) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setHoveredAssetId(assetId)
    setPreviewPosition({ x: rect.right + 10, y: rect.top })
  }

  if (loading) return <div className="rounded-lg border p-8 text-center text-muted-foreground">Cargando inventario…</div>
  if (assets.length === 0) return <div className="rounded-lg border p-8 text-center text-muted-foreground">No hay registros.</div>

  return (
    <div className="relative overflow-x-auto rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Código</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Activo</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Clase</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Categoría</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Bodega</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Posición</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Responsable</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Estado</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const warehouse = asset.warehouse_location?.warehouse
            return (
              <tr key={asset.id} className="border-b border-border transition-colors hover:bg-muted/50" onMouseEnter={(event) => handleMouseEnter(event, asset.id)} onMouseLeave={() => setHoveredAssetId(null)}>
                <td className="px-4 py-3 font-mono text-sm text-primary">{asset.asset_code}</td>
                <td className="px-4 py-3 text-sm"><p className="font-medium">{asset.name}</p><p className="text-xs text-muted-foreground">{asset.cost_center?.code || asset.cost_center?.name || "Sin centro de costo"}</p></td>
                <td className="px-4 py-3 text-sm"><span className="rounded border px-2 py-1 text-xs font-medium">{CLASS_LABELS[asset.asset_class ?? ""] ?? asset.asset_class ?? "Sin clase"}</span></td>
                <td className="px-4 py-3 text-sm">{asset.category ? <span className="rounded border px-2 py-1 text-xs font-medium">{asset.category.name}</span> : <span className="text-amber-700">Sin categoría</span>}</td>
                <td className="px-4 py-3 text-sm">{warehouse ? <div><p className="font-medium">{warehouse.name}</p><p className="text-xs text-muted-foreground">{warehouse.code}</p></div> : <span className="text-amber-700">Sin bodega</span>}</td>
                <td className="px-4 py-3 text-sm">{asset.warehouse_location ? <div><p>{asset.warehouse_location.name}</p><p className="text-xs text-muted-foreground">{asset.warehouse_location.code}</p></div> : <span className="text-amber-700">Sin posición</span>}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{asset.assigned_to || "Sin asignar"}</td>
                <td className="px-4 py-3 text-sm"><span className="rounded border px-2 py-1 text-xs font-medium">{STATUS_LABELS[asset.status] ?? asset.status}</span></td>
                <td className="px-4 py-3 text-sm"><div className="flex justify-end gap-2"><Link href={`/inventory/${asset.id}`}><Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`Ver ${asset.name}`}><Eye className="h-4 w-4" /></Button></Link><Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { onEdit(asset); onEditClick() }} aria-label={`Editar ${asset.name}`}><Edit2 className="h-4 w-4" /></Button>{asset.status !== "deprecated" && <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => onDelete(asset.id)} aria-label={`Retirar ${asset.name}`} title="Marcar como retirado"><Archive className="h-4 w-4" /></Button>}</div></td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {hoveredAssetId && assets.filter((asset) => asset.id === hoveredAssetId && asset.photo_url).map((asset) => (
        <div key={`preview-${asset.id}`} className="pointer-events-none fixed z-50" style={{ left: previewPosition.x, top: previewPosition.y }}><div className="overflow-hidden rounded-lg border bg-background shadow-lg"><Image src={asset.photo_url || "/placeholder.svg"} alt={asset.name} width={200} height={200} className="h-48 w-48 object-cover" /><div className="bg-muted/50 p-2"><p className="text-xs font-medium">{asset.name}</p><p className="text-xs text-muted-foreground">{asset.asset_code}</p></div></div></div>
      ))}
    </div>
  )
}

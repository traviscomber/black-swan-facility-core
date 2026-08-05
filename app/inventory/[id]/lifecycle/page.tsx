"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { AssetLifecycleConsole } from "@/components/inventory/asset-lifecycle-console"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"

type AssetSummary = { id: string; name: string; asset_code: string; status: string | null }

export default function AssetLifecyclePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = useMemo(() => createBrowserClient(), [])
  const [asset, setAsset] = useState<AssetSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void supabase.from("assets").select("id,name,asset_code,status").eq("id", params.id).single().then(({ data }) => {
      setAsset((data as AssetSummary | null) ?? null)
      setLoading(false)
    })
  }, [params.id, supabase])

  if (loading) return <AppLayout><div className="p-8 text-center text-muted-foreground">Cargando ciclo de vida…</div></AppLayout>
  if (!asset) return <AppLayout><Card><CardContent className="py-10 text-center">Activo no encontrado.</CardContent></Card></AppLayout>

  return <AppLayout><div className="space-y-6 p-4 md:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><Button variant="ghost" className="mb-2 -ml-3" onClick={() => router.push(`/inventory/${asset.id}`)}><ChevronLeft className="mr-2 h-4 w-4" />Volver a ficha</Button><h1 className="text-2xl font-semibold">Ciclo de vida · {asset.name}</h1><p className="font-mono text-sm text-muted-foreground">{asset.asset_code}</p></div></div><AssetLifecycleConsole assetId={asset.id} assetName={asset.name} assetStatus={asset.status} /></div></AppLayout>
}

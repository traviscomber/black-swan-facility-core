"use client"

import { useMemo, useState } from "react"
import { QrCode, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

function normalizeCode(value: string) {
  const trimmed = value.trim()
  if (trimmed.startsWith("ASSET|")) return trimmed.split("|")[1] ?? trimmed
  return trimmed
}

export function AssetQrLookup() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const router = useRouter()
  const { toast } = useToast()
  const [value, setValue] = useState("")
  const [loading, setLoading] = useState(false)

  async function lookup() {
    const code = normalizeCode(value)
    if (!code) return
    setLoading(true)
    const { data, error } = await supabase.from("assets").select("id,name,asset_code").eq("asset_code", code).maybeSingle()
    setLoading(false)
    if (error || !data) {
      toast({ title: "Activo no encontrado", description: `No existe un activo con código ${code}.`, variant: "destructive" })
      return
    }
    router.push(`/inventory/${data.id}`)
  }

  return <Card className="mx-4 mt-4 md:mx-6 md:mt-6"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><QrCode className="h-4 w-4" />Lectura QR o código</CardTitle><CardDescription>Escanea con la cámara del dispositivo y pega el contenido, o ingresa el código interno.</CardDescription></CardHeader><CardContent><div className="flex flex-col gap-2 sm:flex-row"><Input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void lookup() }} placeholder="ASSET|FC-HER-001|Nombre o FC-HER-001" /><Button onClick={() => void lookup()} disabled={loading}><Search className="mr-2 h-4 w-4" />{loading ? "Buscando…" : "Abrir ficha"}</Button></div></CardContent></Card>
}

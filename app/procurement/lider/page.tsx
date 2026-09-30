"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { createBrowserClient } from "@/lib/supabase/client"
import { liderConsolidationLabel, nextLiderConsolidationDate } from "@/lib/procurement/lider-consolidation"

type Purchase = {
  id: string
  external_order_number: string
  purchased_at: string
  buyer_name: string | null
  total_clp: number
  status: "purchased" | "received" | "reconciled"
  source_type: string
  consolidated_at: string
}

const initialForm = { order: "", purchasedAt: "", buyer: "", total: "", costCenter: "", notes: "" }

export default function LiderPurchasesPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { toast } = useToast()
  const [rows, setRows] = useState<Purchase[]>([])
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("procurement_external_purchases")
      .select("id,external_order_number,purchased_at,buyer_name,total_clp,status,source_type,consolidated_at")
      .eq("provider", "lider")
      .order("purchased_at", { ascending: false })
      .limit(100)
    if (error) toast({ title: "No fue posible cargar las compras de Líder", variant: "destructive" })
    setRows((data ?? []) as Purchase[])
    setLoading(false)
  }, [supabase, toast])

  useEffect(() => { void load() }, [load])

  async function save() {
    const total = Number(form.total)
    if (!form.order.trim() || !form.purchasedAt || !Number.isFinite(total) || total < 0) {
      toast({ title: "Completa pedido, fecha y total.", variant: "destructive" })
      return
    }
    setSaving(true)
    const { error } = await supabase.from("procurement_external_purchases").insert({
      provider: "lider",
      external_order_number: form.order.trim(),
      purchased_at: new Date(form.purchasedAt + "T12:00:00-03:00").toISOString(),
      buyer_name: form.buyer.trim() || null,
      total_clp: total,
      cost_center: form.costCenter.trim() || null,
      notes: form.notes.trim() || null,
      source_type: "manual",
    })
    setSaving(false)
    if (error) {
      const duplicate = error.code === "23505"
      toast({ title: duplicate ? "Ese pedido de Líder ya está consolidado." : "No fue posible registrar la compra.", variant: "destructive" })
      return
    }
    setForm(initialForm)
    toast({ title: "Compra de Líder registrada." })
    await load()
  }

  const money = (value: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value)
  const date = (value: string) => new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "America/Santiago" }).format(new Date(value))
  const next = nextLiderConsolidationDate()

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Compras Líder" description="Registro operativo de compras realizadas en Líder App. Líder sigue siendo el canal de compra; Black Swan conserva la trazabilidad." />
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{liderConsolidationLabel()}</Badge>
          <span className="text-sm text-muted-foreground">Próxima consolidación sugerida: {date(next.toISOString())}</span>
          <Button asChild variant="outline" size="sm"><Link href="/procurement">Volver a Compras</Link></Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Consolidar compra</CardTitle>
            <CardDescription>Usa el número de pedido de Líder. El sistema bloquea duplicados.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Input placeholder="Nº pedido Líder" value={form.order} onChange={e => setForm({ ...form, order: e.target.value })} />
            <Input type="date" value={form.purchasedAt} onChange={e => setForm({ ...form, purchasedAt: e.target.value })} />
            <Input placeholder="Comprador" value={form.buyer} onChange={e => setForm({ ...form, buyer: e.target.value })} />
            <Input type="number" min="0" step="1" placeholder="Total CLP" value={form.total} onChange={e => setForm({ ...form, total: e.target.value })} />
            <Input placeholder="Centro de costo / área" value={form.costCenter} onChange={e => setForm({ ...form, costCenter: e.target.value })} />
            <Input placeholder="Notas" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            <div><Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Registrar compra"}</Button></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Historial</CardTitle><CardDescription>Últimas 100 compras consolidadas desde Líder.</CardDescription></CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay compras consolidadas.</p> : (
              <div className="divide-y">
                {rows.map(row => <div key={row.id} className="grid gap-1 py-3 text-sm md:grid-cols-5 md:items-center">
                  <div><p className="font-medium">{row.external_order_number}</p><p className="text-xs text-muted-foreground">{date(row.purchased_at)}</p></div>
                  <div>{row.buyer_name || "Sin comprador"}</div>
                  <div className="font-medium">{money(Number(row.total_clp))}</div>
                  <div><Badge variant="secondary">{row.status}</Badge></div>
                  <div className="text-xs text-muted-foreground">Consolidado {date(row.consolidated_at)}</div>
                </div>)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

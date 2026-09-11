"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus, Search, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/lib/hooks/use-language"
import { extrasCopy, fillExtrasCopy } from "@/lib/translations/extras"

interface Extra { id: string; name: string; description: string | null; unit: string; price: number; tax_rate: number; is_active: boolean }
function formatClp(value: number) { return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value) }

export default function BookingExtrasPage() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const copy = extrasCopy[language]
  const unitLabels: Record<string, string> = { unit: copy.unitUnit, night: copy.unitNight, person: copy.unitPerson, person_night: copy.unitPersonNight, stay: copy.unitStay }
  const [extras, setExtras] = useState<Extra[]>([])
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("active")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", description: "", unit: "unit", price: "", tax_rate: "0" })

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const { data, error: loadError } = await supabase.from("booking_extras").select("id, name, description, unit, price, tax_rate, is_active").order("name")
    if (loadError) setError(loadError.message)
    else { setError(null); setExtras((data ?? []) as Extra[]) }
    if (!silent) setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadData()
    const channel = supabase.channel("booking-extras-board").on("postgres_changes", { event: "*", schema: "public", table: "booking_extras" }, () => void loadData(true)).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadData, supabase])

  const visibleExtras = useMemo(() => {
    const term = search.trim().toLowerCase()
    return extras.filter((extra) => {
      const matchesSearch = !term || extra.name.toLowerCase().includes(term) || (extra.description ?? "").toLowerCase().includes(term)
      const matchesStatus = status === "all" || (status === "active" ? extra.is_active : !extra.is_active)
      return matchesSearch && matchesStatus
    })
  }, [extras, search, status])

  async function createExtra() {
    if (!form.name.trim() || Number(form.price) < 0) return
    setSaving(true)
    const { error: insertError } = await supabase.from("booking_extras").insert({ name: form.name.trim(), description: form.description.trim() || null, unit: form.unit, price: Number(form.price), tax_rate: Number(form.tax_rate) })
    if (insertError) setError(insertError.message)
    else { setOpen(false); setForm({ name: "", description: "", unit: "unit", price: "", tax_rate: "0" }); await loadData(true) }
    setSaving(false)
  }

  async function toggleExtra(extra: Extra) {
    const { error: updateError } = await supabase.from("booking_extras").update({ is_active: !extra.is_active }).eq("id", extra.id)
    if (updateError) setError(updateError.message); else await loadData(true)
  }

  async function deleteExtra(extra: Extra) {
    if (!window.confirm(fillExtrasCopy(copy.deleteConfirm, { name: extra.name }))) return
    const { error: deleteError } = await supabase.from("booking_extras").delete().eq("id", extra.id)
    if (deleteError) setError(deleteError.message); else await loadData(true)
  }

  return <div className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="flex min-h-[58px] items-center justify-between gap-3 bg-[#211e1a] px-4 py-2">
      <div className="min-w-0"><h1 className="truncate text-lg font-normal">{copy.title}</h1><p className="truncate text-xs text-[#b9b0a4]">{copy.subtitle}</p></div>
      <Button size="sm" onClick={() => setOpen(true)} className="h-8 rounded-none bg-[#d7ccb9] px-3 text-[#171512] hover:bg-[#e7e1d8]"><Plus className="mr-2 h-3.5 w-3.5" />{copy.newExtra}</Button>
    </header>

    <div className="flex min-h-10 items-center gap-2 bg-[#211e1a] px-3 py-1.5">
      <div className="relative min-w-0 flex-1"><Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#8f867b]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-8 rounded-none border-0 bg-[#2b2722] pl-8 text-xs text-[#e7e1d8]" placeholder={copy.search} /></div>
      <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-8 w-44 rounded-none border-0 bg-[#2b2722] text-xs text-[#e7e1d8]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">{copy.activePlural}</SelectItem><SelectItem value="inactive">{copy.inactivePlural}</SelectItem><SelectItem value="all">{copy.all}</SelectItem></SelectContent></Select>
    </div>

    {error && <div className="bg-[#4a2420] px-4 py-2 text-xs text-[#f0c7bd]">{error}</div>}

    <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-xs"><thead className="sticky top-0 bg-[#211e1a] text-left text-[#8f867b]"><tr><th className="px-3 py-2 font-medium">{copy.name}</th><th className="px-3 py-2 font-medium">{copy.unit}</th><th className="px-3 py-2 font-medium">{copy.price}</th><th className="px-3 py-2 font-medium">{copy.tax}</th><th className="px-3 py-2 font-medium">{copy.status}</th><th className="px-3 py-2 text-right font-medium">{copy.actions}</th></tr></thead><tbody>{loading ? <tr><td colSpan={6} className="p-10 text-center text-[#8f867b]">{copy.loading}</td></tr> : visibleExtras.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-[#8f867b]">{copy.noResults}</td></tr> : visibleExtras.map((extra) => <tr key={extra.id} className="bg-[#171512] hover:bg-[#211e1a]"><td className="px-3 py-2"><div className="font-medium text-[#e7e1d8]">{extra.name}</div><div className="max-w-xl truncate text-[11px] text-[#8f867b]">{extra.description || copy.noDescription}</div></td><td className="px-3 py-2 text-[#b9b0a4]">{unitLabels[extra.unit] ?? extra.unit}</td><td className="px-3 py-2 font-medium">{formatClp(Number(extra.price))}</td><td className="px-3 py-2 text-[#b9b0a4]">{Number(extra.tax_rate)}%</td><td className="px-3 py-2"><button className={`px-2 py-1 text-[11px] ${extra.is_active ? "bg-[#2f3a31] text-[#bcd0bf]" : "bg-[#2b2722] text-[#8f867b]"}`} onClick={() => void toggleExtra(extra)}>{extra.is_active ? copy.active : copy.inactive}</button></td><td className="px-3 py-2 text-right"><Button size="icon" variant="ghost" className="h-7 w-7 rounded-none text-[#b9b0a4] hover:bg-[#2b2722] hover:text-[#e7e1d8]" onClick={() => void deleteExtra(extra)} aria-label={`${copy.actions}: ${extra.name}`}><Trash2 className="h-3.5 w-3.5" /></Button></td></tr>)}</tbody></table></div>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="rounded-none"><DialogHeader><DialogTitle>{copy.newExtra}</DialogTitle></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>{copy.name}</Label><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div><div className="space-y-2"><Label>{copy.description}</Label><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div><div className="grid grid-cols-3 gap-3"><div className="space-y-2"><Label>{copy.unit}</Label><Select value={form.unit} onValueChange={(value) => setForm({ ...form, unit: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(unitLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>{copy.price}</Label><Input type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></div><div className="space-y-2"><Label>{copy.tax} %</Label><Input type="number" min="0" max="100" value={form.tax_rate} onChange={(event) => setForm({ ...form, tax_rate: event.target.value })} /></div></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>{copy.cancel}</Button><Button disabled={saving || !form.name.trim() || form.price === ""} onClick={createExtra}>{saving ? copy.saving : copy.create}</Button></div></div></DialogContent></Dialog>
  </div>
}

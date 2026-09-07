"use client"

import Link from "next/link"
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, Check, Loader2, PackagePlus, Scale, Settings2 } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"
type CountStatus = "counted" | "pending"
type Unit = "seeds" | "grams" | "tubers" | "plants" | "units"
type SeedLot = {
  id: string
  crop_name: string
  variety: string | null
  lot_code: string | null
  supplier: string | null
  quantity_seeds: number
  quantity_value: number | null
  quantity_unit: string | null
  count_status: CountStatus
  storage_location: string | null
  notes: string | null
  created_at: string
}

type LotForm = {
  crop_name: string
  quantity: string
  quantity_unit: string
  variety: string
  lot_code: string
  supplier: string
  storage_location: string
  notes: string
}

const blankLot: LotForm = { crop_name: "", quantity: "", quantity_unit: "", variety: "", lot_code: "", supplier: "", storage_location: "", notes: "" }
const unitOptions: Unit[] = ["seeds", "grams", "tubers", "plants", "units"]
const isValidPhysicalQuantity = (value: number, unit: string) => Number.isFinite(value) && value > 0 && (unit === "grams" || Number.isInteger(value))

const copy = {
  en: {
    eyebrow: "Orchard · Physical stock",
    title: "Quick stock",
    description: "Record what is physically on hand without turning the season plan into inventory.",
    back: "Seeds & transplants",
    addTitle: "Add stock",
    addHelp: "Crop is required. Add the physical quantity and unit when known; leave the quantity blank when stock exists but still needs counting.",
    crop: "Crop",
    quantity: "Physical quantity",
    unit: "Unit",
    optional: "Optional details",
    variety: "Variety",
    lot: "Lot code",
    supplier: "Supplier",
    storage: "Storage",
    notes: "Notes",
    save: "Add stock",
    saving: "Saving…",
    current: "Current physical stock",
    currentHelp: "Pending count means physical stock has been confirmed but no quantity has been invented.",
    pending: "Pending count",
    counted: "Counted",
    none: "No physical stock recorded yet.",
    countTitle: "Complete a pending count",
    countHelp: "Choose a confirmed stock item, enter the physical quantity and unit, and keep the original lot identity.",
    choose: "Choose pending stock",
    apply: "Save count",
    noPending: "There are no pending counts.",
    advanced: "Advanced seed & nursery management",
    error: "Could not save stock",
    loadError: "Could not load physical stock",
    saved: "Stock saved",
    units: { seeds: "Seeds", grams: "Grams", tubers: "Tubers / seed potatoes", plants: "Plants", units: "Units" },
  },
  es: {
    eyebrow: "Huerto · Stock físico",
    title: "Stock rápido",
    description: "Registra lo que existe físicamente sin convertir el plan de temporada en inventario.",
    back: "Semillas y trasplantes",
    addTitle: "Agregar stock",
    addHelp: "El cultivo es obligatorio. Agrega cantidad física y unidad cuando las conozcas; deja la cantidad vacía si el stock existe pero aún falta contarlo.",
    crop: "Cultivo",
    quantity: "Cantidad física",
    unit: "Unidad",
    optional: "Detalles opcionales",
    variety: "Variedad",
    lot: "Código de lote",
    supplier: "Proveedor",
    storage: "Almacenamiento",
    notes: "Notas",
    save: "Agregar stock",
    saving: "Guardando…",
    current: "Stock físico actual",
    currentHelp: "Conteo pendiente significa que el stock físico fue confirmado, pero no se inventó una cantidad.",
    pending: "Conteo pendiente",
    counted: "Contado",
    none: "Aún no hay stock físico registrado.",
    countTitle: "Completar un conteo pendiente",
    countHelp: "Elige un stock confirmado, ingresa la cantidad física y su unidad, y conserva la identidad del lote original.",
    choose: "Elegir stock pendiente",
    apply: "Guardar conteo",
    noPending: "No hay conteos pendientes.",
    advanced: "Gestión avanzada de semillas y almácigos",
    error: "No fue posible guardar el stock",
    loadError: "No fue posible cargar el stock físico",
    saved: "Stock guardado",
    units: { seeds: "Semillas", grams: "Gramos", tubers: "Tubérculos / papa semilla", plants: "Plantas", units: "Unidades" },
  },
  de: {
    eyebrow: "Obstbau · Physischer Bestand",
    title: "Schnellbestand",
    description: "Erfasse den tatsächlichen Bestand, ohne den Saisonplan in Inventar umzuwandeln.",
    back: "Saatgut & Jungpflanzen",
    addTitle: "Bestand hinzufügen",
    addHelp: "Kultur ist erforderlich. Physische Menge und Einheit eintragen, wenn bekannt; Menge leer lassen, wenn Bestand vorhanden, aber noch nicht gezählt ist.",
    crop: "Kultur",
    quantity: "Physische Menge",
    unit: "Einheit",
    optional: "Optionale Details",
    variety: "Sorte",
    lot: "Partiecode",
    supplier: "Lieferant",
    storage: "Lagerort",
    notes: "Notizen",
    save: "Bestand hinzufügen",
    saving: "Speichern…",
    current: "Aktueller physischer Bestand",
    currentHelp: "Ausstehende Zählung bedeutet: Bestand ist physisch bestätigt, aber keine Menge wurde erfunden.",
    pending: "Zählung ausstehend",
    counted: "Gezählt",
    none: "Noch kein physischer Bestand erfasst.",
    countTitle: "Ausstehende Zählung abschließen",
    countHelp: "Bestätigten Bestand auswählen, physische Menge und Einheit erfassen und die ursprüngliche Partie beibehalten.",
    choose: "Ausstehenden Bestand wählen",
    apply: "Zählung speichern",
    noPending: "Keine ausstehenden Zählungen.",
    advanced: "Erweiterte Saatgut- & Anzuchtverwaltung",
    error: "Bestand konnte nicht gespeichert werden",
    loadError: "Physischer Bestand konnte nicht geladen werden",
    saved: "Bestand gespeichert",
    units: { seeds: "Saatgut", grams: "Gramm", tubers: "Knollen / Pflanzkartoffeln", plants: "Pflanzen", units: "Einheiten" },
  },
} as const

export default function QuickStockPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language as Locale
  const text = copy[lang]
  const locale = lang === "es" ? "es-CL" : lang === "de" ? "de-DE" : "en-US"
  const query = typeof window !== "undefined" ? window.location.search : ""

  const [lots, setLots] = useState<SeedLot[]>([])
  const [form, setForm] = useState<LotForm>(blankLot)
  const [pendingLotId, setPendingLotId] = useState("")
  const [pendingQuantity, setPendingQuantity] = useState("")
  const [pendingUnit, setPendingUnit] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await supabase
      .from("orchard_seed_lots")
      .select("id,crop_name,variety,lot_code,supplier,quantity_seeds,quantity_value,quantity_unit,count_status,storage_location,notes,created_at")
      .order("created_at", { ascending: false })
    if (result.error) setError(`${text.loadError}: ${result.error.message}`)
    else setLots((result.data ?? []) as SeedLot[])
    setLoading(false)
  }, [supabase, text.loadError])

  useEffect(() => { void load() }, [load])

  const pendingLots = lots.filter((lot) => lot.count_status === "pending")

  async function addStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const crop = form.crop_name.trim()
    if (!crop) return
    const hasCount = form.quantity.trim() !== ""
    const quantity = hasCount ? Number(form.quantity) : 0
    if (hasCount && (!form.quantity_unit || !isValidPhysicalQuantity(quantity, form.quantity_unit))) return

    setSaving(true)
    setError(null)
    setMessage(null)
    const result = await supabase.from("orchard_seed_lots").insert({
      crop_name: crop,
      quantity_seeds: hasCount && form.quantity_unit === "seeds" ? quantity : 0,
      quantity_value: hasCount ? quantity : null,
      quantity_unit: hasCount ? form.quantity_unit : null,
      count_status: hasCount ? "counted" : "pending",
      variety: form.variety.trim() || null,
      lot_code: form.lot_code.trim() || null,
      supplier: form.supplier.trim() || null,
      storage_location: form.storage_location.trim() || null,
      notes: form.notes.trim() || (hasCount ? null : "Physical stock confirmed by operator; exact count pending."),
    })
    if (result.error) setError(`${text.error}: ${result.error.message}`)
    else {
      setForm(blankLot)
      setMessage(text.saved)
      await load()
    }
    setSaving(false)
  }

  async function completeCount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const quantity = Number(pendingQuantity)
    if (!pendingLotId || !pendingUnit || !isValidPhysicalQuantity(quantity, pendingUnit)) return
    setSaving(true)
    setError(null)
    setMessage(null)
    const result = await supabase
      .from("orchard_seed_lots")
      .update({
        quantity_seeds: pendingUnit === "seeds" ? quantity : 0,
        quantity_value: quantity,
        quantity_unit: pendingUnit,
        count_status: "counted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", pendingLotId)
    if (result.error) setError(`${text.error}: ${result.error.message}`)
    else {
      setPendingLotId("")
      setPendingQuantity("")
      setPendingUnit("")
      setMessage(text.saved)
      await load()
    }
    setSaving(false)
  }

  return <AppLayout><OrchardNavigation/><main className="min-h-full bg-[var(--orchard-canvas)] px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link href={`/${language}/orchard/nursery${query}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4"/>{text.back}</Link>
        <p className="mt-6 text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--orchard-green)]">{text.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-.035em] sm:text-4xl">{text.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{text.description}</p>
      </div>

      {error && <div className="border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
      {message && <div className="flex items-center gap-2 border border-[var(--orchard-green)]/35 bg-[var(--orchard-green-soft)] px-4 py-3 text-sm text-[var(--orchard-green)]"><Check className="h-4 w-4"/>{message}</div>}

      <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>{text.addTitle}</CardTitle><CardDescription>{text.addHelp}</CardDescription></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={addStock}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={text.crop}><Input value={form.crop_name} onChange={(e)=>setForm((v)=>({...v,crop_name:e.target.value}))} required autoFocus/></Field>
                <Field label={text.quantity}><Input type="number" min="0.01" step="any" value={form.quantity} onChange={(e)=>setForm((v)=>({...v,quantity:e.target.value}))} placeholder="—"/></Field>
              </div>
              <Field label={text.unit}><Select value={form.quantity_unit} onValueChange={(value)=>setForm((v)=>({...v,quantity_unit:value}))}><SelectTrigger><SelectValue placeholder="—"/></SelectTrigger><SelectContent>{unitOptions.map((unit)=><SelectItem key={unit} value={unit}>{text.units[unit]}</SelectItem>)}</SelectContent></Select></Field>
              <details className="border-t border-[var(--orchard-line)] pt-4"><summary className="cursor-pointer text-sm font-medium text-muted-foreground">{text.optional}</summary><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label={text.variety}><Input value={form.variety} onChange={(e)=>setForm((v)=>({...v,variety:e.target.value}))}/></Field><Field label={text.lot}><Input value={form.lot_code} onChange={(e)=>setForm((v)=>({...v,lot_code:e.target.value}))}/></Field><Field label={text.supplier}><Input value={form.supplier} onChange={(e)=>setForm((v)=>({...v,supplier:e.target.value}))}/></Field><Field label={text.storage}><Input value={form.storage_location} onChange={(e)=>setForm((v)=>({...v,storage_location:e.target.value}))}/></Field><div className="sm:col-span-2"><Field label={text.notes}><Textarea value={form.notes} onChange={(e)=>setForm((v)=>({...v,notes:e.target.value}))}/></Field></div></div></details>
              <Button type="submit" disabled={saving || !form.crop_name.trim() || (Boolean(form.quantity) && !form.quantity_unit)} className="w-full sm:w-auto"><PackagePlus className="mr-2 h-4 w-4"/>{saving ? text.saving : text.save}</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{text.current}</CardTitle><CardDescription>{text.currentHelp}</CardDescription></CardHeader>
          <CardContent>{loading ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Loading…</div> : lots.length===0 ? <p className="py-8 text-sm text-muted-foreground">{text.none}</p> : <div className="grid gap-3 sm:grid-cols-2">{lots.map((lot)=>{const value=lot.quantity_value??(lot.quantity_unit===null||lot.quantity_unit==="seeds"?lot.quantity_seeds:null);return <div key={lot.id} className="border border-[var(--orchard-line)] bg-[var(--bs-surface-secondary)] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{lot.crop_name}{lot.variety?` · ${lot.variety}`:""}</p><p className="mt-1 text-xs text-muted-foreground">{lot.lot_code||lot.supplier||lot.storage_location||"—"}</p></div>{lot.count_status==="pending"?<Badge variant="outline">{text.pending}</Badge>:<Badge variant="secondary">{text.counted}</Badge>}</div><div className="mt-4 flex items-baseline gap-2"><span className="text-2xl font-medium">{lot.count_status==="pending"||value==null?"—":value.toLocaleString(locale)}</span><span className="text-xs text-muted-foreground">{lot.count_status==="pending"?text.pending:(lot.quantity_unit && text.units[lot.quantity_unit as Unit])||lot.quantity_unit||text.units.seeds}</span></div></div>})}</div>}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{text.countTitle}</CardTitle><CardDescription>{text.countHelp}</CardDescription></CardHeader>
        <CardContent>{pendingLots.length===0 ? <p className="text-sm text-muted-foreground">{text.noPending}</p> : <form className="grid gap-4 md:grid-cols-[1.4fr_.7fr_.8fr_auto] md:items-end" onSubmit={completeCount}><Field label={text.choose}><Select value={pendingLotId} onValueChange={setPendingLotId}><SelectTrigger><SelectValue placeholder="—"/></SelectTrigger><SelectContent>{pendingLots.map((lot)=><SelectItem key={lot.id} value={lot.id}>{lot.crop_name}{lot.variety?` · ${lot.variety}`:""}</SelectItem>)}</SelectContent></Select></Field><Field label={text.quantity}><Input type="number" min="0.01" step="any" value={pendingQuantity} onChange={(e)=>setPendingQuantity(e.target.value)}/></Field><Field label={text.unit}><Select value={pendingUnit} onValueChange={setPendingUnit}><SelectTrigger><SelectValue placeholder="—"/></SelectTrigger><SelectContent>{unitOptions.map((unit)=><SelectItem key={unit} value={unit}>{text.units[unit]}</SelectItem>)}</SelectContent></Select></Field><Button type="submit" disabled={saving||!pendingLotId||!pendingQuantity||!pendingUnit}><Scale className="mr-2 h-4 w-4"/>{text.apply}</Button></form>}</CardContent>
      </Card>

      <Link href={`/${language}/orchard/nursery/advanced${query}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><Settings2 className="h-4 w-4"/>{text.advanced}</Link>
    </div>
  </main></AppLayout>
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <div className="space-y-2"><Label>{label}</Label>{children}</div>}

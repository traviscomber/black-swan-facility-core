"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import type { Checklist, ChecklistItem } from "@/lib/types"

const COPY = {
  en: { loading: "Loading…", notFound: "Checklist not found", fallbackTitle: "Checklist", items: "Checklist items", of: "of", completed: "completed", completedAt: "Completed", empty: "No items in this checklist" },
  es: { loading: "Cargando…", notFound: "Lista de verificación no encontrada", fallbackTitle: "Lista de verificación", items: "Ítems de la lista", of: "de", completed: "completados", completedAt: "Completado", empty: "No hay ítems en esta lista de verificación" },
  de: { loading: "Wird geladen…", notFound: "Checkliste nicht gefunden", fallbackTitle: "Checkliste", items: "Checklistenpunkte", of: "von", completed: "abgeschlossen", completedAt: "Abgeschlossen", empty: "Diese Checkliste enthält keine Punkte" },
} as const

const LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const

export default function ChecklistDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { language } = useLanguage()
  const copy = COPY[language]
  const dateTime = useMemo(() => new Intl.DateTimeFormat(LOCALES[language], { dateStyle: "medium", timeStyle: "short" }), [language])
  const number = useMemo(() => new Intl.NumberFormat(LOCALES[language]), [language])
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      const supabase = createClient()
      const [checklistResult, itemsResult] = await Promise.all([
        supabase.from("checklists").select("*, employees(name)").eq("id", id).single(),
        supabase.from("checklist_items").select("*").eq("checklist_id", id).order("item"),
      ])
      if (cancelled) return
      if (checklistResult.data) setChecklist(checklistResult.data)
      if (itemsResult.data) setItems(itemsResult.data)
      setLoading(false)
    }
    void fetchData()
    return () => { cancelled = true }
  }, [id])

  const handleToggleItem = async (itemId: string, currentState: boolean) => {
    const supabase = createClient()
    const completedAt = !currentState ? new Date().toISOString() : null
    const { error } = await supabase.from("checklist_items").update({ is_completed: !currentState, completed_at: completedAt }).eq("id", itemId)
    if (!error) {
      setItems((current) => current.map((item) => item.id === itemId ? { ...item, is_completed: !currentState, completed_at: completedAt } : item))
    }
  }

  if (loading) {
    return <AppLayout><div className="flex min-h-[40vh] items-center justify-center px-6"><p className="text-sm text-muted-foreground">{copy.loading}</p></div></AppLayout>
  }

  if (!checklist) {
    return <AppLayout><div className="flex min-h-[40vh] items-center justify-center px-6"><p className="text-sm text-muted-foreground">{copy.notFound}</p></div></AppLayout>
  }

  const completedCount = items.filter((item) => item.is_completed).length
  const totalCount = items.length

  return (
    <AppLayout>
      <PageHeader title={checklist.title || copy.fallbackTitle} description={checklist.description || undefined} />
      <div className="p-4 md:p-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col gap-3 border-y py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-medium">{copy.items}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{number.format(completedCount)} {copy.of} {number.format(totalCount)} {copy.completed}</p>
            </div>
            {checklist.frequency && <Badge variant="outline">{checklist.frequency}</Badge>}
          </div>

          {items.length > 0 ? (
            <div className="border-b">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-3 border-t px-1 py-4 transition-colors hover:bg-muted/30 first:border-t-0">
                  <Checkbox id={item.id} checked={item.is_completed} onCheckedChange={() => handleToggleItem(item.id, item.is_completed)} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <label htmlFor={item.id} className={`cursor-pointer text-sm ${item.is_completed ? "text-muted-foreground line-through" : "text-foreground"}`}>{item.item}</label>
                    {item.completed_at && <p className="mt-1 text-xs text-muted-foreground">{copy.completedAt}: {dateTime.format(new Date(item.completed_at))}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="border-b py-10 text-center text-sm text-muted-foreground">{copy.empty}</p>}
        </div>
      </div>
    </AppLayout>
  )
}

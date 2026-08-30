"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import type { Checklist, ChecklistItem } from "@/lib/types"

const COPY = {
  en: { loading: "Loading...", notFound: "Checklist not found", fallbackTitle: "Checklist", items: "Checklist items", of: "of", completed: "completed", completedAt: "Completed", empty: "No items in this checklist" },
  es: { loading: "Cargando...", notFound: "Checklist no encontrado", fallbackTitle: "Checklist", items: "Ítems del checklist", of: "de", completed: "completados", completedAt: "Completado", empty: "No hay ítems en este checklist" },
  de: { loading: "Wird geladen...", notFound: "Checkliste nicht gefunden", fallbackTitle: "Checkliste", items: "Checklistenpunkte", of: "von", completed: "abgeschlossen", completedAt: "Abgeschlossen", empty: "Diese Checkliste enthält keine Punkte" },
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
    return <AppLayout><div className="flex h-screen items-center justify-center"><p className="text-gray-500">{copy.loading}</p></div></AppLayout>
  }

  if (!checklist) {
    return <AppLayout><div className="flex h-screen items-center justify-center"><p className="text-gray-500">{copy.notFound}</p></div></AppLayout>
  }

  const completedCount = items.filter((item) => item.is_completed).length
  const totalCount = items.length

  return (
    <AppLayout>
      <PageHeader title={checklist.title || copy.fallbackTitle} description={checklist.description || undefined} />
      <div className="p-8">
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{copy.items}</CardTitle>
                  <CardDescription>{number.format(completedCount)} {copy.of} {number.format(totalCount)} {copy.completed}</CardDescription>
                </div>
                {checklist.frequency && <Badge variant="outline">{checklist.frequency}</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              {items.length > 0 ? (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50">
                      <Checkbox id={item.id} checked={item.is_completed} onCheckedChange={() => handleToggleItem(item.id, item.is_completed)} className="mt-1" />
                      <div className="flex-1">
                        <label htmlFor={item.id} className={`cursor-pointer text-sm ${item.is_completed ? "text-gray-500 line-through" : "text-gray-900"}`}>{item.item}</label>
                        {item.completed_at && <p className="mt-1 text-xs text-gray-500">{copy.completedAt}: {dateTime.format(new Date(item.completed_at))}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-center text-gray-500">{copy.empty}</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}

"use client"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { useState, useEffect } from "react"
import type { Checklist, ChecklistItem } from "@/lib/types"
import { useParams } from "next/navigation"

export default function ChecklistDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()

      const { data: checklistData } = await supabase
        .from("checklists")
        .select("*, employees(name)")
        .eq("id", id)
        .single()

      const { data: itemsData } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("checklist_id", id)
        .order("item")

      if (checklistData) setChecklist(checklistData)
      if (itemsData) setItems(itemsData)
      setLoading(false)
    }

    fetchData()
  }, [id])

  const handleToggleItem = async (itemId: string, currentState: boolean) => {
    const supabase = createClient()

    const { error } = await supabase
      .from("checklist_items")
      .update({
        is_completed: !currentState,
        completed_at: !currentState ? new Date().toISOString() : null,
      })
      .eq("id", itemId)

    if (!error) {
      setItems(
        items.map((item) =>
          item.id === itemId
            ? { ...item, is_completed: !currentState, completed_at: !currentState ? new Date().toISOString() : null }
            : item,
        ),
      )
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-gray-500">Loading...</p>
        </div>
      </AppLayout>
    )
  }

  if (!checklist) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-gray-500">Checklist not found</p>
        </div>
      </AppLayout>
    )
  }

  const completedCount = items.filter((item) => item.is_completed).length
  const totalCount = items.length

  return (
    <AppLayout>
      <PageHeader title={checklist.title || "Checklist"} description={checklist.description || undefined} />

      <div className="p-8">
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Checklist Items</CardTitle>
                  <CardDescription>
                    {completedCount} of {totalCount} completed
                  </CardDescription>
                </div>
                {checklist.frequency && <Badge variant="outline">{checklist.frequency}</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              {items.length > 0 ? (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
                    >
                      <Checkbox
                        id={item.id}
                        checked={item.is_completed}
                        onCheckedChange={() => handleToggleItem(item.id, item.is_completed)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <label
                          htmlFor={item.id}
                          className={`cursor-pointer text-sm ${
                            item.is_completed ? "text-gray-500 line-through" : "text-gray-900"
                          }`}
                        >
                          {item.item}
                        </label>
                        {item.completed_at && (
                          <p className="mt-1 text-xs text-gray-500">
                            Completed: {new Date(item.completed_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500">No items in this checklist</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}

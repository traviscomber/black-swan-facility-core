"use client"

import Link from "next/link"
import { ChevronRight, Plus } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/lib/hooks/use-language"
import type { Checklist } from "@/lib/types"

type ChecklistRow = Checklist & { employees?: { name: string } | null }

const COPY = {
  en: { title: "Checklists", description: "Operational checklists and tasks", add: "Add checklist", noDescription: "No description", assigned: "Assigned to", empty: "No checklists found" },
  es: { title: "Checklists", description: "Checklists y tareas operacionales", add: "Agregar checklist", noDescription: "Sin descripción", assigned: "Asignado a", empty: "No se encontraron checklists" },
  de: { title: "Checklisten", description: "Betriebliche Checklisten und Aufgaben", add: "Checkliste hinzufügen", noDescription: "Keine Beschreibung", assigned: "Zugewiesen an", empty: "Keine Checklisten gefunden" },
} as const

export function LocalizedChecklistsPage({ checklists }: { checklists: ChecklistRow[] }) {
  const { language } = useLanguage()
  const copy = COPY[language]

  return (
    <>
      <PageHeader
        title={copy.title}
        description={copy.description}
        actions={<Button><Plus className="mr-2 h-4 w-4" />{copy.add}</Button>}
      />
      <div className="p-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {checklists.length > 0 ? checklists.map((checklist) => (
            <Link key={checklist.id} href={`/${language}/checklists/${checklist.id}`}>
              <Card className="cursor-pointer transition-all hover:border-blue-300 hover:shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">{checklist.title}</CardTitle>
                      <CardDescription className="mt-1">{checklist.description || copy.noDescription}</CardDescription>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {checklist.frequency && <Badge variant="outline">{checklist.frequency}</Badge>}
                    {checklist.employees && <span className="text-xs text-gray-600">{copy.assigned} {checklist.employees.name}</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          )) : <div className="col-span-full text-center text-gray-500">{copy.empty}</div>}
        </div>
      </div>
    </>
  )
}

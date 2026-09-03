"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/lib/hooks/use-language"
import type { Checklist } from "@/lib/types"

type ChecklistRow = Checklist & { employees?: { name: string } | null }

const COPY = {
  en: { title: "Checklists", description: "Operational checklists and their assigned work.", noDescription: "No description", assigned: "Assigned to", empty: "No checklists found" },
  es: { title: "Listas de verificación", description: "Listas operativas y trabajo asignado asociado.", noDescription: "Sin descripción", assigned: "Asignada a", empty: "No hay listas de verificación registradas" },
  de: { title: "Checklisten", description: "Betriebliche Checklisten und zugewiesene Arbeit.", noDescription: "Keine Beschreibung", assigned: "Zugewiesen an", empty: "Keine Checklisten gefunden" },
} as const

export function LocalizedChecklistsPage({ checklists }: { checklists: ChecklistRow[] }) {
  const { language } = useLanguage()
  const copy = COPY[language]

  return (
    <>
      <PageHeader title={copy.title} description={copy.description} />
      <div className="p-4 md:p-6">
        {checklists.length > 0 ? (
          <div className="border-t">
            {checklists.map((checklist) => (
              <Link
                key={checklist.id}
                href={`/${language}/checklists/${checklist.id}`}
                className="group grid gap-3 border-b px-1 py-4 transition-colors hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <h2 className="truncate text-base font-medium">{checklist.title}</h2>
                    {checklist.frequency && <Badge variant="outline">{checklist.frequency}</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{checklist.description || copy.noDescription}</p>
                  {checklist.employees && <p className="mt-2 text-xs text-muted-foreground">{copy.assigned} {checklist.employees.name}</p>}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="border-y py-12 text-center text-sm text-muted-foreground">{copy.empty}</div>
        )}
      </div>
    </>
  )
}

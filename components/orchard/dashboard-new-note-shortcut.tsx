"use client"

import Link from "next/link"
import { StickyNote } from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"

const copy={
 en:"New note",
 es:"Nueva nota",
 de:"Neue Notiz",
} as const

export function DashboardNewNoteShortcut(){
 const {language}=useLanguage()
 return <Link href={`/${language}/orchard/notes/new`} className="inline-flex min-h-9 items-center gap-2 border border-[var(--orchard-line)] bg-[var(--bs-surface-primary)] px-3 text-xs text-foreground transition-colors hover:bg-[var(--bs-surface-secondary)]"><StickyNote className="h-3.5 w-3.5 text-[var(--orchard-green)]"/>{copy[language]}</Link>
}

"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/hooks/use-language"

const copy = {
  en: {
    eyebrow: "System",
    title: "Something went wrong",
    description: "The current view could not be completed. You can retry without losing the current route.",
    retry: "Try again",
  },
  es: {
    eyebrow: "Sistema",
    title: "Ocurrió un problema",
    description: "No fue posible completar la vista actual. Puedes reintentar sin perder la ruta actual.",
    retry: "Reintentar",
  },
  de: {
    eyebrow: "System",
    title: "Ein Fehler ist aufgetreten",
    description: "Die aktuelle Ansicht konnte nicht abgeschlossen werden. Sie können erneut versuchen, ohne die aktuelle Route zu verlieren.",
    retry: "Erneut versuchen",
  },
} as const

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { language } = useLanguage()
  const text = copy[language]

  useEffect(() => {
    console.error("Application render error", { digest: error.digest })
  }, [error.digest])

  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-xl border-t border-border pt-8">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-destructive">{text.eyebrow}</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">{text.title}</h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">{text.description}</p>
        <Button className="mt-8" onClick={reset}>{text.retry}</Button>
      </div>
    </main>
  )
}

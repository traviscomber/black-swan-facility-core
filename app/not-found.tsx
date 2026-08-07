import Link from "next/link"
import { headers } from "next/headers"

const copy = {
  en: {
    eyebrow: "Navigation",
    title: "Page not found",
    description: "The requested page does not exist or is no longer available.",
    action: "Return to dashboard",
  },
  es: {
    eyebrow: "Navegación",
    title: "Página no encontrada",
    description: "La página solicitada no existe o ya no está disponible.",
    action: "Volver al dashboard",
  },
  de: {
    eyebrow: "Navigation",
    title: "Seite nicht gefunden",
    description: "Die angeforderte Seite existiert nicht oder ist nicht mehr verfügbar.",
    action: "Zurück zum Dashboard",
  },
} as const

type Locale = keyof typeof copy

function resolveLocale(value: string | null): Locale {
  return value === "de" || value === "es" || value === "en" ? value : "en"
}

export default async function NotFound() {
  const requestHeaders = await headers()
  const locale = resolveLocale(requestHeaders.get("x-site-locale"))
  const text = copy[locale]

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-xl border-t border-border pt-8">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">404 · {text.eyebrow}</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">{text.title}</h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">{text.description}</p>
        <Link
          href={`/${locale}`}
          className="mt-8 inline-flex min-h-10 items-center justify-center bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {text.action}
        </Link>
      </div>
    </main>
  )
}

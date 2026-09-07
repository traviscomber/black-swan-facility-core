"use client"

import Link from "next/link"
import { ArrowRight, Boxes, PackageOpen, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { useLanguage } from "@/lib/hooks/use-language"

const copy = {
  en: {
    eyebrow: "Seeds & transplants",
    title: "Start with what the plan needs",
    description: "Keep purchasing, stock and nursery execution separate. The season plan defines demand first; inventory is consolidated afterwards.",
    planTitle: "1. Required by the plan",
    planBody: "See gross seed, gram and seed-tuber requirements for the reconciled plantings before deducting stock.",
    planAction: "Open purchase requirement",
    stockTitle: "2. Physical stock & lots",
    stockBody: "Add what is physically on hand in seconds. Crop first; count and unit when known. Lot, supplier and storage details can be completed later.",
    stockAction: "Add or count stock",
    nurseryTitle: "3. Nursery & transplant readiness",
    nurseryBody: "Follow started batches, hardening and what is actually ready to move to the field.",
    nurseryAction: "Open nursery",
    advanced: "Advanced seed & nursery management",
    rule: "Order of work",
    ruleBody: "Plan requirement → available stock → purchase gap → nursery execution. These are different states and are not mixed into one number.",
  },
  es: {
    eyebrow: "Semillas y trasplantes",
    title: "Parte por lo que exige el plan",
    description: "Separamos compra, stock y ejecución de almácigos. Primero el plan define la demanda; después consolidamos contra inventario.",
    planTitle: "1. Requerido por el plan",
    planBody: "Ve el requerimiento bruto de semillas, gramos y tubérculos para las plantaciones reconciliadas antes de descontar stock.",
    planAction: "Abrir requerimiento de compra",
    stockTitle: "2. Stock físico y lotes",
    stockBody: "Agrega lo que existe físicamente en segundos. Primero el cultivo; conteo y unidad cuando los conozcas. Lote, proveedor y ubicación se pueden completar después.",
    stockAction: "Agregar o contar stock",
    nurseryTitle: "3. Almácigos y trasplante",
    nurseryBody: "Sigue lotes iniciados, endurecimiento y lo que realmente está listo para pasar al campo.",
    nurseryAction: "Abrir vivero",
    advanced: "Gestión avanzada de semillas y almácigos",
    rule: "Orden de trabajo",
    ruleBody: "Requerimiento del plan → stock disponible → déficit de compra → ejecución en almácigo. Son estados distintos y no se mezclan en un solo número.",
  },
  de: {
    eyebrow: "Saatgut & Jungpflanzen",
    title: "Beginne mit dem Bedarf des Plans",
    description: "Einkauf, Bestand und Anzucht bleiben getrennt. Zuerst definiert der Saisonplan den Bedarf; danach wird der Bestand gegengerechnet.",
    planTitle: "1. Bedarf laut Plan",
    planBody: "Bruttobedarf an Saatgut, Gramm und Pflanzkartoffeln für abgeglichene Pflanzungen vor Bestandsabzug.",
    planAction: "Einkaufsbedarf öffnen",
    stockTitle: "2. Physischer Bestand & Partien",
    stockBody: "Tatsächlichen Bestand in Sekunden erfassen. Zuerst Kultur; Menge und Einheit, sobald bekannt. Partie, Lieferant und Lagerort können später ergänzt werden.",
    stockAction: "Bestand hinzufügen oder zählen",
    nurseryTitle: "3. Anzucht & Pflanzbereitschaft",
    nurseryBody: "Gestartete Chargen, Abhärtung und tatsächlich pflanzbereite Jungpflanzen verfolgen.",
    nurseryAction: "Anzucht öffnen",
    advanced: "Erweiterte Saatgut- & Anzuchtverwaltung",
    rule: "Arbeitsreihenfolge",
    ruleBody: "Planbedarf → verfügbarer Bestand → Einkaufslücke → Anzuchtausführung. Diese Zustände werden nicht zu einer Zahl vermischt.",
  },
} as const

export default function OrchardSeedsHubPage() {
  const { language } = useLanguage()
  const text = copy[language]
  const query = typeof window !== "undefined" ? window.location.search : ""
  const href = (path: string) => `/${language}${path}${query}`

  const steps = [
    { icon: PackageOpen, title: text.planTitle, body: text.planBody, action: text.planAction, href: href("/orchard/game-plan/propagation"), primary: true },
    { icon: Boxes, title: text.stockTitle, body: text.stockBody, action: text.stockAction, href: href("/orchard/nursery/quick-stock"), primary: false },
    { icon: Sprout, title: text.nurseryTitle, body: text.nurseryBody, action: text.nurseryAction, href: href("/orchard/nursery/overview"), primary: false },
  ]

  return <AppLayout><OrchardNavigation/><main className="min-h-full bg-[var(--orchard-canvas)] px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-5xl">
      <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--orchard-green)]">{text.eyebrow}</p>
      <h1 className="mt-2 max-w-3xl text-3xl font-medium tracking-[-.035em] text-foreground sm:text-4xl">{text.title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{text.description}</p>

      <div className="mt-8 grid gap-3">
        {steps.map(({icon:Icon,title,body,action,href,primary}) => <Link key={title} href={href} className={`group grid gap-4 border border-[var(--orchard-line)] p-5 transition-colors sm:grid-cols-[44px_1fr_auto] sm:items-center ${primary ? "bg-[var(--bs-surface-secondary)] hover:border-[var(--orchard-green)]" : "bg-[var(--bs-surface-primary)] hover:bg-[var(--bs-surface-secondary)]"}`}>
          <span className={`flex h-11 w-11 items-center justify-center ${primary ? "bg-[var(--orchard-green-soft)] text-[var(--orchard-green)]" : "bg-[var(--bs-bg-secondary)] text-muted-foreground"}`}><Icon className="h-5 w-5"/></span>
          <div><h2 className="text-lg font-medium text-foreground">{title}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{body}</p></div>
          <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--orchard-green)]">{action}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5"/></span>
        </Link>)}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[var(--orchard-line)] pt-5"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">{text.rule}</p><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{text.ruleBody}</p></div><Link href={href("/orchard/nursery/advanced")} className="inline-flex items-center gap-2 text-sm font-medium text-[var(--orchard-green)]">{text.advanced}<ArrowRight className="h-4 w-4"/></Link></div>
    </div>
  </main></AppLayout>
}

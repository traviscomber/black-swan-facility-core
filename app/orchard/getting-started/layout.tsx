"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import { MapPinned, MoveRight } from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"

const copy={
 en:{title:"One shared farm, your active Game Plan",body:"Black Swan Orchard uses the farm's shared physical plots and beds. You do not need to create a second Orchard. Create your planting here; when a crop is already placed and needs another bed, use Edit placements.",edit:"Edit existing placements"},
 es:{title:"Un huerto compartido, tu Plan de Cultivo activo",body:"Black Swan Orchard usa los sectores y camas físicas compartidas del fundo. No necesitas crear un segundo Orchard. Crea aquí tu plantación; si un cultivo ya está ubicado y debe cambiar de cama, usa Editar ubicaciones.",edit:"Editar ubicaciones existentes"},
 de:{title:"Eine gemeinsame Farm, dein aktiver Anbauplan",body:"Black Swan Orchard verwendet die gemeinsamen physischen Flächen und Beete der Farm. Ein zweiter Orchard muss nicht angelegt werden. Lege hier die Pflanzung an; wenn eine bereits zugeordnete Kultur in ein anderes Beet soll, nutze Zuordnungen bearbeiten.",edit:"Bestehende Zuordnungen bearbeiten"}
} as const

export default function GettingStartedParityLayout({ children }: { children: ReactNode }) {
 const{language}=useLanguage();const text=copy[language];const searchParams=useSearchParams();const gamePlan=searchParams.get("game_plan");const editHref=`/${language}/orchard/crop-map${gamePlan?`?game_plan=${encodeURIComponent(gamePlan)}`:""}`
 return <div data-heirloom-getting-started-parity="true" className="contents">
    <style>{`
      @media (min-width: 1024px) {
        [data-heirloom-getting-started-parity="true"] main > main {
          display: grid !important;
          grid-template-columns: minmax(0, 1.05fr) minmax(320px, .95fr) !important;
          gap: 0 !important;
          max-width: 1040px !important;
          padding-top: 16px !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > header {
          grid-column: 1 !important;
          grid-row: 1 !important;
          display: flex !important;
          min-height: 292px !important;
          flex-direction: column !important;
          justify-content: center !important;
          align-items: stretch !important;
          padding: 34px 38px !important;
          border: 1px solid var(--orchard-line) !important;
          border-right: 0 !important;
          border-radius: 14px 0 0 14px !important;
          background: #11110f !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > header > div p:first-child {
          display: none !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > header h1 {
          margin-top: 0 !important;
          max-width: 420px !important;
          font-size: 30px !important;
          line-height: 1.15 !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > header > div > p:last-child {
          max-width: 440px !important;
          margin-top: 12px !important;
          font-size: 14px !important;
          line-height: 1.7 !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > header label {
          max-width: 260px !important;
          margin-top: 28px !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > header select {
          border-radius: 6px !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > section:first-of-type {
          grid-column: 2 !important;
          grid-row: 1 !important;
          min-height: 292px !important;
          margin: 0 !important;
          padding: 36px !important;
          flex-direction: column !important;
          align-items: stretch !important;
          justify-content: center !important;
          gap: 26px !important;
          border: 1px solid var(--orchard-line) !important;
          border-radius: 0 14px 14px 0 !important;
          background: var(--bs-surface-primary) !important;
          color: var(--bs-text-primary) !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > section:first-of-type > div:first-child p:first-child {
          color: var(--bs-text-muted) !important;
          font-size: 10px !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > section:first-of-type > div:first-child p:last-child {
          font-size: 64px !important;
          line-height: 1 !important;
          color: var(--orchard-green) !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > section:first-of-type > div:last-child {
          min-width: 0 !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > section:first-of-type > div:last-child > div:first-child {
          color: var(--bs-text-secondary) !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > section:first-of-type > div:last-child > div:last-child {
          height: 6px !important;
          background: var(--bs-surface-secondary) !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > section:nth-of-type(2),
        [data-heirloom-getting-started-parity="true"] main > main > details {
          grid-column: 1 / -1 !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > section:nth-of-type(2) {
          margin-top: 26px !important;
          gap: 10px !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > section:nth-of-type(2) > a {
          min-height: 92px !important;
          padding: 18px 20px !important;
          border-radius: 7px !important;
        }

        [data-heirloom-getting-started-parity="true"] main > main > details {
          margin-top: 22px !important;
        }
      }
    `}</style>
    {children}
    <aside data-orchard-onboarding-placement-guide className="fixed bottom-3 left-3 z-[44] max-w-[min(520px,calc(100vw-6rem))] border border-white/15 bg-[#171715]/95 p-3 text-[#e8e5dc] shadow-xl backdrop-blur sm:bottom-5 sm:left-5 sm:p-4">
      <div className="flex gap-3"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border border-[#79c5aa]/35 bg-[#24342d] text-[#9fd6bd]"><MapPinned className="h-4 w-4"/></div><div className="min-w-0"><p className="text-sm font-semibold">{text.title}</p><p className="mt-1 text-xs leading-5 text-[#aaa69c]">{text.body}</p><Link href={editHref} className="mt-2 inline-flex min-h-11 items-center gap-2 border border-[#79c5aa]/50 bg-[#24342d] px-3 text-xs font-medium text-[#bfe9d7]"><MoveRight className="h-4 w-4"/>{text.edit}</Link></div></div>
    </aside>
  </div>
}

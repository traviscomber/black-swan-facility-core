"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

function internalPath(pathname: string) {
  return pathname.replace(/^\/(en|es|de)(?=\/|$)/, "") || "/"
}

export default function GamePlanLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/"
  const compactRoot = internalPath(pathname) === "/orchard/game-plan"

  return (
    <div data-game-plan-density={compactRoot ? "true" : undefined} className="contents">
      {compactRoot ? (
        <style>{`
          [data-game-plan-density="true"] [data-slot="page-header"][data-orchard-hero="true"] > div.relative.z-10 {
            min-height: 112px !important;
            gap: 12px !important;
            padding-top: 12px !important;
            padding-bottom: 12px !important;
          }

          [data-game-plan-density="true"] [data-slot="page-header"][data-orchard-hero="true"] h1 {
            font-size: 1.75rem !important;
            line-height: 1.05 !important;
          }

          [data-game-plan-density="true"] [data-slot="page-header"][data-orchard-hero="true"] > div.relative.z-10 > div:first-child > div:last-child {
            display: none !important;
          }

          [data-game-plan-density="true"] [data-slot="page-header"] + div {
            margin-inline: auto;
            max-width: 1560px;
            padding: 12px 20px 28px !important;
          }

          [data-game-plan-density="true"] [data-slot="page-header"] + div > section:first-of-type {
            background: var(--card) !important;
            color: var(--foreground) !important;
            border-color: var(--border) !important;
          }

          [data-game-plan-density="true"] [data-slot="page-header"] + div > section:first-of-type > img,
          [data-game-plan-density="true"] [data-slot="page-header"] + div > section:first-of-type > div.absolute {
            display: none !important;
          }

          [data-game-plan-density="true"] [data-slot="page-header"] + div > section:first-of-type > div.relative.grid {
            gap: 14px !important;
            padding: 12px 16px !important;
          }

          [data-game-plan-density="true"] [data-slot="page-header"] + div > section:first-of-type h2 {
            margin-top: 4px !important;
            color: var(--foreground) !important;
            font-size: 1.25rem !important;
            line-height: 1.2 !important;
            letter-spacing: -0.02em !important;
          }

          [data-game-plan-density="true"] [data-slot="page-header"] + div > section:first-of-type p {
            color: var(--muted-foreground) !important;
          }

          [data-game-plan-density="true"] [data-slot="page-header"] + div > section:first-of-type p.mt-6 {
            margin-top: 8px !important;
          }

          [data-game-plan-density="true"] [data-slot="page-header"] + div > section:first-of-type p.mt-4 {
            margin-top: 4px !important;
            line-height: 1.4 !important;
          }

          [data-game-plan-density="true"] [data-slot="page-header"] + div > section:first-of-type div.mt-6 {
            margin-top: 8px !important;
            color: var(--muted-foreground) !important;
          }

          [data-game-plan-density="true"] [data-slot="page-header"] + div > section:first-of-type > div.relative.grid > div:last-child {
            gap: 8px !important;
          }

          [data-game-plan-density="true"] [data-slot="page-header"] + div > section:first-of-type > div.relative.grid > div:last-child > div {
            border-color: var(--border) !important;
            background: var(--muted) !important;
            padding: 8px 10px !important;
          }

          [data-game-plan-density="true"] [data-slot="page-header"] + div > section:first-of-type > div.relative.grid > div:last-child > div > div {
            color: var(--muted-foreground) !important;
            font-size: 10px !important;
          }

          [data-game-plan-density="true"] [data-slot="page-header"] + div > section:first-of-type > div.relative.grid > div:last-child > div > p {
            margin-top: 2px !important;
            color: var(--foreground) !important;
            font-size: 1rem !important;
            line-height: 1.25 !important;
          }

          [data-game-plan-density="true"] [data-slot="card"] {
            gap: 14px !important;
            padding-top: 14px !important;
            padding-bottom: 14px !important;
          }

          [data-game-plan-density="true"] [data-slot="card-header"],
          [data-game-plan-density="true"] [data-slot="card-content"] {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          [data-game-plan-density="true"] .space-y-6 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 16px !important;
          }

          @media (min-width: 1024px) {
            [data-game-plan-density="true"] [data-slot="page-header"] + div > section:first-of-type > div.relative.grid {
              grid-template-columns: minmax(0, 1fr) minmax(420px, 0.72fr) !important;
              align-items: center !important;
            }

            [data-game-plan-density="true"] [data-slot="page-header"] + div > section:first-of-type > div.relative.grid > div:last-child {
              grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            }
          }

          @media (min-width: 1280px) {
            [data-game-plan-density="true"] [data-slot="page-header"] + div > div.grid {
              grid-template-columns: 236px minmax(0, 1fr) !important;
              gap: 16px !important;
            }
          }
        `}</style>
      ) : null}
      {children}
    </div>
  )
}

import type { ReactNode } from "react"

const DECISION_VISUAL_CSS = `
body:has([data-orchard-decisions-compact]) main section[class*="min-h-"][class*="overflow-hidden"] {
  min-height:0!important;
  background:transparent!important;
  border-top:1px solid var(--orchard-line)!important;
  border-bottom:1px solid var(--orchard-line)!important;
}
body:has([data-orchard-decisions-compact]) main section[class*="min-h-"][class*="overflow-hidden"] > img[class*="absolute"][class*="inset-0"],
body:has([data-orchard-decisions-compact]) main section[class*="min-h-"][class*="overflow-hidden"] > div[class*="absolute"][class*="inset-0"] {
  display:none!important;
}
body:has([data-orchard-decisions-compact]) main section[class*="min-h-"][class*="overflow-hidden"] > div[class*="relative"][class*="min-h-"] {
  min-height:0!important;
  max-width:none!important;
  padding:22px 0!important;
  color:var(--orchard-ink)!important;
}
body:has([data-orchard-decisions-compact]) main section[class*="min-h-"][class*="overflow-hidden"] [class*="text-white"] {
  color:var(--orchard-ink)!important;
}
body:has([data-orchard-decisions-compact]) main section[class*="xl:grid-cols-5"] {
  gap:1px!important;
  background:var(--orchard-line)!important;
}
body:has([data-orchard-decisions-compact]) main section[class*="xl:grid-cols-5"] > [data-slot="card"] {
  border:0!important;
  border-radius:0!important;
}
body:has([data-orchard-decisions-compact]) main article[class*="overflow-hidden"][class*="border"][class*="bg-background"] {
  background:var(--bs-surface-primary)!important;
  border-color:var(--orchard-line)!important;
  border-radius:0!important;
}
body:has([data-orchard-decisions-compact]) main article[class*="overflow-hidden"][class*="border"][class*="bg-background"] > div[class*="relative"][class*="h-36"] {
  height:auto!important;
  overflow:visible!important;
  padding:16px 16px 0!important;
  background:transparent!important;
}
body:has([data-orchard-decisions-compact]) main article[class*="overflow-hidden"][class*="border"][class*="bg-background"] > div[class*="relative"][class*="h-36"] > img,
body:has([data-orchard-decisions-compact]) main article[class*="overflow-hidden"][class*="border"][class*="bg-background"] > div[class*="relative"][class*="h-36"] > div[class*="absolute"][class*="inset-0"] {
  display:none!important;
}
body:has([data-orchard-decisions-compact]) main article[class*="overflow-hidden"][class*="border"][class*="bg-background"] > div[class*="relative"][class*="h-36"] > div[class*="absolute"][class*="inset-x-4"] {
  position:static!important;
  inset:auto!important;
}
body:has([data-orchard-decisions-compact]) main article[class*="overflow-hidden"][class*="border"][class*="bg-background"] h3[class*="text-white"] {
  color:var(--orchard-ink)!important;
}
body:has([data-orchard-decisions-compact]) main article[class*="overflow-hidden"][class*="border"][class*="bg-background"] [data-slot="badge"] {
  box-shadow:none!important;
}
`

export default function OrchardDecisionsLayout({children}:{children:ReactNode}){
  return <>
    <style>{DECISION_VISUAL_CSS}</style>
    <span data-orchard-decisions-compact hidden aria-hidden="true" />
    {children}
  </>
}

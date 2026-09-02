"use client"

import { usePathname } from "next/navigation"
import { OrchardAiDock } from "@/components/orchard/orchard-ai-dock"

const ORCHARD_BRAND_CSS = `
body:has([data-orchard-navigation]) {
  --orchard-nav-height: 0px;
  --orchard-green: #1f624d;
  --orchard-green-soft: #e7f0eb;
  --orchard-ink: #2f332f;
  --orchard-muted: #727872;
  --orchard-line: #dfe4df;
  --orchard-canvas: #f7f8f6;
  --orchard-radius: 12px;
  --orchard-radius-sm: 9px;
  --bs-bg-primary: var(--orchard-canvas);
  --bs-surface-primary: #ffffff;
  --bs-surface-secondary: #f1f4f1;
  --bs-surface-tertiary: #e7ece8;
  --bs-text-primary: var(--orchard-ink);
  --bs-text-secondary: var(--orchard-muted);
  --bs-divider-subtle: var(--orchard-line);
  --bs-cool-sage: var(--orchard-green);
  background: var(--orchard-canvas);
  color: var(--orchard-ink);
}
body:has([data-orchard-navigation]) main {
  background: var(--orchard-canvas);
  color: var(--orchard-ink);
  font-family: var(--bs-font-body);
}
body:has([data-orchard-navigation]) main h1,
body:has([data-orchard-navigation]) main h2,
body:has([data-orchard-navigation]) main h3,
body:has([data-orchard-navigation]) main h4,
body:has([data-orchard-navigation]) main h5,
body:has([data-orchard-navigation]) main h6 {
  font-family: var(--bs-font-heading) !important;
  font-weight: 500 !important;
  color: var(--orchard-ink) !important;
}
body:has([data-orchard-navigation]) main h1 { font-size:clamp(28px,2.5vw,42px)!important; line-height:1.08!important; letter-spacing:-.035em!important; }
body:has([data-orchard-navigation]) main h2 { font-size:clamp(22px,2vw,32px)!important; letter-spacing:-.025em!important; }
body:has([data-orchard-navigation]) main [data-slot="card"],
body:has([data-orchard-navigation]) [data-slot="dialog-content"] {
  background: #fff !important;
  border: 1px solid var(--orchard-line) !important;
  border-radius: var(--orchard-radius) !important;
  box-shadow: 0 2px 5px rgba(39,55,45,.06) !important;
  overflow: hidden;
}
body:has([data-orchard-navigation]) main button,
body:has([data-orchard-navigation]) main [role="button"],
body:has([data-orchard-navigation]) main [data-slot="button"] { min-height:40px; border-radius:8px!important; box-shadow:none!important; }
body:has([data-orchard-navigation]) main input,
body:has([data-orchard-navigation]) main textarea,
body:has([data-orchard-navigation]) main select,
body:has([data-orchard-navigation]) main [data-slot="input"],
body:has([data-orchard-navigation]) main [data-slot="textarea"],
body:has([data-orchard-navigation]) main [data-slot="select-trigger"] {
  min-height:40px;
  background:#fff!important;
  color:var(--orchard-ink)!important;
  border:1px solid #ccd3cd!important;
  border-radius:var(--orchard-radius-sm)!important;
  box-shadow:none!important;
}
body:has([data-orchard-navigation]) main table { border-collapse:separate; border-spacing:0; background:#fff; border:1px solid var(--orchard-line); border-radius:10px; overflow:hidden; }
body:has([data-orchard-navigation]) main th { color:#626862!important; font-weight:500; background:#f4f6f3; }
body:has([data-orchard-navigation]) main td { color:var(--orchard-ink); border-color:#edf0ed!important; }
body:has([data-orchard-navigation]) main .text-muted-foreground,
body:has([data-orchard-navigation]) main [data-slot="card-description"] { color:var(--orchard-muted)!important; }
body:has([data-orchard-navigation]) main :focus-visible { outline:2px solid var(--orchard-green)!important; outline-offset:2px; }
body:has([data-orchard-navigation]) main [class*="border-dashed"] { border-color:#cdd4cd!important; }
body:has([data-orchard-navigation]) main [class*="bg-card"] { background-color:#fff!important; }
body:has([data-orchard-navigation]) main [class*="transition"] { transition-duration:180ms; }
@media (hover:hover) {
  body:has([data-orchard-navigation]) main [data-slot="card"]:hover { border-color:#b8cabe!important; box-shadow:0 5px 16px rgba(39,55,45,.08)!important; }
}
@media (max-width:639px) {
  body:has([data-orchard-navigation]) { --orchard-radius:12px; --orchard-radius-sm:9px; }
}
`

function internalPath(pathname:string){return pathname.replace(/^\/(en|es|de)(?=\/|$)/,"")||"/"}

export function OrchardNavigation(){
  const pathname=internalPath(usePathname()||"/")
  return <>
    <style>{ORCHARD_BRAND_CSS}</style>
    <span data-orchard-navigation hidden aria-hidden="true" />
    <OrchardAiDock hidden={pathname==="/orchard/assistant"}/>
  </>
}

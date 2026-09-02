"use client"

import { usePathname } from "next/navigation"
import { OrchardAiDock } from "@/components/orchard/orchard-ai-dock"
import { legacyCropIdentityCss } from "@/lib/orchard/crop-identity"

const ORCHARD_BRAND_CSS = `
body:has([data-orchard-navigation]) {
  color-scheme: dark;
  --orchard-nav-height: 0px;
  --orchard-green: #8bcba8;
  --orchard-green-soft: rgba(139,203,168,.14);
  --orchard-ink: #e7e1d8;
  --orchard-muted: #b9b0a4;
  --orchard-line: rgba(231,225,216,.12);
  --orchard-canvas: #171512;
  --orchard-radius: 12px;
  --orchard-radius-sm: 9px;
  --bs-bg-primary: var(--orchard-canvas);
  --bs-bg-secondary: #211e1a;
  --bs-surface-primary: #2b2722;
  --bs-surface-secondary: #39342d;
  --bs-surface-tertiary: #514a40;
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
  background: var(--bs-surface-primary) !important;
  color: var(--orchard-ink) !important;
  border: 1px solid var(--orchard-line) !important;
  border-radius: var(--orchard-radius) !important;
  box-shadow: none !important;
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
  background:var(--bs-surface-secondary)!important;
  color:var(--orchard-ink)!important;
  border:1px solid rgba(231,225,216,.18)!important;
  border-radius:var(--orchard-radius-sm)!important;
  box-shadow:none!important;
}
body:has([data-orchard-navigation]) main input::placeholder,
body:has([data-orchard-navigation]) main textarea::placeholder { color:#9f968b!important; opacity:1; }
body:has([data-orchard-navigation]) main table { border-collapse:separate; border-spacing:0; background:var(--bs-surface-primary); border:1px solid var(--orchard-line); border-radius:10px; overflow:hidden; }
body:has([data-orchard-navigation]) main th { color:#c6bdb2!important; font-weight:500; background:var(--bs-bg-secondary); }
body:has([data-orchard-navigation]) main td { color:var(--orchard-ink); border-color:var(--orchard-line)!important; }
body:has([data-orchard-navigation]) main .text-muted-foreground,
body:has([data-orchard-navigation]) main [data-slot="card-description"] { color:var(--orchard-muted)!important; }
body:has([data-orchard-navigation]) main :focus-visible { outline:2px solid var(--orchard-green)!important; outline-offset:2px; }
body:has([data-orchard-navigation]) main [class*="border-dashed"] { border-color:rgba(231,225,216,.18)!important; }
body:has([data-orchard-navigation]) main [class*="bg-card"] { background-color:var(--bs-surface-primary)!important; }
body:has([data-orchard-navigation]) main [class*="bg-white"] { background-color:var(--bs-surface-primary)!important; }
body:has([data-orchard-navigation]) main [class*="text-black"] { color:var(--orchard-ink)!important; }
body:has([data-orchard-navigation]) main [class*="transition"] { transition-duration:180ms; }
@media (hover:hover) {
  body:has([data-orchard-navigation]) main [data-slot="card"]:hover { border-color:rgba(139,203,168,.32)!important; box-shadow:none!important; }
}
@media (max-width:639px) {
  body:has([data-orchard-navigation]) { --orchard-radius:12px; --orchard-radius-sm:9px; }
}
`

function internalPath(pathname:string){return pathname.replace(/^\/(en|es|de)(?=\/|$)/,"")||"/"}

export function OrchardNavigation(){
  const pathname=internalPath(usePathname()||"/")
  return <>
    <style>{`${ORCHARD_BRAND_CSS}\n${legacyCropIdentityCss}`}</style>
    <span data-orchard-navigation hidden aria-hidden="true" />
    <OrchardAiDock hidden={pathname==="/orchard/assistant"}/>
  </>
}
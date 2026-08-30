import type { ReactNode } from "react"

export default function OrchardLibraryLayout({children}:{children:ReactNode}){
  return <>
    <link rel="preconnect" href="https://ruslvodmzqctkaafnpfx.supabase.co" crossOrigin="anonymous"/>
    <link rel="dns-prefetch" href="https://ruslvodmzqctkaafnpfx.supabase.co"/>
    <div className="[&_.group]:[content-visibility:auto] [&_.group]:[contain-intrinsic-size:420px]">{children}</div>
  </>
}

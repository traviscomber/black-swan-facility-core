import type React from "react"
import { OrchardVisualTruthPolicy } from "@/components/orchard/orchard-visual-truth-policy"

export default function OrchardLayout({ children }: { children: React.ReactNode }) {
  return <div data-orchard-image-policy className="contents">
    <OrchardVisualTruthPolicy />
    {children}
  </div>
}

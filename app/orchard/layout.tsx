import type React from "react"

const IMAGE_POLICY_CSS = `
[data-orchard-image-policy] img[src*="images.unsplash.com"],
[data-orchard-image-policy] img[src*="source.unsplash.com"],
[data-orchard-image-policy] img[src*="images.pexels.com"],
[data-orchard-image-policy] img[src*="pixabay.com"] {
  display: none !important;
}
`

export default function OrchardLayout({ children }: { children: React.ReactNode }) {
  return <div data-orchard-image-policy className="contents">
    <style>{IMAGE_POLICY_CSS}</style>
    {children}
  </div>
}

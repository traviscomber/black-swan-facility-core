import type { ReactNode } from "react"
import "./catalog-compact.css"

export default function OrchardCropCatalogLayout({children}:{children:ReactNode}){
  return <div data-orchard-crop-catalog-layout>{children}</div>
}

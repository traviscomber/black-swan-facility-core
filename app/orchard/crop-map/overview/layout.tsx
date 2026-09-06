import type { ReactNode } from "react"
import { CropMapQuickAssign } from "./quick-assign"

export default function CropMapOverviewLayout({ children }: { children: ReactNode }) {
  return <div data-heirloom-crop-map-parity="true" className="contents">
    <style>{`
      @media (min-width: 1024px) {
        [data-heirloom-crop-map-parity="true"] main > main {
          height: calc(100dvh - var(--orchard-nav-height, 0px)) !important;
          min-height: 0 !important;
          overflow: hidden !important;
          background: #1b1b19 !important;
        }

        [data-heirloom-crop-map-parity="true"] main > main > header {
          display: none !important;
        }

        [data-heirloom-crop-map-parity="true"] main > main > section:first-of-type {
          min-height: 46px !important;
          padding: 7px 14px !important;
          border-bottom-color: #302f2b !important;
          background: #151513 !important;
        }

        [data-heirloom-crop-map-parity="true"] main > main > section:first-of-type > div {
          grid-template-columns: 112px minmax(0, 1fr) 112px !important;
          gap: 12px !important;
        }

        [data-heirloom-crop-map-parity="true"] main > main > section:first-of-type p:first-child {
          font-size: 8px !important;
          letter-spacing: .12em !important;
        }

        [data-heirloom-crop-map-parity="true"] main > main > section:first-of-type p:last-child {
          margin-top: 1px !important;
          font-size: 10px !important;
        }

        [data-heirloom-crop-map-parity="true"] main > main > section:first-of-type input[type="range"] {
          height: 2px !important;
        }

        [data-heirloom-crop-map-parity="true"] main > main > section:first-of-type span {
          padding: 1px 6px !important;
          font-size: 9px !important;
        }

        [data-heirloom-crop-map-parity="true"] main > main > div.flex.min-h-0.flex-1 {
          min-height: 0 !important;
          background: #20211e !important;
        }

        [data-heirloom-crop-map-parity="true"] main > main > div.flex.min-h-0.flex-1 > section {
          padding: 8px !important;
          background: #20211e !important;
        }

        [data-heirloom-crop-map-parity="true"] main > main > div.flex.min-h-0.flex-1 > section > div.w-max {
          min-height: calc(100dvh - 122px) !important;
          padding: 7px !important;
          gap: 5px !important;
          border-color: #4b4b46 !important;
          background: #171815 !important;
        }

        [data-heirloom-crop-map-parity="true"] main > main > div.flex.min-h-0.flex-1 > aside {
          width: 264px !important;
          border-left-color: #302f2b !important;
          background: #141412 !important;
        }

        [data-heirloom-crop-map-parity="true"] main > main > div.flex.min-h-0.flex-1 > aside > div:first-child {
          padding: 14px !important;
        }

        [data-heirloom-crop-map-parity="true"] main > main > div.flex.min-h-0.flex-1 > aside h2 {
          font-size: 22px !important;
          line-height: 1.15 !important;
        }

        [data-heirloom-crop-map-parity="true"] main > main > div.flex.min-h-0.flex-1 > aside p {
          font-size: 10px !important;
          line-height: 1.45 !important;
        }

        [data-heirloom-crop-map-parity="true"] main > main > div.flex.min-h-0.flex-1 > aside input[type="text"] {
          min-height: 36px !important;
          border-radius: 5px !important;
          background: #1b1b18 !important;
        }
      }
    `}</style>
    {children}
    <CropMapQuickAssign />
  </div>
}

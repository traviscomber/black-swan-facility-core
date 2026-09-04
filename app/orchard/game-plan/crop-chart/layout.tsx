import type { ReactNode } from "react"

const CROP_CHART_VISUAL_CSS = `
body:has([data-orchard-crop-chart-layout]) main {
  max-width: 1600px;
}
body:has([data-orchard-crop-chart-layout]) main > header {
  margin-bottom: 22px;
}
body:has([data-orchard-crop-chart-layout]) main > header p:last-child {
  max-width: 860px;
}
body:has([data-orchard-crop-chart-layout]) main table {
  min-width: 1320px !important;
  border-radius: 0 !important;
}
body:has([data-orchard-crop-chart-layout]) main div:has(> table) {
  max-height: min(68vh, 760px);
  overflow: auto !important;
  border: 1px solid var(--orchard-line);
  background: var(--bs-surface-primary);
  scrollbar-gutter: stable;
}
body:has([data-orchard-crop-chart-layout]) main div:has(> table) > table {
  border: 0 !important;
}
body:has([data-orchard-crop-chart-layout]) main thead {
  position: sticky;
  top: 0;
  z-index: 20;
}
body:has([data-orchard-crop-chart-layout]) main th {
  padding-top: 10px !important;
  padding-bottom: 10px !important;
  white-space: nowrap;
  border-bottom: 1px solid var(--orchard-line) !important;
}
body:has([data-orchard-crop-chart-layout]) main td {
  padding-top: 10px !important;
  padding-bottom: 10px !important;
}
body:has([data-orchard-crop-chart-layout]) main th:first-child,
body:has([data-orchard-crop-chart-layout]) main td:first-child {
  position: sticky;
  left: 0;
  min-width: 230px;
}
body:has([data-orchard-crop-chart-layout]) main th:first-child {
  z-index: 30;
  background: var(--bs-bg-secondary) !important;
}
body:has([data-orchard-crop-chart-layout]) main td:first-child {
  z-index: 10;
  background: var(--bs-surface-primary) !important;
  box-shadow: 1px 0 0 var(--orchard-line);
}
body:has([data-orchard-crop-chart-layout]) main tbody tr:hover td {
  background-color: rgba(231, 225, 216, .035);
}
body:has([data-orchard-crop-chart-layout]) main tbody tr:hover td:first-child {
  background-color: #302b25 !important;
}
body:has([data-orchard-crop-chart-layout]) main section[class*="grid"] > div {
  min-height: 88px;
}
@media (max-width: 767px) {
  body:has([data-orchard-crop-chart-layout]) main {
    padding-top: 22px !important;
  }
  body:has([data-orchard-crop-chart-layout]) main div:has(> table) {
    max-height: 64vh;
  }
  body:has([data-orchard-crop-chart-layout]) main th:first-child,
  body:has([data-orchard-crop-chart-layout]) main td:first-child {
    min-width: 190px;
  }
}
`

export default function CropChartLayout({ children }: { children: ReactNode }) {
  return <>
    <style>{CROP_CHART_VISUAL_CSS}</style>
    <span data-orchard-crop-chart-layout hidden aria-hidden="true" />
    {children}
  </>
}

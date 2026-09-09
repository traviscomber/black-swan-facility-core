"use client"

const ORCHARD_MOBILE_SHELL_CSS = `
@media (max-width: 767px) {
  body:has([data-orchard-navigation]) main button,
  body:has([data-orchard-navigation]) main [role="button"],
  body:has([data-orchard-navigation]) main [data-slot="button"],
  body:has([data-orchard-navigation]) main details > summary {
    min-height: 44px;
  }

  body:has([data-orchard-navigation]) main input:not([type="checkbox"]):not([type="radio"]),
  body:has([data-orchard-navigation]) main textarea,
  body:has([data-orchard-navigation]) main select,
  body:has([data-orchard-navigation]) main [data-slot="input"],
  body:has([data-orchard-navigation]) main [data-slot="textarea"],
  body:has([data-orchard-navigation]) main [data-slot="select-trigger"] {
    min-height: 44px;
    font-size: 16px !important;
  }

  body:has([data-orchard-navigation]) main [role="tablist"] {
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  body:has([data-orchard-navigation]) main [role="tablist"]::-webkit-scrollbar {
    display: none;
  }

  body:has([data-orchard-navigation]) main [role="tab"] {
    min-height: 44px;
    flex: 0 0 auto;
    white-space: nowrap;
  }

  body:has([data-orchard-navigation]) main [data-slot="table-container"],
  body:has([data-orchard-navigation]) main .overflow-x-auto {
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
  }

  body:has([data-orchard-navigation]) main [data-slot="card"] {
    min-width: 0;
  }

  body:has([data-orchard-navigation]) main [data-slot="card-header"],
  body:has([data-orchard-navigation]) main [data-slot="card-content"],
  body:has([data-orchard-navigation]) main [data-slot="card-footer"] {
    padding-left: 1rem !important;
    padding-right: 1rem !important;
  }

  body:has([data-orchard-navigation]) [data-slot="dialog-content"] {
    max-height: calc(100dvh - 1rem);
    max-width: calc(100vw - 1rem);
    overflow-y: auto;
    overscroll-behavior-y: contain;
  }

  body:has([data-orchard-navigation]) main [class*="grid"] > *,
  body:has([data-orchard-navigation]) main [class*="flex"] > * {
    min-width: 0;
  }

  body:has([data-orchard-navigation]) main [data-slot="card-description"],
  body:has([data-orchard-navigation]) main p,
  body:has([data-orchard-navigation]) main td {
    overflow-wrap: anywhere;
  }
}
`

export function OrchardMobileShell() {
  return <style>{ORCHARD_MOBILE_SHELL_CSS}</style>
}

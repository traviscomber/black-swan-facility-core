"use client"

export default function OrchardChartsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-orchard-charts-layout>
      {children}
      <style jsx global>{`
        body:has([data-orchard-charts-layout]) div[class*="min-h-[280px]"] {
          min-height: 190px !important;
          padding-top: 1.25rem !important;
          padding-bottom: 1.25rem !important;
        }

        body:has([data-orchard-charts-layout]) div[class*="xl:grid-cols-[420px_1fr]"] {
          grid-template-columns: 360px minmax(0, 1fr) !important;
          gap: 1rem !important;
        }

        body:has([data-orchard-charts-layout]) form.space-y-4 > :not([hidden]) ~ :not([hidden]) {
          margin-top: 0.75rem !important;
        }

        body:has([data-orchard-charts-layout]) [class*="h-[520px]"] {
          height: 430px !important;
        }

        body:has([data-orchard-charts-layout]) [class*="h-[300px]"] {
          height: 260px !important;
        }

        @media (max-width: 1279px) {
          body:has([data-orchard-charts-layout]) div[class*="xl:grid-cols-[420px_1fr]"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

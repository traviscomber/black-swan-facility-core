"use client"

import { OrchardMobileShell } from "@/components/orchard/orchard-mobile-shell"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { OrchardPrioritySurface } from "@/components/orchard/orchard-priority-surface"
import { OrchardVisualTruthPolicy } from "@/components/orchard/orchard-visual-truth-policy"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

type PrioritySurface = "crop-map" | "work" | null

export function OrchardShellE2EHarness({ prioritySurface = null }: { prioritySurface?: PrioritySurface }) {
  return (
    <div data-orchard-image-policy>
      <OrchardNavigation />
      <OrchardMobileShell />
      <OrchardVisualTruthPolicy />
      {prioritySurface ? <OrchardPrioritySurface surfaceOverride={prioritySurface} qaMode /> : null}
      <span data-testid="e2e-hydrated" className="sr-only">ready</span>
      <main data-testid="orchard-mobile-shell-root" className="min-h-screen bg-background px-3 py-4 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-5xl space-y-5">
          <header className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">QA-ORCHARD-001</p>
            <h1>QA-SHELL-001</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">QA-RESPONSIVE-REFERENCE-001</p>
          </header>

          <figure data-testid="qa-stock-figure" className="min-h-32 overflow-hidden rounded-xl border bg-muted">
            <img
              data-testid="qa-stock-image"
              loading="lazy"
              src="https://images.unsplash.com/qa-stock-fixture.jpg"
              alt="QA stock fixture"
              className="h-32 w-full object-cover"
            />
          </figure>

          <div role="tablist" aria-label="QA-TABS" className="flex gap-2 rounded-xl border p-1">
            <Button role="tab" aria-selected="true" variant="secondary">QA-TAB-01</Button>
            <Button role="tab" aria-selected="false" variant="ghost">QA-TAB-02</Button>
            <Button role="tab" aria-selected="false" variant="ghost">QA-TAB-03</Button>
            <Button role="tab" aria-selected="false" variant="ghost">QA-TAB-04</Button>
          </div>

          {prioritySurface === "crop-map" ? (
            <div data-testid="qa-crop-map-grid" className="grid grid-cols-12 gap-4">
              <Card className="col-span-8">
                <CardHeader><CardTitle>QA-CROP-MAP-PRIMARY</CardTitle><CardDescription>QA-CROP-MAP-GRID-01</CardDescription></CardHeader>
                <CardContent><div className="overflow-x-auto"><div className="min-w-[760px] rounded-lg border p-4">QA-PLANNER-LANE-001</div></div></CardContent>
              </Card>
              <Card className="col-span-4">
                <CardHeader><CardTitle>QA-CROP-MAP-QUEUE</CardTitle><CardDescription>QA-CROP-MAP-GRID-02</CardDescription></CardHeader>
                <CardContent>QA-CROP-MAP-CONTENT</CardContent>
              </Card>
            </div>
          ) : null}

          {prioritySurface === "work" ? (
            <div data-testid="qa-work-week" className="grid gap-2 xl:grid-cols-7">
              {Array.from({ length: 7 }, (_, index) => <Card key={index}><CardContent className="p-3">QA-DAY-{index + 1}</CardContent></Card>)}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>QA-CARD-01</CardTitle>
                <CardDescription>QA-FORM-SURFACE-01</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input aria-label="QA-INPUT-01" defaultValue="QA-BED-04" />
                <Input aria-label="QA-INPUT-02" type="date" defaultValue="2026-09-09" />
                <Textarea aria-label="QA-INPUT-03" defaultValue="QA-NOTE-01" />
                <Button className="w-full sm:w-auto">QA-ACTION-01</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>QA-CARD-02</CardTitle>
                <CardDescription>QA-METRIC-SURFACE-01</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div><p className="text-muted-foreground">QA-M-01</p><p className="mt-1 text-2xl font-medium">8</p></div>
                <div><p className="text-muted-foreground">QA-M-02</p><p className="mt-1 text-2xl font-medium">3</p></div>
                <div><p className="text-muted-foreground">QA-M-03</p><p className="mt-1 text-2xl font-medium">145</p></div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>QA-CARD-03</CardTitle>
              <CardDescription>QA-TABLE-SURFACE-01</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>QA-COL-01</TableHead>
                    <TableHead>QA-COL-02</TableHead>
                    <TableHead>QA-COL-03</TableHead>
                    <TableHead>QA-COL-04</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>QA-TASK-01</TableCell>
                    <TableCell>QA-AREA-01</TableCell>
                    <TableCell>QA-OWNER-01</TableCell>
                    <TableCell>QA-STATE-01</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>QA-TASK-02</TableCell>
                    <TableCell>QA-AREA-02</TableCell>
                    <TableCell>QA-OWNER-02</TableCell>
                    <TableCell>QA-STATE-02</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div data-slot="dialog-content" className="mx-auto w-full max-w-lg border p-4">
            <h2 className="text-lg font-medium">QA-DIALOG-01</h2>
            <p className="mt-2 text-sm text-muted-foreground">QA-DIALOG-CONTENT-01</p>
          </div>
        </div>
      </main>
    </div>
  )
}

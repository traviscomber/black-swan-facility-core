import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { differenceInCalendarDays } from "date-fns"

interface GapFillerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gap: { bedId: string; startDate: string; endDate: string; days: number } | null
  onFill: (bedId: string, checkIn: string, checkOut: string, rate: number) => Promise<void>
}

export function GapFillerDialog({ open, onOpenChange, gap, onFill }: GapFillerDialogProps) {
  const [dailyRate, setDailyRate] = useState(100)
  const [loading, setLoading] = useState(false)

  if (!gap) return null

  const totalNights = differenceInCalendarDays(new Date(gap.endDate), new Date(gap.startDate))
  const totalRevenue = dailyRate * totalNights

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Llenar gap (Cama {gap.bedId})</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded bg-blue-500/10 p-3 text-xs text-blue-600">
            {gap.startDate} → {gap.endDate} ({totalNights} noches)
          </div>
          <div>
            <Label className="text-xs">Tarifa diaria</Label>
            <Input
              type="number"
              value={dailyRate}
              onChange={(e) => setDailyRate(Number(e.target.value))}
              min="10"
              max="1000"
              className="mt-1"
            />
          </div>
          <div className="rounded bg-green-500/10 p-2 text-sm font-medium text-green-600">
            Ingresos proyectados: ${totalRevenue}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              onClick={async () => {
                setLoading(true)
                await onFill(gap.bedId, gap.startDate, gap.endDate, dailyRate)
                setLoading(false)
                onOpenChange(false)
              }}
              disabled={loading}
            >
              {loading ? "Creando..." : "Crear reserva"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

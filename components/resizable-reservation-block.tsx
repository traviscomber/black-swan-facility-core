"use client"

import { useRef, useState, useCallback } from "react"
import { differenceInCalendarDays, addDays, format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { AlertCircle } from "lucide-react"

interface ResizableReservationBlockProps {
  reservation: {
    id: string
    guest_name: string
    check_in: string
    check_out: string
    status: string
    num_guests?: number | null
    total_amount?: number | null
  }
  columnWidth: number
  startDate: Date
  statusStyles: Record<string, string>
  onResize?: (reservationId: string, newCheckIn: string, newCheckOut: string) => void
  onSelected?: (reservationId: string) => void
}

const HANDLE_WIDTH = 12

export function ResizableReservationBlock({
  reservation,
  columnWidth,
  startDate,
  statusStyles,
  onResize,
  onSelected,
}: ResizableReservationBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState<"start" | "end" | "move" | null>(null)
  const [conflictError, setConflictError] = useState<string | null>(null)

  const checkInDate = new Date(reservation.check_in)
  const checkOutDate = new Date(reservation.check_out)
  const startPos = differenceInCalendarDays(checkInDate, startDate)
  const duration = differenceInCalendarDays(checkOutDate, checkInDate)

  const blockWidth = Math.max(columnWidth * duration - 2, columnWidth * 0.5)
  const blockLeft = columnWidth * startPos

  const handleMouseDown = (e: React.MouseEvent, type: "start" | "end" | "move") => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(type)
    setConflictError(null)

    const startX = e.clientX
    let dragStart = checkInDate.getTime()
    let dragEnd = checkOutDate.getTime()

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!blockRef.current?.parentElement) return

      const deltaPixels = moveEvent.clientX - startX
      const daysDelta = Math.round(deltaPixels / columnWidth)

      let newCheckIn = checkInDate
      let newCheckOut = checkOutDate

      if (type === "start") {
        const minDate = addDays(checkOutDate, -180) // Max 180 days
        newCheckIn = addDays(checkInDate, daysDelta)
        if (newCheckIn >= checkOutDate) newCheckIn = addDays(checkOutDate, -1)
        if (newCheckIn < minDate) newCheckIn = minDate
      } else if (type === "end") {
        const maxDate = addDays(checkInDate, 180)
        newCheckOut = addDays(checkOutDate, daysDelta)
        if (newCheckOut <= checkInDate) newCheckOut = addDays(checkInDate, 1)
        if (newCheckOut > maxDate) newCheckOut = maxDate
      } else if (type === "move") {
        const minDate = addDays(new Date(), -365)
        const maxDate = addDays(new Date(), 730)
        newCheckIn = addDays(checkInDate, daysDelta)
        newCheckOut = addDays(checkOutDate, daysDelta)
        if (newCheckIn < minDate) {
          const shift = differenceInCalendarDays(minDate, newCheckIn)
          newCheckIn = addDays(newCheckIn, shift)
          newCheckOut = addDays(newCheckOut, shift)
        }
        if (newCheckOut > maxDate) {
          const shift = differenceInCalendarDays(newCheckOut, maxDate)
          newCheckIn = addDays(newCheckIn, -shift)
          newCheckOut = addDays(newCheckOut, -shift)
        }
      }

      dragStart = newCheckIn.getTime()
      dragEnd = newCheckOut.getTime()
    }

    const handleMouseUp = async () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      setIsDragging(null)

      const newCheckInStr = format(new Date(dragStart), "yyyy-MM-dd")
      const newCheckOutStr = format(new Date(dragEnd), "yyyy-MM-dd")

      // Validate against conflicts
      if (onResize) {
        try {
          await onResize(reservation.id, newCheckInStr, newCheckOutStr)
        } catch (error: any) {
          setConflictError(error.message || "Conflict detected. Drag cancelled.")
          console.error("[resize] conflict:", error)
        }
      }
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }

  return (
    <>
      <div
        ref={blockRef}
        className="absolute top-0 h-10 rounded-md border-2 transition-opacity cursor-grab active:cursor-grabbing group hover:shadow-md"
        style={{
          left: `${blockLeft}px`,
          width: `${blockWidth}px`,
          ...getStatusStyle(reservation.status, statusStyles),
        }}
        onClick={() => onSelected?.(reservation.id)}
        title={`${reservation.guest_name} • ${reservation.check_in} to ${reservation.check_out}`}
      >
        {/* Left resize handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 bg-white/40 hover:bg-white/80 cursor-col-resize rounded-l-md opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ width: `${HANDLE_WIDTH}px` }}
          onMouseDown={(e) => handleMouseDown(e, "start")}
        />

        {/* Content */}
        <div className="px-2 py-1 h-full flex items-center justify-between overflow-hidden">
          <span className="text-xs font-semibold truncate">{reservation.guest_name}</span>
          {reservation.num_guests && (
            <span className="text-[10px] ml-1 opacity-80">{reservation.num_guests}g</span>
          )}
        </div>

        {/* Right resize handle */}
        <div
          className="absolute right-0 top-0 bottom-0 bg-white/40 hover:bg-white/80 cursor-col-resize rounded-r-md opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ width: `${HANDLE_WIDTH}px` }}
          onMouseDown={(e) => handleMouseDown(e, "end")}
        />
      </div>

      {/* Conflict error tooltip */}
      {conflictError && (
        <div className="absolute top-12 left-0 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-md p-2 text-xs text-red-900 dark:text-red-100 whitespace-nowrap z-50 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {conflictError}
        </div>
      )}
    </>
  )
}

function getStatusStyle(status: string, statusStyles: Record<string, string>): React.CSSProperties {
  const normalizedStatus = status.replaceAll("-", "_")
  const styleClass = statusStyles[normalizedStatus] || statusStyles["confirmed"]

  // Parse tailwind classes to CSS
  const bgMap: Record<string, string> = {
    "bg-violet-600": "#7c3aed",
    "bg-emerald-600": "#059669",
    "bg-slate-600": "#475569",
    "bg-amber-500": "#f59e0b",
    "bg-red-500": "#ef4444",
  }

  const borderMap: Record<string, string> = {
    "border-violet-700": "#6d28d9",
    "border-emerald-700": "#047857",
    "border-slate-700": "#334155",
    "border-amber-600": "#d97706",
    "border-red-600": "#dc2626",
  }

  const bgColor = Object.entries(bgMap).find(([key]) => styleClass.includes(key))?.[1] || "#7c3aed"
  const borderColor = Object.entries(borderMap).find(([key]) => styleClass.includes(key))?.[1] || "#6d28d9"

  return {
    backgroundColor: bgColor,
    borderColor: borderColor,
    color: styleClass.includes("text-white") ? "#ffffff" : "#000000",
  }
}

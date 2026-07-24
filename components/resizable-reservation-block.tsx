"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { differenceInCalendarDays, addDays, format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { AlertCircle } from "lucide-react"

// Add animation styles to document if not already present
if (typeof document !== "undefined" && !document.getElementById("flip-animations")) {
  const style = document.createElement("style")
  style.id = "flip-animations"
  style.textContent = `
    @keyframes flip-move {
      from {
        transform: translate(var(--flip-dx), var(--flip-dy)) scaleX(var(--flip-scaleX, 1));
        opacity: 0.9;
      }
      to {
        transform: translate(0, 0) scaleX(1);
        opacity: 1;
      }
    }

    @keyframes flip-resize-width {
      from {
        width: var(--flip-from-width);
      }
      to {
        width: var(--flip-to-width);
      }
    }

    @keyframes flip-fade-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .flip-animate-move {
      animation: flip-move 220ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
      transform-origin: left center;
    }

    .flip-animate-resize {
      animation: flip-resize-width 220ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    }

    .flip-animate-fade {
      animation: flip-fade-in 220ms ease-out forwards;
    }

    @media (prefers-reduced-motion: reduce) {
      .flip-animate-move,
      .flip-animate-resize,
      .flip-animate-fade {
        animation: none !important;
      }
    }
  `
  document.head.appendChild(style)
}

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
const HANDLE_WIDTH_TOUCH = 32 // Larger touch target
const AUTOSCROLL_ZONE = 72 // px from edge
const AUTOSCROLL_MIN_SPEED = 4 // px/frame
const AUTOSCROLL_MAX_SPEED = 20 // px/frame

export function ResizableReservationBlock({
  reservation,
  columnWidth,
  startDate,
  statusStyles,
  onResize,
  onSelected,
}: ResizableReservationBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null)
  const autoscrollRafRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)
  const lastYRef = useRef(0)
  const prevStateRef = useRef({ left: 0, width: 0 })
  const [isDragging, setIsDragging] = useState<"start" | "end" | "move" | null>(null)
  const [conflictError, setConflictError] = useState<string | null>(null)
  const [animateClass, setAnimateClass] = useState<string>("")
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  // Detect touch capability
  useEffect(() => {
    const hasTouchCapability =
      typeof window !== "undefined" &&
      (navigator.maxTouchPoints > 0 || navigator.maxTouchPoints > 0 || "ontouchstart" in window)
    setIsTouchDevice(hasTouchCapability)
  }, [])

  // Helper to stop autoscroll
  const stopAutoscroll = useCallback(() => {
    if (autoscrollRafRef.current !== null) {
      cancelAnimationFrame(autoscrollRafRef.current)
      autoscrollRafRef.current = null
    }
  }, [])

  // Helper to calculate autoscroll speed based on proximity to edge
  const getAutoscrollSpeed = useCallback((clientY: number, containerRect: DOMRect): number => {
    const distFromTop = clientY - containerRect.top
    const distFromBottom = containerRect.bottom - clientY

    const minDist = Math.min(distFromTop, distFromBottom)

    if (minDist > AUTOSCROLL_ZONE) return 0

    // Linear interpolation: at AUTOSCROLL_ZONE away = MIN speed, at 0 distance = MAX speed
    const speedRatio = 1 - minDist / AUTOSCROLL_ZONE
    return AUTOSCROLL_MIN_SPEED + (AUTOSCROLL_MAX_SPEED - AUTOSCROLL_MIN_SPEED) * speedRatio
  }, [])

  // Helper to start autoscroll loop
  const startAutoscrollLoop = useCallback(
    (clientY: number, direction: -1 | 1) => {
      stopAutoscroll()

      const loop = () => {
        if (!containerRef.current) return
        const containerRect = containerRef.current.getBoundingClientRect()
        const speed = getAutoscrollSpeed(clientY, containerRect)

        if (speed > 0) {
          containerRef.current.scrollTop += speed * direction
          lastYRef.current = clientY
          autoscrollRafRef.current = requestAnimationFrame(loop)
        } else {
          autoscrollRafRef.current = null
        }
      }

      loop()
    },
    [getAutoscrollSpeed, stopAutoscroll]
  )

  // Cleanup autoscroll on unmount
  useCallback(() => {
    return () => {
      stopAutoscroll()
    }
  }, [stopAutoscroll])()

  // Detect position/size changes and animate FLIP
  useEffect(() => {
    if (!blockRef.current || isDragging) return

    const currentLeft = blockRef.current.offsetLeft
    const currentWidth = blockRef.current.offsetWidth
    const prevLeft = prevStateRef.current.left
    const prevWidth = prevStateRef.current.width

    // Check if position or size changed
    const hasMoved = Math.abs(currentLeft - prevLeft) > 1
    const hasResized = Math.abs(currentWidth - prevWidth) > 1

    if ((hasMoved || hasResized) && (prevLeft !== 0 || prevWidth !== 0)) {
      // Calculate deltas for animation
      const dx = prevLeft - currentLeft
      const dscaleX = prevWidth / currentWidth

      // Remove previous animation class
      setAnimateClass("")

      // Trigger reflow to restart animation
      void blockRef.current.offsetHeight

      // Apply CSS variables and animation
      blockRef.current.style.setProperty("--flip-dx", `${dx}px`)
      blockRef.current.style.setProperty("--flip-scaleX", `${dscaleX}`)
      blockRef.current.style.setProperty("--flip-from-width", `${prevWidth}px`)
      blockRef.current.style.setProperty("--flip-to-width", `${currentWidth}px`)

      const animClass = hasMoved ? "flip-animate-move" : "flip-animate-resize"
      setAnimateClass(animClass)

      // Clean up animation class after it finishes
      const timer = setTimeout(() => {
        setAnimateClass("")
        blockRef.current?.style.removeProperty("--flip-dx")
        blockRef.current?.style.removeProperty("--flip-scaleX")
        blockRef.current?.style.removeProperty("--flip-from-width")
        blockRef.current?.style.removeProperty("--flip-to-width")
      }, 220)

      return () => clearTimeout(timer)
    }

    // Update previous state
    prevStateRef.current = { left: currentLeft, width: currentWidth }
  }, [isDragging, reservation.check_in, reservation.check_out])

  const checkInDate = new Date(reservation.check_in)
  const checkOutDate = new Date(reservation.check_out)
  const startPos = differenceInCalendarDays(checkInDate, startDate)
  const duration = differenceInCalendarDays(checkOutDate, checkInDate)

  const blockWidth = Math.max(columnWidth * duration - 2, columnWidth * 0.5)
  const blockLeft = columnWidth * startPos

  const handlePointerDown = (e: React.PointerEvent, type: "start" | "end" | "move") => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(type)
    setConflictError(null)

    // Get the scroll container (finds the nearest overflow:auto parent)
    let scrollContainer = blockRef.current?.parentElement
    while (scrollContainer && getComputedStyle(scrollContainer).overflowY === "visible") {
      scrollContainer = scrollContainer.parentElement
    }
    containerRef.current = scrollContainer || null

    const startX = e.clientX
    const startY = e.clientY
    let dragStart = checkInDate.getTime()
    let dragEnd = checkOutDate.getTime()

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!blockRef.current?.parentElement) return

      const deltaPixels = moveEvent.clientX - startX
      const daysDelta = Math.round(deltaPixels / columnWidth)

      // Check for vertical autoscroll zone
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const distFromTop = moveEvent.clientY - containerRect.top
        const distFromBottom = containerRect.bottom - moveEvent.clientY

        if (distFromTop < AUTOSCROLL_ZONE) {
          startAutoscrollLoop(moveEvent.clientY, -1) // scroll up
        } else if (distFromBottom < AUTOSCROLL_ZONE) {
          startAutoscrollLoop(moveEvent.clientY, 1) // scroll down
        } else {
          stopAutoscroll() // stop if outside zones
        }
        lastYRef.current = moveEvent.clientY
      }

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

    const handlePointerUp = async () => {
      document.removeEventListener("pointermove", handlePointerMove)
      document.removeEventListener("pointerup", handlePointerUp)
      document.removeEventListener("pointercancel", handlePointerUp)
      
      // Release pointer capture if set (for touch)
      if (blockRef.current?.hasPointerCapture) {
        try {
          blockRef.current.releasePointerCapture((e as any).pointerId)
        } catch (e) {
          // Ignore if already released
        }
      }
      
      stopAutoscroll()
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

    // Set pointer capture for better tracking during touch
    try {
      (e.currentTarget as HTMLElement).setPointerCapture((e as any).pointerId)
    } catch (err) {
      // Ignore if capture fails
    }

    document.addEventListener("pointermove", handlePointerMove)
    document.addEventListener("pointerup", handlePointerUp)
    document.addEventListener("pointercancel", handlePointerUp)
  }

  return (
    <>
      <div
        ref={blockRef}
        className={`absolute top-0 h-10 rounded-md border-2 cursor-grab active:cursor-grabbing group hover:shadow-md ${animateClass} ${isDragging ? "" : "transition-shadow"}`}
        style={{
          left: `${blockLeft}px`,
          width: `${blockWidth}px`,
          willChange: isDragging ? "transform" : "auto",
          ...getStatusStyle(reservation.status, statusStyles),
        }}
        onClick={() => onSelected?.(reservation.id)}
        title={`${reservation.guest_name} • ${reservation.check_in} to ${reservation.check_out}`}
      >
        {/* Left resize handle */}
        <div
          className={`absolute left-0 top-0 bottom-0 bg-white/40 hover:bg-white/80 active:bg-white/100 cursor-col-resize rounded-l-md transition-all ${
            isTouchDevice ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          } ${isDragging === "start" ? "bg-white/100" : ""}`}
          style={{ 
            width: `${isTouchDevice ? HANDLE_WIDTH_TOUCH : HANDLE_WIDTH}px`,
            touchAction: "none",
            WebkitTouchCallout: "none",
          }}
          onPointerDown={(e) => handlePointerDown(e, "start")}
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
          className={`absolute right-0 top-0 bottom-0 bg-white/40 hover:bg-white/80 active:bg-white/100 cursor-col-resize rounded-r-md transition-all ${
            isTouchDevice ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          } ${isDragging === "end" ? "bg-white/100" : ""}`}
          style={{ 
            width: `${isTouchDevice ? HANDLE_WIDTH_TOUCH : HANDLE_WIDTH}px`,
            touchAction: "none",
            WebkitTouchCallout: "none",
          }}
          onPointerDown={(e) => handlePointerDown(e, "end")}
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

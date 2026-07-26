"use client"

import { useEffect, useRef } from "react"

// ---------------------------------------------------------------------------
// useCalendarAutoscroll
//
// Drives automatic scroll on the timeline container when the user drags or
// resizes near the horizontal or vertical edges of the scroll viewport.
//
// Usage:
//   const scrollRef = useCalendarAutoscroll({ active: isResizing || !!draggingEventId })
//   <div ref={scrollRef} className="overflow-auto"> ... </div>
// ---------------------------------------------------------------------------

const EDGE_ZONE  = 80   // px from edge that triggers scroll
const MAX_SPEED  = 18   // px per frame at the very edge
const MIN_SPEED  = 2    // px per frame at the outer boundary of the zone
const FRAME_MS   = 16   // ~60 fps

export interface UseCalendarAutoscrollOptions {
  /** Autoscroll is only active when an interaction (drag/resize) is in progress */
  active: boolean
}

export function useCalendarAutoscroll({ active }: UseCalendarAutoscrollOptions) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  // Last known pointer position relative to the viewport
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const rafRef     = useRef<number | null>(null)

  // Track pointer position globally so we always have the latest coords
  // even when pointer capture is held by another element
  useEffect(() => {
    if (!active) {
      pointerRef.current = null
      return
    }

    function onPointerMove(e: PointerEvent) {
      pointerRef.current = { x: e.clientX, y: e.clientY }
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true })
    return () => window.removeEventListener("pointermove", onPointerMove)
  }, [active])

  // Animation loop — runs only while active
  useEffect(() => {
    if (!active) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return
    }

    let lastTick = 0

    function tick(now: number) {
      rafRef.current = requestAnimationFrame(tick)

      // Throttle to ~60 fps
      if (now - lastTick < FRAME_MS) return
      lastTick = now

      const el = scrollRef.current
      const pt = pointerRef.current
      if (!el || !pt) return

      const rect = el.getBoundingClientRect()

      // Horizontal scroll
      const relX = pt.x - rect.left
      let dx = 0
      if (relX < EDGE_ZONE && el.scrollLeft > 0) {
        dx = -speed(relX, EDGE_ZONE)
      } else if (relX > rect.width - EDGE_ZONE && el.scrollLeft < el.scrollWidth - el.clientWidth) {
        dx = speed(rect.width - relX, EDGE_ZONE)
      }

      // Vertical scroll
      const relY = pt.y - rect.top
      let dy = 0
      if (relY < EDGE_ZONE && el.scrollTop > 0) {
        dy = -speed(relY, EDGE_ZONE)
      } else if (relY > rect.height - EDGE_ZONE && el.scrollTop < el.scrollHeight - el.clientHeight) {
        dy = speed(rect.height - relY, EDGE_ZONE)
      }

      if (dx !== 0) el.scrollLeft += dx
      if (dy !== 0) el.scrollTop  += dy
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [active])

  return scrollRef
}

// Maps distance-from-edge (0 = at edge, zone = at boundary) to scroll speed
function speed(distanceFromEdge: number, zone: number): number {
  const t = 1 - Math.min(1, Math.max(0, distanceFromEdge / zone))
  return Math.round(MIN_SPEED + t * (MAX_SPEED - MIN_SPEED))
}

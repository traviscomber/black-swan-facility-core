"use client"

import { useCallback, useEffect, useRef } from "react"

const EDGE_ZONE_PX = 72
const MIN_SPEED_PX = 4
const MAX_SPEED_PX = 20

interface PointerPosition {
  clientX: number
  clientY: number
}

interface AutoscrollOptions {
  enabled: boolean
  container: HTMLElement | null
  onScrollFrame?: () => void
}

function axisVelocity(pointer: number, start: number, end: number) {
  if (pointer < start + EDGE_ZONE_PX) {
    const intensity = Math.min(1, Math.max(0, (start + EDGE_ZONE_PX - pointer) / EDGE_ZONE_PX))
    return -(MIN_SPEED_PX + (MAX_SPEED_PX - MIN_SPEED_PX) * intensity)
  }

  if (pointer > end - EDGE_ZONE_PX) {
    const intensity = Math.min(1, Math.max(0, (pointer - (end - EDGE_ZONE_PX)) / EDGE_ZONE_PX))
    return MIN_SPEED_PX + (MAX_SPEED_PX - MIN_SPEED_PX) * intensity
  }

  return 0
}

export function useCalendarAutoscroll({ enabled, container, onScrollFrame }: AutoscrollOptions) {
  const pointerRef = useRef<PointerPosition | null>(null)
  const frameRef = useRef<number | null>(null)
  const onScrollFrameRef = useRef(onScrollFrame)

  useEffect(() => {
    onScrollFrameRef.current = onScrollFrame
  }, [onScrollFrame])

  const stop = useCallback(() => {
    pointerRef.current = null
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [])

  const tick = useCallback(() => {
    frameRef.current = null
    if (!enabled || !container || !pointerRef.current) return

    const rect = container.getBoundingClientRect()
    const velocityX = axisVelocity(pointerRef.current.clientX, rect.left, rect.right)
    const velocityY = axisVelocity(pointerRef.current.clientY, rect.top, rect.bottom)

    if (velocityX !== 0 || velocityY !== 0) {
      const previousLeft = container.scrollLeft
      const previousTop = container.scrollTop

      container.scrollBy({ left: velocityX, top: velocityY, behavior: "auto" })

      if (container.scrollLeft !== previousLeft || container.scrollTop !== previousTop) {
        onScrollFrameRef.current?.()
      }
    }

    frameRef.current = requestAnimationFrame(tick)
  }, [container, enabled])

  const updatePointer = useCallback((position: PointerPosition) => {
    pointerRef.current = position
    if (!enabled || !container || frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(tick)
  }, [container, enabled, tick])

  useEffect(() => {
    if (!enabled) stop()
    return stop
  }, [enabled, stop])

  return { updatePointer, stop }
}

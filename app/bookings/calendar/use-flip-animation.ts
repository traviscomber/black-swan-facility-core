"use client"

import { useCallback, useEffect, useRef } from "react"

/**
 * FLIP animation hook for reservation blocks.
 *
 * Usage:
 *   const { captureRect, flipTo } = useFlipAnimation()
 *
 *   // Before layout change:
 *   captureRect(reservationId, element)
 *
 *   // After React commits the new layout (in a useLayoutEffect or after setState):
 *   flipTo(reservationId, element)
 */

const DURATION_MS = 220
const EASING = "cubic-bezier(0.25, 0.46, 0.45, 0.94)"

/** Cached rect snapshot keyed by reservation/block id */
type RectMap = Map<string, DOMRect>

/** Active Web Animations keyed by element to allow early cancellation */
type AnimationMap = Map<HTMLElement, Animation>

export function useFlipAnimation() {
  const rects = useRef<RectMap>(new Map())
  const animations = useRef<AnimationMap>(new Map())
  const reducedMotion = useRef(false)

  // Read prefers-reduced-motion once on mount
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    reducedMotion.current = mq.matches
    const handler = (e: MediaQueryListEvent) => { reducedMotion.current = e.matches }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Cancel all active animations on unmount to avoid transform residuals
  useEffect(() => {
    const active = animations.current
    return () => {
      active.forEach((anim) => anim.cancel())
      active.clear()
    }
  }, [])

  /**
   * Capture the current rect of an element before a layout change.
   * Call this synchronously before you update state that will move the element.
   */
  const captureRect = useCallback((id: string, el: HTMLElement | null) => {
    if (!el) return
    rects.current.set(id, el.getBoundingClientRect())
  }, [])

  /**
   * Animate from the captured rect to the element's current (new) rect.
   * Call this after React has painted the new layout.
   */
  const flipTo = useCallback((id: string, el: HTMLElement | null) => {
    if (!el) return
    const oldRect = rects.current.get(id)
    rects.current.delete(id)
    if (!oldRect) return

    const newRect = el.getBoundingClientRect()

    const deltaX = oldRect.left - newRect.left
    const deltaY = oldRect.top - newRect.top
    const scaleX = oldRect.width / Math.max(1, newRect.width)

    // Nothing moved — skip
    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5 && Math.abs(scaleX - 1) < 0.005) return

    // Cancel any prior animation on this element
    const prior = animations.current.get(el)
    if (prior) prior.cancel()

    if (reducedMotion.current) return

    // Invert → Play: animate FROM the old position/size TO the identity transform
    const anim = el.animate(
      [
        { transform: `translate(${deltaX}px, ${deltaY}px) scaleX(${scaleX})`, transformOrigin: "left center" },
        { transform: "translate(0px, 0px) scaleX(1)", transformOrigin: "left center" },
      ],
      {
        duration: DURATION_MS,
        easing: EASING,
        fill: "none", // never leave a residual transform
      }
    )

    animations.current.set(el, anim)
    anim.onfinish = () => animations.current.delete(el)
    anim.oncancel = () => animations.current.delete(el)
  }, [])

  /** Clear a captured rect without animating (used for rollback snapshots) */
  const clearRect = useCallback((id: string) => {
    rects.current.delete(id)
  }, [])

  return { captureRect, flipTo, clearRect }
}

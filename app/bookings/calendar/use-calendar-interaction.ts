"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import type {
  AvailabilityState,
  CalendarCreateInteraction,
  CalendarInteraction,
  CalendarInteractionPreview,
  CalendarMoveInteraction,
  CalendarResizeInteraction,
} from "./calendar-types"

interface InteractionPointer {
  pointerId: number
  clientX: number
  clientY: number
}

interface BeginMoveInput extends InteractionPointer {
  reservationId: string
  originBedId: string
  startsOn: string
  endsOn: string
  scrollLeft: number
  scrollTop: number
}

interface BeginResizeInput extends Omit<InteractionPointer, "clientY"> {
  reservationId: string
  bedId: string
  edge: "start" | "end"
  startsOn: string
  endsOn: string
  scrollLeft: number
}

interface BeginCreateInput extends Omit<InteractionPointer, "clientY"> {
  bedId: string
  anchorDate: string
  scrollLeft: number
}

const IDLE_PREVIEW: CalendarInteractionPreview | null = null

export function useCalendarInteraction() {
  const [preview, setPreview] = useState<CalendarInteractionPreview | null>(IDLE_PREVIEW)
  const latestPreviewRef = useRef<CalendarInteractionPreview | null>(IDLE_PREVIEW)

  const commitPreview = useCallback((next: CalendarInteractionPreview | null) => {
    latestPreviewRef.current = next
    setPreview(next)
  }, [])

  const beginMove = useCallback((input: BeginMoveInput) => {
    const interaction: CalendarMoveInteraction = {
      type: "move",
      pointerId: input.pointerId,
      reservationId: input.reservationId,
      originBedId: input.originBedId,
      targetBedId: input.originBedId,
      originalStart: input.startsOn,
      originalEnd: input.endsOn,
      previewStart: input.startsOn,
      previewEnd: input.endsOn,
      pointerStartX: input.clientX,
      pointerStartY: input.clientY,
      initialScrollLeft: input.scrollLeft,
      initialScrollTop: input.scrollTop,
    }

    commitPreview({ interaction, availability: "idle", conflictType: null, message: null })
  }, [commitPreview])

  const beginResize = useCallback((input: BeginResizeInput) => {
    const interaction: CalendarResizeInteraction = {
      type: input.edge === "start" ? "resize-start" : "resize-end",
      pointerId: input.pointerId,
      reservationId: input.reservationId,
      bedId: input.bedId,
      originalStart: input.startsOn,
      originalEnd: input.endsOn,
      previewStart: input.startsOn,
      previewEnd: input.endsOn,
      pointerStartX: input.clientX,
      initialScrollLeft: input.scrollLeft,
    }

    commitPreview({ interaction, availability: "idle", conflictType: null, message: null })
  }, [commitPreview])

  const beginCreate = useCallback((input: BeginCreateInput) => {
    const interaction: CalendarCreateInteraction = {
      type: "create",
      pointerId: input.pointerId,
      bedId: input.bedId,
      anchorDate: input.anchorDate,
      previewStart: input.anchorDate,
      previewEnd: input.anchorDate,
      pointerStartX: input.clientX,
      initialScrollLeft: input.scrollLeft,
    }

    commitPreview({ interaction, availability: "idle", conflictType: null, message: null })
  }, [commitPreview])

  const updateInteraction = useCallback((updater: (current: CalendarInteraction) => CalendarInteraction) => {
    const current = latestPreviewRef.current
    if (!current) return

    commitPreview({
      ...current,
      interaction: updater(current.interaction),
      availability: "idle",
      conflictType: null,
      message: null,
    })
  }, [commitPreview])

  const updateMoveTarget = useCallback((targetBedId: string, previewStart: string, previewEnd: string) => {
    updateInteraction((current) => current.type === "move"
      ? { ...current, targetBedId, previewStart, previewEnd }
      : current)
  }, [updateInteraction])

  const updateDates = useCallback((previewStart: string, previewEnd: string) => {
    updateInteraction((current) => ({ ...current, previewStart, previewEnd }))
  }, [updateInteraction])

  const setAvailability = useCallback((
    availability: AvailabilityState,
    options?: { conflictType?: "reservation" | "block" | null; message?: string | null },
  ) => {
    const current = latestPreviewRef.current
    if (!current) return

    commitPreview({
      ...current,
      availability,
      conflictType: options?.conflictType ?? null,
      message: options?.message ?? null,
    })
  }, [commitPreview])

  const cancel = useCallback((pointerId?: number) => {
    const current = latestPreviewRef.current
    if (pointerId !== undefined && current?.interaction.pointerId !== pointerId) return
    commitPreview(null)
  }, [commitPreview])

  const complete = useCallback((pointerId: number) => {
    const current = latestPreviewRef.current
    if (!current || current.interaction.pointerId !== pointerId) return null
    commitPreview(null)
    return current
  }, [commitPreview])

  const state = useMemo(() => ({
    preview,
    interaction: preview?.interaction ?? null,
    isInteracting: preview !== null,
    isMoving: preview?.interaction.type === "move",
    isResizing: preview?.interaction.type === "resize-start" || preview?.interaction.type === "resize-end",
    isCreating: preview?.interaction.type === "create",
  }), [preview])

  return {
    ...state,
    beginMove,
    beginResize,
    beginCreate,
    updateMoveTarget,
    updateDates,
    setAvailability,
    cancel,
    complete,
    getLatestPreview: () => latestPreviewRef.current,
  }
}

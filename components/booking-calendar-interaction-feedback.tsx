"use client"

import { format, parseISO } from "date-fns"
import { AlertTriangle, CalendarPlus2, CheckCircle2, MoveHorizontal } from "lucide-react"
import type { Feedback } from "@/components/booking-calendar-model"

export function BookingCalendarInteractionFeedback({ feedback }: { feedback: Feedback | null }) {
  return (
    <>
      <style jsx global>{`
        [data-booking-bed-row="true"][data-booking-candidate-state="valid"] [data-booking-timeline-row="true"] {
          background: color-mix(in srgb, var(--primary) 5%, transparent);
        }
        [data-booking-bed-row="true"][data-booking-candidate-state="warning"] [data-booking-timeline-row="true"] {
          background: color-mix(in srgb, var(--status-warning, #d4a72c) 8%, transparent);
        }
        [data-booking-bed-row="true"][data-booking-candidate-state="invalid"] [data-booking-timeline-row="true"] {
          opacity: 0.58;
        }
        [data-booking-bed-row="true"][data-booking-drop-state="valid"] [data-booking-timeline-row="true"] {
          box-shadow: inset 0 0 0 2px var(--primary);
        }
        [data-booking-bed-row="true"][data-booking-drop-state="warning"] [data-booking-timeline-row="true"] {
          box-shadow: inset 0 0 0 2px var(--status-warning, #d4a72c);
        }
        [data-booking-bed-row="true"][data-booking-drop-state="invalid"] [data-booking-timeline-row="true"] {
          box-shadow: inset 0 0 0 2px var(--destructive);
        }
        [data-booking-date][data-booking-create-state="valid"] {
          background: color-mix(in srgb, var(--primary) 20%, transparent) !important;
          box-shadow: inset 0 2px 0 var(--primary), inset 0 -2px 0 var(--primary);
        }
        [data-booking-date][data-booking-create-state="invalid"] {
          background: color-mix(in srgb, var(--destructive) 18%, transparent) !important;
          box-shadow: inset 0 2px 0 var(--destructive), inset 0 -2px 0 var(--destructive);
        }
        [data-booking-reservation="true"]:hover [data-booking-resize-edge],
        [data-booking-reservation="true"][aria-grabbed="true"] [data-booking-resize-edge] {
          opacity: 1;
        }
        @media (pointer: coarse) {
          [data-booking-resize-edge] { width: 28px !important; }
        }
      `}</style>

      {feedback && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="pointer-events-none fixed left-1/2 top-20 z-[95] w-[min(460px,calc(100vw-2rem))] -translate-x-1/2 bg-[var(--surface-2)] px-4 py-3 text-[var(--text-primary)] shadow-none"
          data-testid="booking-interaction-feedback"
        >
          <div className="flex items-start gap-3">
            {feedback.state === "valid"
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
              : <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${feedback.state === "warning" ? "text-[var(--status-warning)]" : "text-[var(--destructive)]"}`} />}
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                {feedback.mode === "create"
                  ? <CalendarPlus2 className="h-4 w-4" />
                  : <MoveHorizontal className="h-4 w-4" />}
                {feedback.guestName}
              </p>
              <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{feedback.targetLabel}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {format(parseISO(feedback.checkIn), "dd MMM yyyy")} → {format(parseISO(feedback.checkOut), "dd MMM yyyy")} · {feedback.nights} noches
              </p>
              <p className="mt-2 text-xs">{feedback.message}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

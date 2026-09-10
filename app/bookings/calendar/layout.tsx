import "./bedbooking-density.css"
import { BookingReferenceSidebar } from "@/components/calendar/booking-reference-sidebar"

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="booking-calendar-reference-frame">
      <BookingReferenceSidebar />
      <div className="booking-calendar-bedbooking-shell">{children}</div>
    </div>
  )
}

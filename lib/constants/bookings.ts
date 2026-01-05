// Centralized booking constants to avoid duplication across the booking system

// Reservation status values - single source of truth
export const RESERVATION_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CHECKED_IN: "checked_in",
  CHECKED_OUT: "checked_out",
  CANCELLED: "cancelled",
} as const

export const RESERVATION_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "checked_in", label: "Checked In" },
  { value: "checked_out", label: "Checked Out" },
  { value: "cancelled", label: "Cancelled" },
]

// Facility color scheme for bed/room display
export const FACILITY_COLORS = [
  { bg: "bg-red-200", border: "border-l-4 border-red-400", text: "text-red-900", hover: "hover:bg-red-100" },
  { bg: "bg-blue-200", border: "border-l-4 border-blue-400", text: "text-blue-900", hover: "hover:bg-blue-100" },
  {
    bg: "bg-emerald-200",
    border: "border-l-4 border-emerald-400",
    text: "text-emerald-900",
    hover: "hover:bg-emerald-100",
  },
  { bg: "bg-amber-200", border: "border-l-4 border-amber-400", text: "text-amber-900", hover: "hover:bg-amber-100" },
  {
    bg: "bg-violet-200",
    border: "border-l-4 border-violet-400",
    text: "text-violet-900",
    hover: "hover:bg-violet-100",
  },
  { bg: "bg-rose-200", border: "border-l-4 border-rose-400", text: "text-rose-900", hover: "hover:bg-rose-100" },
  {
    bg: "bg-indigo-200",
    border: "border-l-4 border-indigo-400",
    text: "text-indigo-900",
    hover: "hover:bg-indigo-100",
  },
  { bg: "bg-teal-200", border: "border-l-4 border-teal-400", text: "text-teal-900", hover: "hover:bg-teal-100" },
]

// Toast message templates for consistency
export const BOOKING_MESSAGES = {
  // Success messages
  RESERVATION_CREATED: { title: "Success", description: "Reservation created successfully" },
  RESERVATION_UPDATED: { title: "Success", description: "Reservation updated successfully" },
  RESERVATION_DELETED: { title: "Success", description: "Reservation deleted successfully" },
  ROOM_CREATED: { title: "Success", description: "Room added successfully" },
  ROOM_UPDATED: { title: "Success", description: "Room updated successfully" },
  ROOM_DELETED: { title: "Success", description: "Room deleted successfully" },
  BED_CREATED: { title: "Success", description: "Bed added successfully" },
  BED_UPDATED: { title: "Success", description: "Bed updated successfully" },
  BED_DELETED: { title: "Success", description: "Bed deleted successfully" },

  // Error messages
  RESERVATION_ERROR: { variant: "destructive" as const, title: "Error", description: "Failed to process reservation" },
  ROOM_ERROR: { variant: "destructive" as const, title: "Error", description: "Failed to process room" },
  BED_ERROR: { variant: "destructive" as const, title: "Error", description: "Failed to process bed" },
  DUPLICATE_ERROR: { variant: "destructive" as const, title: "Error", description: "This item already exists" },
  VALIDATION_ERROR: {
    variant: "destructive" as const,
    title: "Validation Error",
    description: "Please check your input",
  },
}

// Room type options
export const ROOM_TYPES = [
  { value: "single", label: "Single" },
  { value: "double", label: "Double" },
  { value: "suite", label: "Suite" },
  { value: "dormitory", label: "Dormitory" },
  { value: "villa", label: "Villa" },
]

// Bed type options
export const BED_TYPES = [
  { value: "single", label: "Single Bed" },
  { value: "double", label: "Double Bed" },
  { value: "queen", label: "Queen Bed" },
  { value: "king", label: "King Bed" },
  { value: "bunk", label: "Bunk Bed" },
]

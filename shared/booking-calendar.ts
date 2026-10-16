/** Calendar visibility only; completed history remains in the booking list. */
export function calendarBookings<T extends { status: string; archived?: boolean }>(bookings: T[]): T[] {
  return bookings.filter(booking => booking.archived !== true &&
    !["completed", "cancelled", "no_show"].includes(booking.status.trim().toLowerCase()));
}
